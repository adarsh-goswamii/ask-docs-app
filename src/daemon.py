from __future__ import annotations
from contextlib import asynccontextmanager
from typing import Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from .config import INDEX_NAME
from .es_client import (
    get_client,
    create_index,
    knn_search,
    bm25_search,
    fuzzy_search,
)
from .embedder import Embedder
from .indexer import reindex_new


class SearchRequest(BaseModel):
    query: str = Field(..., min_length=1)
    tags: list[str] | None = None
    folder: str | None = None
    top_k: int = Field(5, ge=1, le=50)


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.es = get_client()
    app.state.embedder = Embedder()
    try:
        create_index(app.state.es)
    except Exception as e:
        print(f"[daemon] warning: create_index failed (ES may not be up yet): {e}")
    yield
    app.state.embedder.close()
    app.state.es.close()


app = FastAPI(title="docs-rag daemon", lifespan=lifespan)


@app.get("/health")
def health():
    es = app.state.es
    embedder: Embedder = app.state.embedder
    try:
        cluster = es.cluster.health()
        es_status = cluster.get("status", "unknown")
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"elasticsearch unreachable: {e}")
    if not embedder.ping():
        raise HTTPException(status_code=503, detail="ollama unreachable")
    return {"es": es_status, "ollama": "ready", "index": INDEX_NAME}


@app.post("/reindex")
def reindex():
    es = app.state.es
    create_index(es)
    try:
        result = reindex_new(es, app.state.embedder)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"reindex failed: {e}")
    return result


@app.post("/admin/wipe")
def wipe():
    es = app.state.es
    try:
        if es.indices.exists(index=INDEX_NAME):
            es.indices.delete(index=INDEX_NAME)
        create_index(es)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"wipe failed: {e}")
    return {"wiped": True, "index": INDEX_NAME}


@app.post("/search/rag")
def search_rag(req: SearchRequest) -> list[dict[str, Any]]:
    """Semantic (vector kNN) search. Best for paraphrased or conceptual queries."""
    vec = app.state.embedder.embed(req.query)
    return knn_search(app.state.es, vec, top_k=req.top_k, tags=req.tags, folder=req.folder)


@app.post("/search/keyword")
def search_keyword(req: SearchRequest) -> list[dict[str, Any]]:
    """BM25 keyword search. Best for exact terms, identifiers, proper nouns."""
    return bm25_search(app.state.es, req.query, top_k=req.top_k, tags=req.tags, folder=req.folder)


@app.post("/search/fuzzy")
def search_fuzzy(req: SearchRequest) -> list[dict[str, Any]]:
    """Typo-tolerant fuzzy search. Best when the query may be misspelled."""
    return fuzzy_search(app.state.es, req.query, top_k=req.top_k, tags=req.tags, folder=req.folder)


@app.get("/stats")
def stats():
    es = app.state.es
    if not es.indices.exists(index=INDEX_NAME):
        return {"docs_indexed": 0, "chunks_indexed": 0}
    count = es.count(index=INDEX_NAME)["count"]
    agg = es.search(
        index=INDEX_NAME,
        body={
            "size": 0,
            "aggs": {"unique_paths": {"cardinality": {"field": "path"}}},
        },
    )
    docs = agg["aggregations"]["unique_paths"]["value"]
    return {"docs_indexed": docs, "chunks_indexed": count}
