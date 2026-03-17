from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase, relationship
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Float, DateTime,
    ForeignKey, BigInteger, func
)
from pgvector.sqlalchemy import Vector
from app.config import get_settings
import asyncio

settings = get_settings()


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    email = Column(String(255), unique=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    name = Column(String(255), default="Student")
    xp_points = Column(Integer, default=0)
    streak_days = Column(Integer, default=0)
    last_active = Column(DateTime, default=func.now())
    low_bandwidth_mode = Column(Boolean, default=False)
    created_at = Column(DateTime, default=func.now())

    textbooks = relationship("Textbook", back_populates="user", lazy="selectin")
    query_logs = relationship("QueryLog", back_populates="user", lazy="selectin")


class Textbook(Base):
    __tablename__ = "textbooks"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(500), nullable=False)
    filename = Column(String(500))
    total_pages = Column(Integer, default=0)
    file_size = Column(BigInteger, default=0)
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="textbooks")
    chunks = relationship("Chunk", back_populates="textbook", lazy="selectin")


class Chunk(Base):
    __tablename__ = "chunks"
    id = Column(Integer, primary_key=True)
    textbook_id = Column(Integer, ForeignKey("textbooks.id"), nullable=False)
    content = Column(Text, nullable=False)
    page_num = Column(Integer, default=0)
    chapter_title = Column(String(500), default="")
    chunk_index = Column(Integer, default=0)
    token_count = Column(Integer, default=0)

    textbook = relationship("Textbook", back_populates="chunks")
    embedding = relationship("Embedding", back_populates="chunk", uselist=False, lazy="selectin")


class Embedding(Base):
    __tablename__ = "embeddings"
    id = Column(Integer, primary_key=True)
    chunk_id = Column(Integer, ForeignKey("chunks.id"), nullable=False)
    embedding = Column(Vector(384))  # all-MiniLM-L6-v2 dimension

    chunk = relationship("Chunk", back_populates="embedding")


class QueryLog(Base):
    __tablename__ = "query_logs"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    textbook_id = Column(Integer, ForeignKey("textbooks.id"), nullable=True)
    query = Column(Text, nullable=False)
    rewritten_query = Column(Text)
    response = Column(Text)
    baseline_tokens = Column(Integer, default=0)
    pruned_tokens = Column(Integer, default=0)
    tokens_saved = Column(Integer, default=0)
    cost_baseline = Column(Float, default=0.0)
    cost_pruned = Column(Float, default=0.0)
    latency_ms = Column(Float, default=0.0)
    pruning_used = Column(Boolean, default=True)
    reduction_pct = Column(Float, default=0.0)
    source_pages = Column(String(500), default="")
    created_at = Column(DateTime, default=func.now())

    user = relationship("User", back_populates="query_logs")


class Badge(Base):
    __tablename__ = "badges"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    badge_name = Column(String(100), nullable=False)
    description = Column(String(500))
    earned_at = Column(DateTime, default=func.now())


class Progress(Base):
    __tablename__ = "progress"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    textbook_id = Column(Integer, ForeignKey("textbooks.id"), nullable=False)
    quizzes_taken = Column(Integer, default=0)
    avg_score = Column(Float, default=0.0)
    questions_asked = Column(Integer, default=0)
    summaries_generated = Column(Integer, default=0)
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


# DB engine setup
engine = create_async_engine(settings.database_url, echo=False, pool_size=10, max_overflow=20)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db():
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    """Create tables and extensions on startup."""
    async with engine.begin() as conn:
        # pgvector extension
        await conn.execute(
            __import__("sqlalchemy").text("CREATE EXTENSION IF NOT EXISTS vector")
        )
        await conn.run_sync(Base.metadata.create_all)
