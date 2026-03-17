import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db, User, Chunk, Progress
from app.auth import get_current_user
from app.embeddings import encode
from app.routes.ask import _retrieve_chunks
from app.llm import generate_quiz, compute_cost

router = APIRouter()


class QuizRequest(BaseModel):
    textbook_id: int
    topic: str = ""
    num_questions: int = 5


class QuizSubmitRequest(BaseModel):
    textbook_id: int
    answers: dict  # {question_index: "A/B/C/D"}
    correct_answers: dict  # {question_index: "A/B/C/D"}


@router.post("/generate")
async def generate(
    req: QuizRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    num_q = min(max(req.num_questions, 3), 10)  # clamp 3-10

    # Get relevant context for the topic
    if req.topic:
        loop = asyncio.get_event_loop()
        query_embedding = await loop.run_in_executor(None, encode, req.topic)
        chunks = await _retrieve_chunks(db, req.textbook_id, query_embedding, 8)
    else:
        # Random sample of chunks from this textbook
        result = await db.execute(
            select(Chunk).where(Chunk.textbook_id == req.textbook_id).limit(8)
        )
        raw = result.scalars().all()
        chunks = [{"content": c.content, "page_num": c.page_num, "chapter_title": c.chapter_title} for c in raw]

    if not chunks:
        raise HTTPException(404, "No content found for this textbook")

    context = "\n\n".join(c["content"] for c in chunks[:5])
    raw_result, input_tok, output_tok, latency_ms = await generate_quiz(context, num_q)

    try:
        data = json.loads(raw_result)
    except json.JSONDecodeError:
        # Try to extract JSON from the response
        import re
        match = re.search(r'\{.*\}', raw_result, re.DOTALL)
        if match:
            data = json.loads(match.group())
        else:
            raise HTTPException(500, "Failed to parse quiz response")

    return {
        "questions": data.get("questions", []),
        "topic": req.topic or "General",
        "textbook_id": req.textbook_id,
        "cost_usd": round(compute_cost(input_tok, output_tok), 6),
        "latency_ms": round(latency_ms, 1),
    }


@router.post("/submit")
async def submit_quiz(
    req: QuizSubmitRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not req.answers or not req.correct_answers:
        raise HTTPException(400, "Missing answers")

    correct = sum(
        1 for k, v in req.answers.items()
        if req.correct_answers.get(k) == v
    )
    total = len(req.correct_answers)
    score = round((correct / total) * 100, 1) if total > 0 else 0

    # Update progress
    result = await db.execute(
        select(Progress).where(
            Progress.user_id == current_user.id,
            Progress.textbook_id == req.textbook_id
        )
    )
    prog = result.scalar_one_or_none()
    if not prog:
        prog = Progress(user_id=current_user.id, textbook_id=req.textbook_id)
        db.add(prog)

    prog.quizzes_taken = (prog.quizzes_taken or 0) + 1
    # Rolling average
    prev_avg = prog.avg_score or 0
    prev_count = prog.quizzes_taken - 1
    prog.avg_score = (prev_avg * prev_count + score) / prog.quizzes_taken

    # XP: 10 points per quiz
    current_user.xp_points = (current_user.xp_points or 0) + 10
    await db.commit()

    # Check for badges
    badges_earned = []
    if score == 100:
        badges_earned.append({"name": "Perfect Score", "description": "Got 100% on a quiz!"})
    if prog.quizzes_taken == 5:
        badges_earned.append({"name": "Quiz Master", "description": "Completed 5 quizzes!"})

    return {
        "score": score,
        "correct": correct,
        "total": total,
        "grade": "A" if score >= 90 else "B" if score >= 80 else "C" if score >= 70 else "D" if score >= 60 else "F",
        "xp_earned": 10,
        "badges_earned": badges_earned,
    }
