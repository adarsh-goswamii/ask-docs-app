from pathlib import Path
import os

DOCS_ROOT = Path(os.environ.get("DOCS_ROOT", "/Users/adarsh.consultant/Documents/docs")).resolve()

ES_URL = os.environ.get("ES_URL", "http://127.0.0.1:9200")
INDEX_NAME = os.environ.get("INDEX_NAME", "docs")

OLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434")
EMBED_MODEL = os.environ.get("EMBED_MODEL", "nomic-embed-text")
EMBED_DIMS = int(os.environ.get("EMBED_DIMS", "768"))

DAEMON_URL = os.environ.get("DAEMON_URL", "http://127.0.0.1:8000")

# Dirs skipped by the RAG indexer (kept out of search).
EXCLUDE_DIRS = {".rag", ".obsidian", ".git", "node_modules", "_tags", ".claude"}

# Dirs hidden from the file browser/tree. `_tags` stays visible: it holds the
# tag hub files that wiki-links ([[okta]] -> _tags/okta.md) resolve to.
LIST_EXCLUDE_DIRS = EXCLUDE_DIRS - {"_tags"}

SUPPORTED_EXTENSIONS = frozenset({".md", ".svg"})

CHUNK_MAX_CHARS = 800
SNIPPET_CHARS = 600
