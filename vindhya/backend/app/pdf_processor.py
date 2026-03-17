"""
PDF ingestion pipeline:
  1. Extract text page by page via pdfplumber
  2. Detect chapter boundaries (heuristic: bold/large text or "Chapter X")
  3. Split into overlapping word-level chunks
  4. Count tokens with tiktoken
"""
import re
import pdfplumber
import tiktoken
from dataclasses import dataclass
from typing import List
from app.config import get_settings

settings = get_settings()
_tokenizer = tiktoken.get_encoding("cl100k_base")


@dataclass
class RawChunk:
    content: str
    page_num: int
    chapter_title: str
    chunk_index: int
    token_count: int


def count_tokens(text: str) -> int:
    return len(_tokenizer.encode(text))


def _detect_chapter(line: str) -> bool:
    line = line.strip()
    return bool(re.match(r"^(chapter|unit|section|module)\s+\d+", line, re.IGNORECASE))


def extract_and_chunk(pdf_path: str) -> tuple[List[RawChunk], int]:
    """
    Returns (list of chunks, total_pages).
    Chunks are ~400 words with 50-word overlap.
    """
    chunks: List[RawChunk] = []
    current_chapter = "Introduction"
    chunk_size = settings.chunk_size
    overlap = settings.chunk_overlap

    all_pages: List[tuple[int, str]] = []

    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        for page_num, page in enumerate(pdf.pages, start=1):
            text = page.extract_text() or ""
            if text.strip():
                all_pages.append((page_num, text))

    # Flatten all text while tracking page numbers
    words_with_meta: List[tuple[str, int, str]] = []  # (word, page, chapter)
    for page_num, text in all_pages:
        lines = text.split("\n")
        for line in lines:
            if _detect_chapter(line):
                current_chapter = line.strip()
            for word in line.split():
                words_with_meta.append((word, page_num, current_chapter))

    # Sliding window chunking
    chunk_index = 0
    i = 0
    while i < len(words_with_meta):
        window = words_with_meta[i: i + chunk_size]
        if not window:
            break

        words = [w[0] for w in window]
        # Use the most common page/chapter in this window
        pages = [w[1] for w in window]
        chapters = [w[2] for w in window]
        page_num = max(set(pages), key=pages.count)
        chapter = max(set(chapters), key=chapters.count)

        content = " ".join(words)
        token_count = count_tokens(content)

        chunks.append(RawChunk(
            content=content,
            page_num=page_num,
            chapter_title=chapter,
            chunk_index=chunk_index,
            token_count=token_count,
        ))
        chunk_index += 1
        i += (chunk_size - overlap)

    return chunks, total_pages
