import time
from groq import AsyncGroq
from app.config import get_settings

settings = get_settings()
_client = AsyncGroq(api_key=settings.groq_api_key)


async def _chat(messages: list, max_tokens: int = 1024, temperature: float = 0.3) -> tuple[str, int, int, float]:
    """Returns (content, input_tokens, output_tokens, latency_ms)."""
    t0 = time.perf_counter()
    resp = await _client.chat.completions.create(
        model=settings.llm_model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    latency_ms = (time.perf_counter() - t0) * 1000
    choice = resp.choices[0].message.content or ""
    usage = resp.usage
    return choice, usage.prompt_tokens, usage.completion_tokens, latency_ms


async def rewrite_query(query: str) -> str:
    """Make vague queries more precise for better retrieval."""
    if len(query.split()) > 6:
        return query  # already detailed enough

    msgs = [
        {"role": "system", "content": "Rewrite the student query to be more specific and searchable. Output ONLY the rewritten query, nothing else."},
        {"role": "user", "content": query},
    ]
    result, _, _, _ = await _chat(msgs, max_tokens=100, temperature=0.1)
    return result.strip() or query


async def answer_question(
    query: str,
    context: str,
    history: list,
    low_bandwidth: bool = False,
) -> tuple[str, int, int, float]:
    """Answer a student question given context and chat history."""
    style = "Be concise (max 3 sentences)." if low_bandwidth else "Be thorough and use examples when helpful."
    system = f"""You are Vindhya, an expert AI tutor. Answer student questions using ONLY the provided textbook context.
{style}
If the answer isn't in the context, say so honestly.
Format math clearly. Reference page numbers if available."""

    messages = [{"role": "system", "content": system}]
    messages.extend(history[-6:])  # last 3 exchanges for memory
    messages.append({
        "role": "user",
        "content": f"Context:\n{context}\n\nQuestion: {query}"
    })
    max_tok = 300 if low_bandwidth else 1024
    return await _chat(messages, max_tokens=max_tok)


async def generate_quiz(context: str, num_questions: int = 5) -> tuple[str, int, int, float]:
    """Generate MCQ quiz from a chunk of text."""
    msgs = [
        {"role": "system", "content": """Generate a quiz from the given text. Output ONLY valid JSON in this format:
{"questions": [{"q": "...", "options": ["A) ...", "B) ...", "C) ...", "D) ..."], "answer": "A", "explanation": "..."}]}
No markdown, no extra text."""},
        {"role": "user", "content": f"Generate {num_questions} MCQs from:\n{context[:3000]}"},
    ]
    return await _chat(msgs, max_tokens=2000, temperature=0.4)


async def generate_summary(context: str, low_bandwidth: bool = False) -> tuple[str, int, int, float]:
    """Summarize a chapter or section."""
    length = "3 bullet points" if low_bandwidth else "a structured summary with key points, important concepts, and formulas"
    msgs = [
        {"role": "system", "content": f"You are an expert summarizer for students. Summarize the text as {length}."},
        {"role": "user", "content": context[:4000]},
    ]
    return await _chat(msgs, max_tokens=600 if low_bandwidth else 1200)


async def highlight_concepts(context: str) -> tuple[str, int, int, float]:
    """Extract the most important concepts from a passage."""
    msgs = [
        {"role": "system", "content": """Extract the top 8 key concepts/terms from this text. Output ONLY valid JSON:
{"concepts": [{"term": "...", "definition": "...", "importance": "high|medium"}]}"""},
        {"role": "user", "content": context[:3000]},
    ]
    return await _chat(msgs, max_tokens=800, temperature=0.2)


async def evaluate_answer(question: str, student_answer: str, correct_context: str) -> tuple[str, int, int, float]:
    """Score and give feedback on a student's answer."""
    msgs = [
        {"role": "system", "content": """Evaluate the student's answer. Output ONLY valid JSON:
{"score": 0-10, "grade": "A/B/C/D/F", "feedback": "...", "correct_answer": "...", "improvement_tips": "..."}"""},
        {"role": "user", "content": f"Question: {question}\nStudent Answer: {student_answer}\nReference: {correct_context[:2000]}"},
    ]
    return await _chat(msgs, max_tokens=600, temperature=0.2)


def compute_cost(input_tokens: int, output_tokens: int) -> float:
    """Cost in USD."""
    return (input_tokens * settings.input_price_per_mtok / 1_000_000 +
            output_tokens * settings.output_price_per_mtok / 1_000_000)
