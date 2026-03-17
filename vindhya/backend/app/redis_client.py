import json
import redis.asyncio as aioredis
from typing import List, Optional
from app.config import get_settings

settings = get_settings()

_redis: Optional[aioredis.Redis] = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(settings.redis_url, decode_responses=True)
    return _redis


# Chat memory — stores last 10 messages per user/textbook session
async def get_chat_history(user_id: int, textbook_id: int) -> List[dict]:
    r = await get_redis()
    key = f"chat:{user_id}:{textbook_id}"
    raw = await r.get(key)
    if raw:
        return json.loads(raw)
    return []


async def append_chat_message(user_id: int, textbook_id: int, role: str, content: str):
    r = await get_redis()
    key = f"chat:{user_id}:{textbook_id}"
    history = await get_chat_history(user_id, textbook_id)
    history.append({"role": role, "content": content})
    # Keep last 10 exchanges (20 messages)
    history = history[-20:]
    await r.setex(key, 86400, json.dumps(history))  # 24h TTL


async def clear_chat_history(user_id: int, textbook_id: int):
    r = await get_redis()
    await r.delete(f"chat:{user_id}:{textbook_id}")


# Response caching
async def cache_response(key: str, value: dict, ttl: int = 3600):
    r = await get_redis()
    await r.setex(f"cache:{key}", ttl, json.dumps(value))


async def get_cached_response(key: str) -> Optional[dict]:
    r = await get_redis()
    raw = await r.get(f"cache:{key}")
    return json.loads(raw) if raw else None


# Confusion tracker — if user asks same/similar question 3+ times, flag it
async def track_query(user_id: int, query_hash: str) -> int:
    r = await get_redis()
    key = f"confuse:{user_id}:{query_hash}"
    count = await r.incr(key)
    await r.expire(key, 86400)
    return count
