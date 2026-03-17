"""
Embedding generation using sentence-transformers (free, local).
Model: all-MiniLM-L6-v2 — 384 dimensions, fast, good quality.
"""
from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List

_model: SentenceTransformer = None


def get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def encode(texts: List[str] | str) -> np.ndarray:
    """Encode text(s) into 384-dim vectors. Returns shape (N, 384) or (384,)."""
    model = get_model()
    if isinstance(texts, str):
        return model.encode(texts, normalize_embeddings=True)
    if not texts:
        return np.empty((0, 384), dtype=np.float32)
    return model.encode(texts, batch_size=32, normalize_embeddings=True, show_progress_bar=False)


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    """Cosine similarity between two normalized vectors (dot product is enough)."""
    return float(np.dot(a, b))
