# heureum-mcp

MCP server for Heureum Agent. Provides server-side tools (web search, web fetch, etc.) via SSE transport.

## Development

```bash
poetry install

# Run all servers
poetry run python -m src.main

# Run web server only
poetry run python -m src.servers.web
```

Web server runs on `http://localhost:3001` by default.
