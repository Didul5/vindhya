import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI

logger = logging.getLogger("vindhya")
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.database import init_db
from app.config import get_settings
from app.routes import auth, textbooks, ask, quiz, summaries, progress, evaluate, voice, gamification

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: initialize DB and preload embedding model
    try:
        await init_db()
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database init failed: {e} — app will start but DB calls may fail")
    try:
        from app.embeddings import get_model
        get_model()  # warm up — downloads model if not cached
    except Exception as e:
        logger.error(f"Embedding model load failed: {e}")
    os.makedirs(settings.upload_dir, exist_ok=True)
    yield
    # Shutdown: nothing special needed


app = FastAPI(
    title="Vindhya API",
    description="Voice-enabled Intelligent Network for Dynamic Holistic Youth Advancement",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount static files for uploaded content
if os.path.isdir(settings.upload_dir):
    app.mount("/uploads", StaticFiles(directory=settings.upload_dir), name="uploads")

# Register all routers
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(textbooks.router, prefix="/api/textbooks", tags=["textbooks"])
app.include_router(ask.router, prefix="/api/ask", tags=["ask"])
app.include_router(quiz.router, prefix="/api/quiz", tags=["quiz"])
app.include_router(summaries.router, prefix="/api/summaries", tags=["summaries"])
app.include_router(progress.router, prefix="/api/progress", tags=["progress"])
app.include_router(evaluate.router, prefix="/api/evaluate", tags=["evaluate"])
app.include_router(voice.router, prefix="/api/voice", tags=["voice"])
app.include_router(gamification.router, prefix="/api/gamification", tags=["gamification"])


@app.get("/api/health")
async def health():
    return {"status": "ok", "model": settings.llm_model}
