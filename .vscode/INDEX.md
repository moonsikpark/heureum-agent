# VS Code Configuration Index

Welcome to the Heureum monorepo VS Code configuration!

## 📖 Start Here

New to this setup? Start with these files in order:

1. **[QUICK_START.md](QUICK_START.md)** ⭐ Start here!
   - Get debugging in 3 easy steps
   - Essential keyboard shortcuts
   - Common workflows

2. **[DEBUG_ALL_COMPONENTS.md](DEBUG_ALL_COMPONENTS.md)** 🔥 New feature!
   - Debug all 4 components simultaneously
   - Complete walkthrough
   - Example scenarios

3. **[README.md](README.md)**
   - Complete documentation
   - All configurations explained
   - Troubleshooting guide

## 🔧 Configuration Files

### [launch.json](launch.json)
Debug configurations for all services:
- 7 individual configurations
- 4 compound configurations (including "Debug Everything")
- Python (FastAPI, Django)
- TypeScript/JavaScript (React, Electron)

### [tasks.json](tasks.json)
Automated tasks:
- Start/stop services
- Build projects
- Run tests
- Lint code

### [settings.json](settings.json)
Workspace settings:
- Python interpreter paths
- Auto-formatting
- File exclusions
- Multi-root workspace

### [extensions.json](extensions.json)
Recommended VS Code extensions:
- Python, Pylance
- ESLint, Prettier
- Git tools
- More...

## 🎯 Quick Actions

### Debug All 4 Components
1. Press `Cmd/Ctrl + Shift + D`
2. Select "Debug Everything (All 4 Components)"
3. Press `F5`

### Run a Task
1. Press `Cmd/Ctrl + Shift + P`
2. Type "Tasks: Run Task"
3. Choose from available tasks

### Install Extensions
1. Open Extensions panel (`Cmd/Ctrl + Shift + X`)
2. Search "@recommended"
3. Install all recommended extensions

## 📚 Documentation Overview

| File | Purpose | Best For |
|------|---------|----------|
| QUICK_START.md | 3-step quick start | First-time setup |
| DEBUG_ALL_COMPONENTS.md | Debug all 4 at once | Full stack debugging |
| README.md | Complete reference | Deep dive |
| INDEX.md (this file) | Navigation | Finding what you need |

## 🔍 Find What You Need

### "How do I debug the Python backend?"
→ [QUICK_START.md](QUICK_START.md) → "For Backend Development"

### "How do I debug everything at once?"
→ [DEBUG_ALL_COMPONENTS.md](DEBUG_ALL_COMPONENTS.md)

### "How do I set up hot reload?"
→ [README.md](README.md) → "Hot Reload" section

### "What tasks are available?"
→ [tasks.json](tasks.json) or [README.md](README.md) → "Tasks" section

### "What extensions should I install?"
→ [extensions.json](extensions.json) or [README.md](README.md) → "Recommended Extensions"

## 🚀 Common Workflows

### Full Stack Feature Development
1. Select "Debug Full Stack"
2. Set breakpoints in frontend, platform, and agent
3. Send a request
4. Step through the entire flow

### Backend API Development
1. Select "Debug All Services"
2. Set breakpoints in agent and platform
3. Use Postman/curl to test
4. Step through request handling

### Frontend Development
1. Select "Debug Frontend (Chrome)"
2. Set breakpoints in React components
3. Interact with the UI
4. Debug in browser DevTools + VS Code

### Desktop App Development
1. Select "Debug Electron Full"
2. Set breakpoints in main and renderer
3. Launch Electron window
4. Debug both processes

## ⌨️ Essential Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Open Debug Panel | `Cmd/Ctrl + Shift + D` |
| Start Debugging | `F5` |
| Stop Debugging | `Shift + F5` |
| Toggle Breakpoint | `F9` |
| Step Over | `F10` |
| Step Into | `F11` |
| Step Out | `Shift + F11` |
| Run Task | `Cmd/Ctrl + Shift + P` → Tasks |
| Command Palette | `Cmd/Ctrl + Shift + P` |

## 🆘 Need Help?

### Quick Troubleshooting
See [README.md](README.md) → "Troubleshooting" section

### Port Already in Use
Run Task: "Stop All Services"

### Python Interpreter Not Found
1. `Cmd/Ctrl + Shift + P`
2. "Python: Select Interpreter"
3. Choose `.venv` from project folder

### More Help
See [README.md](README.md) for comprehensive troubleshooting

## 🎉 You're Ready!

Everything is configured and ready to go. Choose a file from above and start debugging!

**Recommended:** Start with [QUICK_START.md](QUICK_START.md) if this is your first time.

---

Happy coding! 🚀
