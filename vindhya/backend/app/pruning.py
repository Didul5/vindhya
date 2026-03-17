"""
Context Pruning Pipeline — the core differentiator of Vindhya.

Baseline RAG:
  - Retrieve top-20 chunks → concatenate → send to LLM
  - ~4000 tokens of context

Context-Pruned RAG (this module):
  - Retrieve top-20 chunks
  - Score by semantic similarity + keyword overlap
  - Remove redundant chunks with MMR
  - Trim to token budget (2000 tokens)
  - Result: ~6 chunks, ~1200 tokens

Typical savings: 60-70% reduction in context tokens.
"""

import re
import math
import numpy as np
from dataclasses import dataclass
from typing import List
from app.embeddings import cosine_similarity, encode
from app.pdf_processor import count_tokens
from app.config import get_settings

settings = get_settings()


@dataclass
class ScoredChunk:
    chunk_id: int
    content: str
    page_num: int
    chapter_title: str
    token_count: int
    semantic_score: float
    keyword_score: float
    final_score: float


@dataclass
class PrunedContext:
    context: str
    chunks_used: List[ScoredChunk]
    baseline_tokens: int   # tokens if we used all retrieved chunks
    pruned_tokens: int     # tokens actually sent
    tokens_saved: int
    reduction_pct: float
    source_pages: List[int]


def _keyword_score(query: str, content: str) -> float:
    """BM25-inspired keyword overlap score."""
    query_words = set(re.findall(r'\b\w{3,}\b', query.lower()))
    content_words = re.findall(r'\b\w{3,}\b', content.lower())
    if not query_words or not content_words:
        return 0.0

    content_freq: dict = {}
    for w in content_words:
        content_freq[w] = content_freq.get(w, 0) + 1

    total = len(content_words)
    score = 0.0
    k1, b = 1.5, 0.75
    avg_dl = 200  # approximate average doc length

    for word in query_words:
        if word in content_freq:
            tf = content_freq[word]
            idf = math.log(2 / (1 + 0))  # simplified, single doc
            numerator = tf * (k1 + 1)
            denominator = tf + k1 * (1 - b + b * total / avg_dl)
            score += idf * numerator / denominator

    return min(score / len(query_words), 1.0)


def _mmr(
    candidates: List[ScoredChunk],
    query_embedding: np.ndarray,
    chunk_embeddings: List[np.ndarray],
    lambda_param: float = 0.6,
    k: int = None,
) -> List[ScoredChunk]:
    """
    Maximal Marginal Relevance — picks diverse chunks.
    lambda=0.6 balances relevance vs diversity.
    """
    if k is None:
        k = settings.pruned_top_k

    selected_indices = []
    remaining = list(range(len(candidates)))

    while len(selected_indices) < k and remaining:
        best_idx = None
        best_score = -999

        for i in remaining:
            relevance = cosine_similarity(query_embedding, chunk_embeddings[i])
            if not selected_indices:
                redundancy = 0
            else:
                sims_to_selected = [
                    cosine_similarity(chunk_embeddings[i], chunk_embeddings[j])
                    for j in selected_indices
                ]
                redundancy = max(sims_to_selected)

            mmr_score = lambda_param * relevance - (1 - lambda_param) * redundancy
            if mmr_score > best_score:
                best_score = mmr_score
                best_idx = i

        if best_idx is not None:
            selected_indices.append(best_idx)
            remaining.remove(best_idx)

    return [candidates[i] for i in selected_indices]


def prune(
    query: str,
    retrieved_chunks: List[dict],   # list of {id, content, page_num, chapter_title, token_count}
    query_embedding: np.ndarray,
) -> PrunedContext:
    """
    Full pruning pipeline.
    retrieved_chunks should be the top-k from vector DB (baseline set).
    """
    if not retrieved_chunks:
        return PrunedContext("", [], 0, 0, 0, 0.0, [])

    # Baseline token count
    baseline_tokens = sum(c["token_count"] for c in retrieved_chunks)

    # Step 1: Score each chunk (semantic + keyword)
    chunk_contents = [c["content"] for c in retrieved_chunks]
    chunk_embeddings = [encode(content) for content in chunk_contents]

    scored: List[ScoredChunk] = []
    for i, chunk in enumerate(retrieved_chunks):
        sem_score = cosine_similarity(query_embedding, chunk_embeddings[i])
        kw_score = _keyword_score(query, chunk["content"])
        final = 0.65 * sem_score + 0.35 * kw_score

        scored.append(ScoredChunk(
            chunk_id=chunk["id"],
            content=chunk["content"],
            page_num=chunk["page_num"],
            chapter_title=chunk["chapter_title"],
            token_count=chunk["token_count"],
            semantic_score=sem_score,
            keyword_score=kw_score,
            final_score=final,
        ))

    # Step 2: Pre-filter — keep top 10 by score before MMR
    scored.sort(key=lambda x: x.final_score, reverse=True)
    top_scored = scored[:10]
    top_embeddings = [chunk_embeddings[scored.index(s)] for s in top_scored]

    # Step 3: MMR for diversity
    diverse = _mmr(top_scored, query_embedding, top_embeddings, lambda_param=0.6)

    # Step 4: Token budget trimming
    final_chunks: List[ScoredChunk] = []
    token_budget = settings.max_context_tokens
    used_tokens = 0

    for chunk in diverse:
        if used_tokens + chunk.token_count <= token_budget:
            final_chunks.append(chunk)
            used_tokens += chunk.token_count
        elif not final_chunks:
            # Always include at least one chunk (truncate if needed)
            final_chunks.append(chunk)
            used_tokens += chunk.token_count
            break

    # Build context string with source references
    context_parts = []
    source_pages = []
    for chunk in final_chunks:
        header = f"[Page {chunk.page_num} | {chunk.chapter_title}]"
        context_parts.append(f"{header}\n{chunk.content}")
        source_pages.append(chunk.page_num)

    context = "\n\n---\n\n".join(context_parts)
    pruned_tokens = count_tokens(context)
    tokens_saved = baseline_tokens - pruned_tokens
    reduction_pct = (tokens_saved / baseline_tokens * 100) if baseline_tokens > 0 else 0

    return PrunedContext(
        context=context,
        chunks_used=final_chunks,
        baseline_tokens=baseline_tokens,
        pruned_tokens=pruned_tokens,
        tokens_saved=tokens_saved,
        reduction_pct=round(reduction_pct, 1),
        source_pages=sorted(set(source_pages)),
    )
