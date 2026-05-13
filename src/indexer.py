from __future__ import annotations
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .config import DOCS_ROOT, EXCLUDE_DIRS
from .chunker import chunk_file
from .embedder import Embedder
from .es_client import bulk_index, indexed_paths


def discover_markdown(root: Path) -> list[tuple[str, Path]]:
    found: list[tuple[str, Path]] = []
    for p in root.rglob("*.md"):
        if any(part in EXCLUDE_DIRS for part in p.relative_to(root).parts):
            continue
        rel = p.relative_to(root).as_posix()
        found.append((rel, p))
    return sorted(found)


def reindex_new(es, embedder: Embedder) -> dict[str, Any]:
    existing = indexed_paths(es)
    all_files = discover_markdown(DOCS_ROOT)
    new_files = [(rel, p) for rel, p in all_files if rel not in existing]

    now = datetime.now(timezone.utc).isoformat()
    chunks_added = 0
    docs_with_chunks = 0
    chunk_docs: list[dict[str, Any]] = []

    for rel, abs_p in new_files:
        file_chunks = chunk_file(rel, abs_p)
        if not file_chunks:
            continue
        docs_with_chunks += 1
        for chunk in file_chunks:
            vec = embedder.embed(chunk.body)
            chunk_docs.append(
                {
                    "chunk_id": chunk.chunk_id,
                    "path": chunk.path,
                    "folder": chunk.folder,
                    "title": chunk.title,
                    "body": chunk.body,
                    "tags": chunk.tags,
                    "embedding": vec,
                    "indexed_at": now,
                }
            )
        if len(chunk_docs) >= 50:
            chunks_added += bulk_index(es, chunk_docs)
            chunk_docs = []

    if chunk_docs:
        chunks_added += bulk_index(es, chunk_docs)

    return {
        "scanned": len(all_files),
        "new": docs_with_chunks,
        "chunks_added": chunks_added,
        "skipped": len(all_files) - docs_with_chunks,
        "indexed_at": now,
    }
