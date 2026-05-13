from __future__ import annotations
import os
from typing import Any

from mcp.server.fastmcp import FastMCP

from .embedder import Embedder
from .es_client import (
    get_client,
    bm25_search as _bm25,
    fuzzy_search as _fuzzy,
    knn_search as _knn,
)

_HTTP_PORT = int(os.environ.get("MCP_HTTP_PORT", "8001"))
mcp = FastMCP("docs-rag", host="0.0.0.0", port=_HTTP_PORT)

_es = get_client()
_embedder = Embedder()


def _opt_list(value: Any) -> list[str] | None:
    if value is None:
        return None
    if isinstance(value, str):
        return [value] if value else None
    return list(value) or None


@mcp.tool()
def rag_search(
    query: str,
    tags: list[str] | None = None,
    folder: str | None = None,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """Semantic (vector) search over the docs vault.

    Use for conceptual, paraphrased, or "what do my docs say about X" queries
    where the user's wording may not match the exact terms in the docs.
    Examples: "how do we think about brand voice", "what is our position on
    long-term investing", "explain the IC meeting workflow".

    Args:
        query: Natural-language question or topic.
        tags: Optional list of wiki-tag names (without brackets) to filter by,
            e.g. ["branding", "voice-and-tone"]. Matches docs that contain ANY
            of these tags.
        folder: Optional top-level folder name to restrict search to,
            e.g. "PeakXV-Branding" or "trm".
        top_k: How many results to return (default 5).

    Returns:
        List of hits, each with: path, title, folder, tags, snippet, score.
    """
    vec = _embedder.embed(query)
    return _knn(_es, vec, top_k=top_k, tags=_opt_list(tags), folder=folder)


@mcp.tool()
def keyword_search(
    query: str,
    tags: list[str] | None = None,
    folder: str | None = None,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """Exact / BM25 keyword search over the docs vault.

    Use when the user mentions a specific term, identifier, proper noun, or
    phrase that should appear verbatim in the docs. Better than RAG for code
    symbols, file names, ticket IDs, branded product names, etc.
    Examples: "find mcp-config-locations", "search for typeorm", "PeakXV Test".

    Args:
        query: The keyword or phrase to match.
        tags: Optional list of wiki-tag names (without brackets) to filter by.
        folder: Optional top-level folder to restrict the search to.
        top_k: How many results to return (default 5).

    Returns:
        List of hits, each with: path, title, folder, tags, snippet, score.
    """
    return _bm25(_es, query, top_k=top_k, tags=_opt_list(tags), folder=folder)


@mcp.tool()
def fuzzy_search(
    query: str,
    tags: list[str] | None = None,
    folder: str | None = None,
    top_k: int = 5,
) -> list[dict[str, Any]]:
    """Fuzzy / typo-tolerant search over the docs vault.

    Use when the user may have misspelled, mistyped, or misremembered a term,
    or when keyword_search returns nothing useful. Tolerates small edit
    distances (1-2 character differences per word).
    Examples: "brandng" (typo for branding), "anti pattrn", "amplitood".

    Args:
        query: The (possibly misspelled) term or phrase.
        tags: Optional list of wiki-tag names (without brackets) to filter by.
        folder: Optional top-level folder to restrict the search to.
        top_k: How many results to return (default 5).

    Returns:
        List of hits, each with: path, title, folder, tags, snippet, score.
    """
    return _fuzzy(_es, query, top_k=top_k, tags=_opt_list(tags), folder=folder)


def main() -> None:
    transport = os.environ.get("MCP_TRANSPORT", "stdio").lower()
    if transport in ("http", "streamable-http"):
        mcp.run(transport="streamable-http")
    elif transport == "sse":
        mcp.run(transport="sse")
    else:
        mcp.run()


if __name__ == "__main__":
    main()
