# Debug All 4 Components Simultaneously

## Overview

The **"Debug Everything (All 4 Components)"** configuration allows you to debug all four parts of the Heureum monorepo at the same time:

1. **Agent** (FastAPI/Python) - Port 8000
2. **Platform** (Django/Python) - Port 8001
3. **Frontend** (React/TypeScript) - Port 5173
4. **Electron** (Desktop App) - Native window

## Quick Start

### Step 1: Open Debug Panel
Press `Cmd/Ctrl + Shift + D` or click the Run icon in the sidebar

### Step 2: Select Configuration
Choose **"Debug Everything (All 4 Components)"** from the dropdown

### Step 3: Start Debugging
Press `F5` or click the green play button

## What Happens

When you start this configuration:

1. **4 Python/Node processes start** in separate integrated terminals
2. **Chrome browser opens** with the React frontend at http://localhost:5173
3. **Electron window opens** with the desktop app
4. **All 4 debuggers attach** and show in the debug panel

## Setting Breakpoints

You can set breakpoints in any of these files and they'll all work:

### Backend (Python)
```
heureum-agent/app/main.py
heureum-agent/app/services/agent_service.py
heureum-agent/app/routers/agent.py

heureum-platform/heureum_platform/apps/proxy/views.py
heureum-platform/heureum_platform/apps/chat_messages/views.py
```

### Frontend (TypeScript/JavaScript)
```
heureum-frontend/src/components/Chat.tsx
heureum-frontend/src/components/ChatInput.tsx
heureum-frontend/src/lib/api.ts
heureum-frontend/src/store/chatStore.ts
```

### Electron (TypeScript/JavaScript)
```
heureum-client/src/main/index.ts
heureum-client/src/preload/index.ts
heureum-client/src/renderer/src/App.tsx
heureum-client/src/renderer/src/components/Chat.tsx
```

## Debug Controls

### Debug Toolbar
The debug toolbar appears at the top with these controls:
- **Continue** (F5) - Resume execution
- **Step Over** (F10) - Execute next line
- **Step Into** (F11) - Enter function
- **Step Out** (Shift+F11) - Exit function
- **Restart** - Restart all debuggers
- **Stop** - Stop all debuggers

### Switching Between Debuggers
Use the dropdown in the debug panel to switch between:
- Debug Agent (FastAPI)
- Debug Platform (Django)
- Debug Frontend (Chrome)
- Debug Electron Main Process

Each has its own:
- Call stack
- Variables
- Watch expressions
- Breakpoints

## Example: Full Stack Debugging

### Scenario: Debug a Chat Message Flow

1. **Start "Debug Everything"** (F5)

2. **Set these breakpoints:**
   - `heureum-frontend/src/components/Chat.tsx` line 36 (handleSendMessage)
   - `heureum-platform/heureum_platform/apps/proxy/views.py` line 23 (proxy_to_agent)
   - `heureum-agent/app/services/agent_service.py` line 34 (process_messages)

3. **Send a message** from either the web frontend or Electron app

4. **Watch the flow:**
   - Breakpoint hits in Chat.tsx (frontend)
   - Press F5 to continue
   - Breakpoint hits in views.py (platform)
   - Press F5 to continue
   - Breakpoint hits in agent_service.py (agent)
   - Step through to see how it processes
   - Press F5 to continue
   - Response flows back!

5. **Inspect variables** at each breakpoint:
   - Frontend: `content`, `userMessage`, `messages`
   - Platform: `request.data`, `messages`, `session_id`
   - Agent: `messages`, `last_message`, `response_text`

## Hot Reload

All services support hot reload:
- **Change Python code** → FastAPI/Django auto-reload
- **Change React code** → Vite HMR (instant update)
- **Change Electron code** → electron-vite auto-reload

Your breakpoints persist across reloads!

## Stopping Everything

To stop all 4 debuggers:
1. Click the red square "Stop" button in the debug toolbar, OR
2. Press `Shift + F5`, OR
3. Run the "Stop All Services" task

All processes will terminate gracefully.

## Troubleshooting

### Port Already in Use
If you get "port already in use" errors:
1. Run Task: "Stop All Services"
2. Or manually: `killall -9 uvicorn python node`
3. Try starting again

### Debugger Not Attaching
1. Make sure no services are already running
2. Check virtual environments are activated
3. Restart VS Code if needed

### Electron Window Doesn't Open
1. Make sure Electron is built: Run "Build Electron Client" task
2. Check Electron binary is installed: `cd heureum-client && pnpm install`
3. Try the "Debug Electron Full" configuration separately

### Chrome Doesn't Open
1. Make sure Chrome is installed
2. Or switch to "Debug Frontend (Edge)" if you have Edge
3. Check that port 5173 is available

## Advanced: Debugging Electron Renderer Too

The "Debug Everything" config starts the Electron Main Process.
To also debug the Electron Renderer (React components):

### Option 1: Manual Attach
1. Start "Debug Everything"
2. Wait for Electron window to open
3. In debug panel, click "+" and select "Debug Electron Renderer Process"
4. Now debugging main + renderer!

### Option 2: Separate Configs
Use these two configurations side by side:
- "Debug Full Stack" - For web (Agent + Platform + Frontend)
- "Debug Electron Full" - For desktop (Main + Renderer)

## Tips & Tricks

### View All Call Stacks
When a breakpoint hits, you can see call stacks for all running debuggers in the Call Stack panel.

### Multiple Breakpoints
Set breakpoints in all layers to trace a request from UI to backend and back.

### Conditional Breakpoints
Right-click on a breakpoint → "Edit Breakpoint" → Add condition
Example: `session_id == "abc123"`

### Logpoints
Right-click in gutter → "Add Logpoint"
Example: `User message: {content}`
Logs without stopping execution!

### Watch Expressions
Add expressions to the Watch panel:
- `len(messages)`
- `JSON.stringify(data)`
- `sessionId?.substring(0, 8)`

## Performance

Running all 4 components uses approximately:
- **CPU**: Moderate (4 Node/Python processes)
- **RAM**: ~2-3 GB total
- **Ports**: 8000, 8001, 5173, 9223

If your machine is slow:
- Use individual configurations instead
- Or use "Debug Full Stack" (3 components, no Electron)

## See Also

- [QUICK_START.md](QUICK_START.md) - Quick start guide
- [README.md](README.md) - Full documentation
- [launch.json](launch.json) - All debug configurations
- [tasks.json](tasks.json) - Available tasks

---

Happy debugging! 🐛🔨
