#!/bin/bash

# Stop all Heureum services
echo "Stopping all Heureum services..."

# Kill FastAPI (uvicorn) processes for heureum-agent
pkill -f "uvicorn app.main:app" && echo "✓ Stopped Agent (FastAPI)" || echo "  Agent not running"

# Kill Django processes for heureum-platform
pkill -f "heureum-platform.*manage.py runserver" && echo "✓ Stopped Platform (Django)" || echo "  Platform not running"

# Kill Vite dev server for frontend
pkill -f "heureum-frontend.*vite" && echo "✓ Stopped Frontend (Vite)" || echo "  Frontend not running"

# Kill Electron processes
pkill -f "heureum-client.*electron" && echo "✓ Stopped Electron Client" || echo "  Electron not running"

# Kill MCP server process
pkill -f "heureum-mcp.*src.main" && echo "✓ Stopped MCP Server" || echo "  MCP not running"

# Kill Celery processes
pkill -f "celery.*heureum_platform" && echo "✓ Stopped Celery worker/beat" || echo "  Celery not running"

# Alternative: Kill by port if process name doesn't work
kill_port() {
  local port=$1
  local pid
  pid=$(lsof -ti:"$port" 2>/dev/null)
  if [ -n "$pid" ]; then
    local proc
    proc=$(ps -p "$pid" -o comm= 2>/dev/null || echo "unknown")
    echo "  Port $port in use by: $proc (PID $pid)"
    kill -9 "$pid" 2>/dev/null && echo "✓ Killed process on port $port"
  fi
}

kill_port 8000
kill_port 8001
kill_port 3001
kill_port 5173

echo ""
echo "All services stopped!"
