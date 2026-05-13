#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required. Install Docker Desktop and re-run." >&2
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon not running. Start Docker Desktop and re-run." >&2
  exit 1
fi

echo "==> Building and starting the stack (elasticsearch + ollama + docs-rag app)"
docker compose up -d --build

echo "==> Waiting for Ollama to come up"
for i in $(seq 1 30); do
  if docker exec docs-rag-ollama ollama list >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Pulling embedding model into the Ollama container (nomic-embed-text, ~270MB)"
docker exec docs-rag-ollama ollama pull nomic-embed-text

CHAT_MODEL="${OLLAMA_MODEL:-qwen2.5:7b-instruct}"
echo "==> Pulling chat model into the Ollama container (${CHAT_MODEL}, ~4.4GB for qwen2.5:7b)"
docker exec docs-rag-ollama ollama pull "${CHAT_MODEL}"

echo "==> Waiting for the app's /health to go green"
HOST_PORT="${HOST_PORT:-49823}"
for i in $(seq 1 60); do
  if curl -fs "http://127.0.0.1:${HOST_PORT}/health" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo "==> Waiting for the agent's /healthz to go green"
AGENT_PORT="${AGENT_PORT:-52891}"
for i in $(seq 1 60); do
  if curl -fs "http://127.0.0.1:${AGENT_PORT}/healthz" >/dev/null 2>&1; then
    break
  fi
  sleep 2
done

echo
echo "Stack is up."
echo "  Chat UI:    http://127.0.0.1:${AGENT_PORT}"
echo "  API:        http://127.0.0.1:${HOST_PORT}"
echo "  Reindex:    curl -X POST http://127.0.0.1:${HOST_PORT}/reindex"
echo "  Stats:      curl http://127.0.0.1:${HOST_PORT}/stats"
echo "  Agent health: curl http://127.0.0.1:${AGENT_PORT}/healthz"
