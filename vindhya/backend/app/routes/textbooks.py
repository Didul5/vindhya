import os
import asyncio
import logging
from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException, BackgroundTasks

logger = logging.getLogger(__name__)
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db, User, Textbook, Chunk, Embedding
from app.auth import get_current_user
from app.pdf_processor import extract_and_chunk
from app.embeddings import encode
from app.config import get_settings

router = APIRouter()
settings = get_settings()


async def _ingest_pdf(textbook_id: int, pdf_path: str, db_url: str):
    """Background task: chunk PDF and generate embeddings."""
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
    engine = create_async_engine(db_url)
    Session = async_sessionmaker(engine, expire_on_commit=False)

    logger.info(f"[ingest] Starting PDF extraction for textbook_id={textbook_id}")
    chunks, total_pages = extract_and_chunk(pdf_path)
    logger.info(f"[ingest] Extracted {len(chunks)} chunks from {total_pages} pages")

    async with Session() as session:
        result = await session.execute(select(Textbook).where(Textbook.id == textbook_id))
        textbook = result.scalar_one_or_none()
        if textbook:
            textbook.total_pages = total_pages
            await session.commit()

        if not chunks:
            logger.warning(f"[ingest] No text extracted from PDF — may be a scanned/image PDF")
            await engine.dispose()
            return

        contents = [c.content for c in chunks]
        logger.info(f"[ingest] Generating embeddings for {len(contents)} chunks (this takes a while on CPU)...")
        loop = asyncio.get_running_loop()
        embeddings = await loop.run_in_executor(None, encode, contents)
        logger.info(f"[ingest] Embeddings done. Saving to DB...")

        for i, (raw_chunk, emb) in enumerate(zip(chunks, embeddings)):
            db_chunk = Chunk(
                textbook_id=textbook_id,
                content=raw_chunk.content,
                page_num=raw_chunk.page_num,
                chapter_title=raw_chunk.chapter_title,
                chunk_index=raw_chunk.chunk_index,
                token_count=raw_chunk.token_count,
            )
            session.add(db_chunk)
            await session.flush()  # get db_chunk.id

            db_emb = Embedding(chunk_id=db_chunk.id, embedding=emb.tolist())
            session.add(db_emb)

            if i % 50 == 0:
                await session.commit()

        await session.commit()
        logger.info(f"[ingest] ✓ Textbook {textbook_id} fully ingested.")

    await engine.dispose()


@router.post("/upload")
async def upload_textbook(
    background_tasks: BackgroundTasks,
    title: str = Form(...),
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not file.filename.endswith(".pdf"):
        raise HTTPException(400, "Only PDF files supported")

    content = await file.read()
    if len(content) > settings.max_file_size_mb * 1024 * 1024:
        raise HTTPException(400, f"File too large. Max {settings.max_file_size_mb}MB")

    # Save file
    os.makedirs(settings.upload_dir, exist_ok=True)
    safe_name = f"{current_user.id}_{file.filename.replace(' ', '_')}"
    pdf_path = os.path.join(settings.upload_dir, safe_name)
    with open(pdf_path, "wb") as f:
        f.write(content)

    # Create textbook record
    textbook = Textbook(
        user_id=current_user.id,
        title=title,
        filename=safe_name,
        file_size=len(content),
    )
    db.add(textbook)
    await db.commit()
    await db.refresh(textbook)

    # Start background ingestion
    background_tasks.add_task(_ingest_pdf, textbook.id, pdf_path, settings.database_url)

    return {"id": textbook.id, "title": textbook.title, "status": "processing"}


@router.get("/")
async def list_textbooks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Textbook).where(Textbook.user_id == current_user.id))
    books = result.scalars().all()
    return [
        {
            "id": b.id,
            "title": b.title,
            "total_pages": b.total_pages,
            "file_size": b.file_size,
            "created_at": b.created_at.isoformat() if b.created_at else None,
            "chunk_count": len(b.chunks),
        }
        for b in books
    ]


@router.delete("/{textbook_id}")
async def delete_textbook(
    textbook_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Textbook).where(Textbook.id == textbook_id, Textbook.user_id == current_user.id)
    )
    book = result.scalar_one_or_none()
    if not book:
        raise HTTPException(404, "Textbook not found")

    await db.delete(book)
    await db.commit()
    return {"message": "Deleted"}
