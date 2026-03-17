import asyncio
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from app.database import get_db, User, Chunk, Progress
from app.auth import get_current_user
from app.embeddings import encode
from app.routes.ask import _retrieve_chunks
from app.llm import generate_summary, compute_cost

router = APIRouter()


class SummaryRequest(BaseModel):
    textbook_id: int
    chapter_title: str = ""
    page_range: str = ""  # e.g., "10-25"


@router.post("/generate")
async def summarize(
    req: SummaryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Get chunks from specific chapter or page range
    query = select(Chunk).where(Chunk.textbook_id == req.textbook_id)

    if req.chapter_title:
        query = query.where(Chunk.chapter_title.ilike(f"%{req.chapter_title}%"))
    elif req.page_range:
        try:
            start, end = map(int, req.page_range.split("-"))
            query = query.where(Chunk.page_num >= start, Chunk.page_num <= end)
        except ValueError:
            pass

    query = query.order_by(Chunk.chunk_index).limit(15)
    result = await db.execute(query)
    chunks = result.scalars().all()

    if not chunks:
        # Fall back to first 15 chunks
        result = await db.execute(
            select(Chunk).where(Chunk.textbook_id == req.textbook_id)
            .order_by(Chunk.chunk_index).limit(15)
        )
        chunks = result.scalars().all()

    if not chunks:
        raise HTTPException(404, "No content found")

    context = "\n\n".join(c.content for c in chunks)
    summary, input_tok, output_tok, latency_ms = await generate_summary(
        context, current_user.low_bandwidth_mode
    )

    # Update progress
    prog_res = await db.execute(
        select(Progress).where(Progress.user_id == current_user.id, Progress.textbook_id == req.textbook_id)
    )
    prog = prog_res.scalar_one_or_none()
    if not prog:
        prog = Progress(user_id=current_user.id, textbook_id=req.textbook_id)
        db.add(prog)
    prog.summaries_generated = (prog.summaries_generated or 0) + 1
    current_user.xp_points = (current_user.xp_points or 0) + 3
    await db.commit()

    chapters_covered = list(set(c.chapter_title for c in chunks if c.chapter_title))
    pages_covered = sorted(set(c.page_num for c in chunks))

    return {
        "summary": summary,
        "chapter": req.chapter_title or "Full Textbook Overview",
        "chapters_covered": chapters_covered,
        "pages_covered": f"{pages_covered[0]}-{pages_covered[-1]}" if pages_covered else "",
        "chunks_used": len(chunks),
        "cost_usd": round(compute_cost(input_tok, output_tok), 6),
        "latency_ms": round(latency_ms, 1),
    }


@router.get("/chapters/{textbook_id}")
async def list_chapters(
    textbook_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return unique chapter titles from a textbook."""
    result = await db.execute(
        select(Chunk.chapter_title).where(Chunk.textbook_id == textbook_id).distinct()
    )
    chapters = [row[0] for row in result.fetchall() if row[0]]
    return {"chapters": chapters}
