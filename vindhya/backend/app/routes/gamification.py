from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from datetime import datetime, date
from app.database import get_db, User, Badge, QueryLog
from app.auth import get_current_user

router = APIRouter()

BADGE_RULES = [
    ("First Step", "Asked your first question", lambda queries, quizzes, xp: queries >= 1),
    ("Curious Mind", "Asked 10 questions", lambda q, qz, xp: q >= 10),
    ("Knowledge Seeker", "Asked 50 questions", lambda q, qz, xp: q >= 50),
    ("Quiz Rookie", "Completed your first quiz", lambda q, qz, xp: qz >= 1),
    ("Quiz Champion", "Completed 10 quizzes", lambda q, qz, xp: qz >= 10),
    ("XP Hunter", "Earned 100 XP", lambda q, qz, xp: xp >= 100),
    ("Scholar", "Earned 500 XP", lambda q, qz, xp: xp >= 500),
]


def _xp_level(xp: int) -> dict:
    levels = [
        (0, "Beginner"), (100, "Explorer"), (300, "Learner"),
        (600, "Scholar"), (1000, "Expert"), (2000, "Master"),
    ]
    current_level = "Beginner"
    next_threshold = 100
    for threshold, name in levels:
        if xp >= threshold:
            current_level = name
        else:
            next_threshold = threshold
            break
    return {"level": current_level, "next_at": next_threshold, "progress_pct": min(int(xp / next_threshold * 100), 100)}


@router.get("/stats")
async def gamification_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Total queries and quizzes
    from sqlalchemy import func
    from app.database import Progress

    log_count = await db.execute(
        select(func.count(QueryLog.id)).where(QueryLog.user_id == current_user.id)
    )
    total_queries = log_count.scalar() or 0

    prog_result = await db.execute(
        select(func.sum(Progress.quizzes_taken)).where(Progress.user_id == current_user.id)
    )
    total_quizzes = prog_result.scalar() or 0

    xp = current_user.xp_points or 0

    # Check and award new badges
    existing_badges = await db.execute(
        select(Badge.badge_name).where(Badge.user_id == current_user.id)
    )
    earned_names = {row[0] for row in existing_badges.fetchall()}

    new_badges = []
    for badge_name, description, rule in BADGE_RULES:
        if badge_name not in earned_names and rule(total_queries, total_quizzes, xp):
            badge = Badge(user_id=current_user.id, badge_name=badge_name, description=description)
            db.add(badge)
            new_badges.append({"name": badge_name, "description": description})

    if new_badges:
        await db.commit()

    # All badges
    all_badges_result = await db.execute(
        select(Badge).where(Badge.user_id == current_user.id)
    )
    all_badges = all_badges_result.scalars().all()

    # Update streak
    today = date.today()
    last_active = current_user.last_active
    if last_active:
        last_date = last_active.date() if hasattr(last_active, 'date') else last_active
        if last_date == today:
            streak = current_user.streak_days or 0
        elif (today - last_date).days == 1:
            streak = (current_user.streak_days or 0) + 1
        else:
            streak = 1
    else:
        streak = 1

    current_user.streak_days = streak
    current_user.last_active = datetime.now()
    await db.commit()

    level_info = _xp_level(xp)

    return {
        "xp": xp,
        "streak_days": streak,
        "level": level_info["level"],
        "next_level_at": level_info["next_at"],
        "level_progress_pct": level_info["progress_pct"],
        "total_queries": total_queries,
        "total_quizzes": int(total_quizzes),
        "badges": [
            {
                "name": b.badge_name,
                "description": b.description,
                "earned_at": b.earned_at.isoformat() if b.earned_at else None,
            }
            for b in all_badges
        ],
        "new_badges": new_badges,
    }
