# Copyright (c) 2026 Heureum AI. All rights reserved.

"""Web server standalone entry point."""

from src.servers import create_server
from src.config import settings

mcp = create_server("web")

if __name__ == "__main__":
    cfg = settings.SERVERS["web"]
    mcp.run(transport=cfg.transport)
