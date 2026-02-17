# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Multi-server runner entry point."""

import anyio

from src.servers import create_server
from src.config import settings


async def main():
    """Start all configured MCP servers concurrently using anyio task groups."""
    servers = []
    for key, cfg in settings.SERVERS.items():
        servers.append((create_server(key), cfg))

    async with anyio.create_task_group() as tg:
        for mcp, cfg in servers:
            match cfg.transport:
                case "sse":
                    tg.start_soon(mcp.run_sse_async)
                case "streamable-http":
                    tg.start_soon(mcp.run_streamable_http_async)


if __name__ == "__main__":
    anyio.run(main)
