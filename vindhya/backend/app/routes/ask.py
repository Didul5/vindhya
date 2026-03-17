import asyncio
import hashlib
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text
from pydantic import BaseModel
from typing import Optional
from app.database import get_db, User, Chunk, Embedding, QueryLog, Progress
from app.auth import get_current_user
from app.embeddings import encode
from app.pruning import prune
from app.llm import answer_question, rewrite_query, compute_cost, highlight_concepts
from app.redis_client import (
    get_chat_history, append_chat_message, cache_response,
    get_cached_response, track_query
)
from app.config import get_settings

router = APIRouter()
settings = get_settings()


class AskRequest(BaseModel):
    query: str
    textbook_id: int
    use_pruning: bool = True


async def _retrieve_chunks(db: AsyncSession, textbook_id: int, query_embedding, top_k: int) -> list:
    """Vector similarity search using pgvector."""
    emb_list = query_embedding.tolist()
    sql = text("""
        SELECT c.id, c.content, c.page_num, c.chapter_title, c.token_count,
               1 - (e.embedding <=> CAST(:emb AS vector)) AS similarity
        FROM chunks c
        JOIN embeddings e ON e.chunk_id = c.id
        WHERE c.textbook_id = :tid
        ORDER BY e.embedding <=> CAST(:emb AS vector)
        LIMIT :k
    """)
    result = await db.execute(sql, {"emb": str(emb_list), "tid": textbook_id, "k": top_k})
    rows = result.fetchall()
    return [
        {
            "id": r.id,
            "content": r.content,
            "page_num": r.page_num,
            "chapter_title": r.chapter_title,
            "token_count": r.token_count,
            "similarity": float(r.similarity),
        }
        for r in rows
    ]


@router.post("/")
async def ask(
    req: AskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not req.query.strip():
        raise HTTPException(400, "Query cannot be empty")

    # Check cache (exact match)
    cache_key = hashlib.md5(f"{req.textbook_id}:{req.query}".encode()).hexdigest()
    cached = await get_cached_response(cache_key)
    if cached:
        return {**cached, "from_cache": True}

    # Detect repeated confusion
    query_hash = hashlib.md5(req.query.lower().strip().encode()).hexdigest()[:8]
    confusion_count = await track_query(current_user.id, query_hash)
    smart_doubt = confusion_count >= 3

    # Step 1: Rewrite vague query
    rewritten = await rewrite_query(req.query)

    # Step 2: Generate embedding (async via thread pool)
    loop = asyncio.get_event_loop()
    query_embedding = await loop.run_in_executor(None, encode, rewritten)

    # Step 3: Retrieve chunks
    retrieved = await _retrieve_chunks(db, req.textbook_id, query_embedding, settings.retrieval_top_k)
    if not retrieved:
        raise HTTPException(404, "No content found for this textbook. Make sure it finished processing.")

    # Step 4: Baseline token count (for comparison)
    baseline_tokens = sum(c["token_count"] for c in retrieved)

    # Step 5: Context pruning (or baseline)
    if req.use_pruning:
        pruned = prune(rewritten, retrieved, query_embedding)
        context = pruned.context
        pruned_tokens = pruned.pruned_tokens
        tokens_saved = pruned.tokens_saved
        reduction_pct = pruned.reduction_pct
        source_pages = pruned.source_pages
    else:
        # Baseline: use top-k as is
        context = "\n\n".join(c["content"] for c in retrieved[:10])
        pruned_tokens = baseline_tokens
        tokens_saved = 0
        reduction_pct = 0.0
        source_pages = list(set(c["page_num"] for c in retrieved[:10]))

    # Step 6: Get chat history for memory
    history = await get_chat_history(current_user.id, req.textbook_id)

    # Step 7: LLM call
    response, input_tok, output_tok, latency_ms = await answer_question(
        rewritten, context, history, current_user.low_bandwidth_mode
    )

    cost = compute_cost(input_tok, output_tok)
    cost_baseline = compute_cost(baseline_tokens + 200, output_tok)  # +200 for prompt overhead

    # Step 8: Save to chat history
    await append_chat_message(current_user.id, req.textbook_id, "user", req.query)
    await append_chat_message(current_user.id, req.textbook_id, "assistant", response)

    # Step 9: Log to DB
    log = QueryLog(
        user_id=current_user.id,
        textbook_id=req.textbook_id,
        query=req.query,
        rewritten_query=rewritten if rewritten != req.query else None,
        response=response[:2000],  # cap stored response size
        baseline_tokens=baseline_tokens,
        pruned_tokens=pruned_tokens,
        tokens_saved=tokens_saved,
        cost_baseline=cost_baseline,
        cost_pruned=cost,
        latency_ms=latency_ms,
        pruning_used=req.use_pruning,
        source_pages=",".join(map(str, source_pages)),
        reduction_pct=reduction_pct,
    )
    db.add(log)

    # XP: 5 points per question
    current_user.xp_points = (current_user.xp_points or 0) + 5
    await db.commit()

    # Update progress
    prog_result = await db.execute(
        select(Progress).where(Progress.user_id == current_user.id, Progress.textbook_id == req.textbook_id)
    )
    prog = prog_result.scalar_one_or_none()
    if not prog:
        prog = Progress(user_id=current_user.id, textbook_id=req.textbook_id)
        db.add(prog)
    prog.questions_asked = (prog.questions_asked or 0) + 1
    await db.commit()

    result = {
        "response": response,
        "rewritten_query": rewritten if rewritten != req.query else None,
        "source_pages": source_pages,
        "stats": {
            "baseline_tokens": baseline_tokens,
            "pruned_tokens": pruned_tokens,
            "tokens_saved": tokens_saved,
            "reduction_pct": reduction_pct,
            "cost_pruned_usd": round(cost, 6),
            "cost_baseline_usd": round(cost_baseline, 6),
            "latency_ms": round(latency_ms, 1),
        },
        "smart_doubt_detected": smart_doubt,
        "from_cache": False,
    }

    # Cache for 1 hour
    await cache_response(cache_key, result, ttl=3600)
    return result


@router.get("/history/{textbook_id}")
async def get_history(
    textbook_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    history = await get_chat_history(current_user.id, textbook_id)
    return {"history": history}


@router.delete("/history/{textbook_id}")
async def clear_history(
    textbook_id: int,
    current_user: User = Depends(get_current_user),
):
    from app.redis_client import clear_chat_history
    await clear_chat_history(current_user.id, textbook_id)
    return {"message": "Chat history cleared"}


@router.post("/concepts")
async def get_concepts(
    req: AskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Highlight important concepts from the most relevant context."""
    loop = asyncio.get_event_loop()
    query_embedding = await loop.run_in_executor(None, encode, req.query)
    retrieved = await _retrieve_chunks(db, req.textbook_id, query_embedding, 5)
    if not retrieved:
        raise HTTPException(404, "No content found")

    context = "\n".join(c["content"] for c in retrieved[:3])
    result, _, _, _ = await highlight_concepts(context)

    import json
    try:
        return json.loads(result)
    except Exception:
        return {"raw": result}
