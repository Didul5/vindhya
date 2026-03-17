"""
Voice route — handles transcribed text from the browser's Web Speech API.
The actual speech-to-text happens client-side (free, no API needed).
This endpoint processes the transcription as a regular ask request.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.database import get_db, User
from app.auth import get_current_user
from sqlalchemy.ext.asyncio import AsyncSession
from app.routes.ask import ask, AskRequest

router = APIRouter()


class VoiceAskRequest(BaseModel):
    transcription: str
    textbook_id: int
    use_pruning: bool = True


@router.post("/ask")
async def voice_ask(
    req: VoiceAskRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Process a voice query (already transcribed client-side)."""
    return await ask(
        AskRequest(query=req.transcription, textbook_id=req.textbook_id, use_pruning=req.use_pruning),
        current_user=current_user,
        db=db,
    )
