# Quick Start Guide - VS Code Debugging

## 🚀 Get Started in 3 Steps

### 1. Install Recommended Extensions
When you open this workspace, click "Install" on the notification about recommended extensions.

Or manually:
- Press `Cmd/Ctrl + Shift + X`
- Search for: Python, Pylance, ESLint, Prettier
- Click Install

### 2. Choose a Debug Configuration
Press `F5` or click the Run icon in the sidebar, then select:

#### For Backend Development:
- **Debug Agent (FastAPI)** → Debug the AI agent service
- **Debug Platform (Django)** → Debug the Django proxy service
- **Debug All Services** → Debug both at once

#### For Frontend Development:
- **Debug Frontend (Chrome)** → Debug React app in Chrome
- **Debug Full Stack** → Debug everything together

#### For Desktop App Development:
- **Debug Electron Client** → Debug the desktop app
- **Debug Electron Full** → Debug main + renderer

#### 🌟 Debug All 4 Components at Once:
- **Debug Everything (All 4 Components)** → Debug Agent + Platform + Frontend + Electron simultaneously!

### 3. Start Debugging
Press `F5` and start coding!

## 💡 Pro Tips

### Set Breakpoints
Click in the gutter (left of line numbers) to add breakpoints.
Works in:
- `.py` files (Python)
- `.ts`, `.tsx`, `.js`, `.jsx` files (TypeScript/JavaScript)

### Use Tasks
Run tasks from Command Palette (`Cmd/Ctrl + Shift + P`):
- Type "Tasks: Run Task"
- Select "Start All Services" to run everything
- Select "Stop All Services" to stop everything

### Debug Multiple Services
1. Select "Debug Full Stack" from dropdown
2. Press `F5`
3. All services start automatically
4. Set breakpoints anywhere
5. Request flows through: Frontend → Platform → Agent

### Hot Reload
All services support hot reload:
- Change Python code → FastAPI/Django auto-reload
- Change React code → Vite hot module replacement
- Change Electron code → electron-vite auto-reload

## 📝 Common Workflows

### Workflow 1: Full Stack Feature Development
1. Start "Debug Full Stack" (`F5`)
2. Open browser to http://localhost:5173
3. Set breakpoints in:
   - Frontend: `src/components/Chat.tsx`
   - Platform: `apps/proxy/views.py`
   - Agent: `app/services/agent_service.py`
4. Send a message from frontend
5. Watch it flow through all services!

### Workflow 2: Backend API Development
1. Start "Debug All Services" (Agent + Platform)
2. Use Postman/curl to test APIs
3. Set breakpoints in service code
4. Step through request handling

### Workflow 3: Electron App Development
1. Start "Debug Electron Full"
2. App window opens automatically
3. Set breakpoints in:
   - Main process: `src/main/index.ts`
   - Renderer: `src/renderer/src/App.tsx`
4. Use Chrome DevTools for renderer debugging

## ⌨️ Keyboard Shortcuts

| Action | Mac | Windows/Linux |
|--------|-----|---------------|
| Start Debugging | F5 | F5 |
| Stop Debugging | Shift + F5 | Shift + F5 |
| Toggle Breakpoint | F9 | F9 |
| Step Over | F10 | F10 |
| Step Into | F11 | F11 |
| Step Out | Shift + F11 | Shift + F11 |
| Run Task | Cmd + Shift + P → Tasks | Ctrl + Shift + P → Tasks |
| Command Palette | Cmd + Shift + P | Ctrl + Shift + P |

## 🔧 Troubleshooting

### "Port already in use"
Run the "Stop All Services" task or:
```bash
killall -9 uvicorn python node
```

### "Python interpreter not found"
1. Press `Cmd/Ctrl + Shift + P`
2. Type "Python: Select Interpreter"
3. Choose `.venv` from heureum-agent or heureum-platform

### "Debugger not attaching"
1. Make sure service isn't already running
2. Check that virtual environment is activated
3. Try restarting VS Code

### Electron app doesn't open
1. Rebuild: Run "Build Electron Client" task
2. Check that Electron binary is installed:
   ```bash
   cd heureum-client && pnpm install
   ```

## 📚 Learn More

- Read [README.md](README.md) for detailed documentation
- Check [launch.json](launch.json) for all configurations
- View [tasks.json](tasks.json) for available tasks
- See [settings.json](settings.json) for workspace settings

## 🎯 Your First Debug Session

Try this now:

1. Press `F5`
2. Select "Debug Agent (FastAPI)"
3. Open `heureum-agent/app/main.py`
4. Click in the gutter on line with `@app.get("/health")`
5. Visit http://localhost:8000/health in browser
6. Debugger pauses at your breakpoint! 🎉
7. Hover over variables to inspect
8. Press `F10` to step through code
9. Press `F5` to continue

Happy debugging! 🐛🔨
