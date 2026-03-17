from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database import get_db, User, QueryLog, Progress, Textbook
from app.auth import get_current_user

router = APIRouter()


@router.get("/")
async def get_progress(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Aggregate query stats
    logs_result = await db.execute(
        select(
            func.count(QueryLog.id).label("total_queries"),
            func.sum(QueryLog.tokens_saved).label("total_tokens_saved"),
            func.sum(QueryLog.cost_baseline - QueryLog.cost_pruned).label("total_cost_saved"),
            func.avg(QueryLog.latency_ms).label("avg_latency"),
        ).where(QueryLog.user_id == current_user.id)
    )
    log_stats = logs_result.one()
    # total_tokens_saved, cost_saved, avg_latency may be None if no queries yet

    # Per-textbook progress
    prog_result = await db.execute(
        select(Progress, Textbook).join(Textbook, Progress.textbook_id == Textbook.id)
        .where(Progress.user_id == current_user.id)
    )
    prog_rows = prog_result.all()

    textbook_progress = [
        {
            "textbook_id": row.Progress.textbook_id,
            "textbook_title": row.Textbook.title,
            "quizzes_taken": row.Progress.quizzes_taken,
            "avg_score": round(row.Progress.avg_score or 0, 1),
            "questions_asked": row.Progress.questions_asked,
            "summaries_generated": row.Progress.summaries_generated,
        }
        for row in prog_rows
    ]

    # Recent query history (last 10)
    recent_result = await db.execute(
        select(QueryLog)
        .where(QueryLog.user_id == current_user.id)
        .order_by(QueryLog.created_at.desc())
        .limit(10)
    )
    recent = recent_result.scalars().all()
    recent_queries = [
        {
            "id": q.id,
            "query": q.query[:80],
            "tokens_saved": q.tokens_saved,
            "cost_pruned": round(q.cost_pruned, 6),
            "latency_ms": round(q.latency_ms, 1),
            "created_at": q.created_at.isoformat() if q.created_at else None,
        }
        for q in recent
    ]

    return {
        "user": {
            "name": current_user.name,
            "xp_points": current_user.xp_points,
            "streak_days": current_user.streak_days,
        },
        "stats": {
            "total_queries": log_stats.total_queries or 0,
            "total_tokens_saved": int(log_stats.total_tokens_saved or 0),
            "total_cost_saved_usd": round(float(log_stats.total_cost_saved or 0), 4),
            "avg_latency_ms": round(float(log_stats.avg_latency or 0), 1),
        },
        "textbook_progress": textbook_progress,
        "recent_queries": recent_queries,
    }


@router.get("/cost-comparison")
async def cost_comparison(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return data for the baseline vs pruned comparison chart."""
    result = await db.execute(
        select(QueryLog)
        .where(QueryLog.user_id == current_user.id)
        .order_by(QueryLog.created_at.desc())
        .limit(20)
    )
    logs = result.scalars().all()

    comparison = [
        {
            "query": q.query[:40] + "..." if len(q.query) > 40 else q.query,
            "baseline_tokens": q.baseline_tokens,
            "pruned_tokens": q.pruned_tokens,
            "tokens_saved": q.tokens_saved,
            "cost_baseline": round(q.cost_baseline, 6),
            "cost_pruned": round(q.cost_pruned, 6),
            "latency_ms": round(q.latency_ms, 1),
            "date": q.created_at.isoformat() if q.created_at else None,
        }
        for q in logs
    ]

    return {"comparison": comparison}
