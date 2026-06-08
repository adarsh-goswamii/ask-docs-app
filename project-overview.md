---
name: project-overview
description: Full overview of the ask-docs-app — APIs, MCP tools, chat UI features, and architecture
metadata:
  type: project
---

# ask-docs-app — Project Overview

A fully containerized local RAG system for semantic search and chat over a personal Markdown documentation vault. Exposes an HTTP search API, an MCP server for tool discovery, and a web-based chat UI powered by Gemini.

---

## Architecture

Five Docker services:

| Service | Host Port | Role |
|---|---|---|
| `docs-rag-es` | internal | Elasticsearch 8.15.3 — vector + keyword backend |
| `docs-rag-ollama` | internal | Ollama — `nomic-embed-text` (embeddings) + `qwen2.5:7b-instruct` (chat) |
| `docs-rag-app` | **49823** | FastAPI daemon — indexing pipeline + HTTP search API |
| `docs-rag-mcp` | internal (8001) | MCP server (Streamable-HTTP transport) |
| `docs-rag-agent` | **52891** | Chat UI backend — Gemini agentic loop |

---

## REST APIs

### Daemon (port `49823`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/health` | ES + Ollama connectivity check |
| `GET` | `/stats` | `docs_indexed` + `chunks_indexed` counts |
| `GET` | `/docs` | All indexed files with chunk counts and titles |
| `DELETE` | `/docs` | Delete a file from disk and purge its ES chunks |
| `POST` | `/reindex` | Smart reindex — MD5-based change detection; indexes new/changed, purges deleted |
| `POST` | `/admin/wipe` | Delete + recreate ES index (full reset) |
| `POST` | `/search/rag` | Semantic kNN vector search |
| `POST` | `/search/keyword` | BM25 exact/phrase search |
| `POST` | `/search/fuzzy` | Typo-tolerant fuzzy search |
| `GET` | `/swagger` | Auto-generated FastAPI docs |

All three search endpoints accept `{ query, tags?, folder?, top_k? }`.

### Agent (port `52891`)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/` | Serves the chat UI |
| `GET` | `/healthz` | Agent + MCP status + tools loaded count |
| `GET` | `/stats` | Proxies daemon `/stats` |
| `GET` | `/docs` | Proxies daemon `/docs` |
| `POST` | `/admin/reindex` | Proxies daemon `/reindex` (smart reindex) |
| `POST` | `/admin/wipe` | Proxies daemon `/admin/wipe` |
| `DELETE` | `/docs` | Proxies daemon `DELETE /docs` |
| `POST` | `/chat` | Streaming SSE chat — Gemini agentic loop via MCP |

---

## MCP Tools (7 total — was 6, +`delete_doc`)

Server name: **"ask doc"** — `http://127.0.0.1:49823/mcp` (Streamable-HTTP)

| Tool | Description |
|---|---|
| `rag_search` | Semantic vector search; supports `tags`, `folder`, `top_k`, `include_file_content` |
| `keyword_search` | BM25 exact match; same filters |
| `fuzzy_search` | Typo-tolerant; same filters |
| `list_docs` | Lists all indexed files (filename, path, chunk count, title) |
| `wipe_index` | Deletes + recreates the vector index |
| `index_docs` | Smart reindex — MD5-based change detection; returns `{new, updated, skipped, deleted, chunks_added}` |
| `delete_doc` | Deletes a file from disk and purges its ES chunks; path-traversal guarded |

MCP supports three transports: **stdio** (local), **Streamable-HTTP** (Docker), **SSE** (optional).

---

## Chat UI Features

### Layout
- Cosmic dark-mode design with animated gradient orbs + starfield background
- Light/dark theme toggle — preference persisted in `localStorage`, read before first paint to avoid flash
- `⌘K` keyboard shortcut → new chat

### Header
- Live doc count + chunk count (auto-refreshes)
- **Reindex docs** (smart, MD5-based) — toast shows `X new, Y updated, Z deleted, N skipped, N chunks`; page auto-reloads 1.5 s after success
- **Wipe + Reindex** (full reset with confirmation prompt)
- Gemini API key chip — update or forget key inline

### API Key Gate
- On first load, prompts for Gemini API key
- Stored in `localStorage` under `ask-docs:gemini-api-key`; never sent anywhere except Gemini

### Chat
- Streaming token-by-token response rendering
- "Searching your docs…" thinking indicator while tools run
- Tool call + tool result visibility per turn
- Source chips below each assistant message — click to open a **Source Panel**
- Source panel: file path, folder tag, rendered snippet in a slide-in overlay (close with `Esc`)
- Markdown rendering via `marked.js` — code blocks, headers, bold, links
- Up to 6 agentic tool turns per query before cutoff
- Multi-turn conversation history passed on each request

### Composer
- `Enter` to send, `Shift+Enter` for newline
- Disabled while streaming

### Files View
- Folder tree sidebar with collapsible directories; file rows show full filename on hover (tooltip)
- **DocViewer** panel — displays file content with a **Delete** button; confirmation `AlertDialog` before calling `DELETE /docs`; on success clears selection and removes the doc from the tree
- CosmicBackground fades to opacity 0 when the source/doc drawer is open for a cleaner reading experience

### Toasts
- Info/error/success toasts for reindex, wipe, delete, and error states

---

## Implementation Details

- **Embeddings**: `nomic-embed-text` via Ollama (768 dims, dense_vector ES mapping)
- **Chunker**: Splits on heading/paragraph boundaries, max 800 chars; extracts `[[wiki-tags]]` and H1 title
- **Smart reindex**: MD5 hash per file stored as `file_hash` in ES mapping; unchanged files skipped, changed files deleted-then-reindexed, on-disk-deleted files purged from ES
- **Delete doc**: `DELETE /docs?path=...` removes file from disk and runs `deleteByQuery` to purge all its ES chunks; path-traversal guard enforced in daemon and MCP tool
- **Excluded dirs**: `.rag`, `.obsidian`, `.git`, `node_modules`
- **LLM for chat**: Gemini `gemini-2.5-flash` (configurable via `GEMINI_MODEL` env var)
- **Slimming**: Agent strips `score`/`tags`/`folder` from tool results before sending to model; snippets capped at 1200 chars

---

## Source Modules (`src/`)

| Module | Responsibility |
|---|---|
| `config.py` | All env-var config; single source of truth |
| `daemon.py` | FastAPI daemon — search + admin endpoints |
| `mcp_server.py` | MCP server — 6 tools, multi-transport |
| `agent.py` | Chat UI backend — Gemini agentic streaming loop |
| `indexer.py` | Walks `DOCS_ROOT`, chunks, embeds, bulk-indexes |
| `chunker.py` | Markdown chunking + tag/title extraction |
| `embedder.py` | Thin Ollama client for embeddings |
| `es_client.py` | ES wrapper — kNN, BM25, fuzzy search + index management |
| `static/index.html` | Single-page chat UI |

---

## Future Considerations

- Add hybrid search (kNN + BM25 RRF fusion) for better recall
- Support re-indexing on file-system watch (inotify/FSEvents) instead of manual trigger
- Swap Gemini for a local model (Ollama `qwen2.5`) for fully offline operation
- Per-document access controls or multi-vault support
- Persistent conversation history across sessions

[[rag]] [[fastapi]] [[elasticsearch]] [[mcp]] [[gemini]] [[ollama]] [[docker]] [[vector-search]]
