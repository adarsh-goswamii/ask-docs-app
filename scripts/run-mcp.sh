#!/usr/bin/env bash
# Thin wrapper Claude (or any MCP client) invokes over stdio.
# Spawns the MCP server inside the running app container.
exec docker exec -i docs-rag-app python -m src.mcp_server
