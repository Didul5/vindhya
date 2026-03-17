import asyncio
import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from app.database import get_db, User
from app.auth import get_current_user
from app.embeddings import encode
from app.routes.ask import _retrieve_chunks
from app.llm import evaluate_answer, compute_cost

router = APIRouter()


class EvaluateRequest(BaseModel):
    question: str
    student_answer: str
    textbook_id: int


@router.post("/")
async def evaluate(
    req: EvaluateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not req.question.strip() or not req.student_answer.strip():
        raise HTTPException(400, "Question and answer required")

    # Get reference context
    loop = asyncio.get_event_loop()
    query_embedding = await loop.run_in_executor(None, encode, req.question)
    chunks = await _retrieve_chunks(db, req.textbook_id, query_embedding, 5)

    if not chunks:
        raise HTTPException(404, "No reference content found")

    context = "\n".join(c["content"] for c in chunks[:3])
    raw, input_tok, output_tok, latency_ms = await evaluate_answer(
        req.question, req.student_answer, context
    )

    try:
        result = json.loads(raw)
    except json.JSONDecodeError:
        import re
        match = re.search(r'\{.*\}', raw, re.DOTALL)
        if match:
            result = json.loads(match.group())
        else:
            result = {"score": 5, "grade": "C", "feedback": raw, "correct_answer": "", "improvement_tips": ""}

    # XP: 2 points for attempting evaluation
    current_user.xp_points = (current_user.xp_points or 0) + 2
    await db.commit()

    return {
        **result,
        "cost_usd": round(compute_cost(input_tok, output_tok), 6),
        "latency_ms": round(latency_ms, 1),
    }
