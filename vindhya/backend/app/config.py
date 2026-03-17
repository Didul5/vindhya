from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://vindhya:vindhya123@localhost:5433/vindhya"
    redis_url: str = "redis://localhost:6380"
    groq_api_key: str = ""  # Set via GROQ_API_KEY environment variable or .env file
    jwt_secret: str = "supersecretkey-change-in-production"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 10080  # 7 days
    upload_dir: str = "./uploads"
    max_file_size_mb: int = 50

    # Groq model
    llm_model: str = "llama-3.3-70b-versatile"

    # Pricing (USD per million tokens) - Groq Llama 3.3 70B
    input_price_per_mtok: float = 0.59
    output_price_per_mtok: float = 0.79

    # Context pruning settings
    retrieval_top_k: int = 20       # chunks retrieved for baseline
    pruned_top_k: int = 6           # target chunks after pruning
    max_context_tokens: int = 2000  # hard token budget for context
    chunk_size: int = 400           # words per chunk
    chunk_overlap: int = 50         # word overlap between chunks

    class Config:
        env_file = ".env"


@lru_cache
def get_settings() -> Settings:
    return Settings()
