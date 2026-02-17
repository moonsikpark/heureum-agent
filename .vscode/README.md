# VS Code Configuration Guide

This directory contains VS Code configuration files for the Heureum monorepo project.

## Files Overview

- **launch.json** - Debug configurations for all services
- **tasks.json** - Build and run tasks
- **settings.json** - Workspace settings and recommendations
- **extensions.json** - Recommended VS Code extensions

## Debug Configurations

### Individual Services

1. **Debug Agent (FastAPI)** - Debug the FastAPI agent service on port 8000
   - Uses Python debugger (debugpy)
   - Automatically reloads on code changes
   - Set breakpoints in Python files

2. **Debug Platform (Django)** - Debug the Django platform service on port 8001
   - Uses Python debugger with Django support
   - Set breakpoints in views, models, etc.

3. **Debug Frontend (Chrome/Edge)** - Debug React frontend in browser
   - Launches Chrome or Edge with debugging enabled
   - Set breakpoints in TypeScript/JavaScript files
   - Automatically starts dev server

4. **Debug Electron Client** - Multiple configurations:
   - **Main + Renderer** - Debug both processes
   - **Main Process** - Debug Electron main process only
   - **Renderer Process** - Attach to renderer for React debugging

### Compound Configurations

- **Debug All Services** - Start Agent + Platform together
- **Debug Full Stack** - Start Agent + Platform + Frontend
- **Debug Electron Full** - Debug both Electron main and renderer processes
- **Debug Everything (All 4 Components)** - Debug Agent + Platform + Frontend + Electron all at once! 🚀

## How to Use

### Starting Debug Sessions

1. Open the Run and Debug panel (Cmd/Ctrl + Shift + D)
2. Select a configuration from the dropdown
3. Press F5 or click the green play button

### Setting Breakpoints

- Click in the gutter next to line numbers to set breakpoints
- Breakpoints work in Python (.py) and TypeScript/JavaScript (.ts, .tsx, .js, .jsx) files

### Using Compounds

Compounds start multiple debug sessions at once:
- Select "Debug Full Stack" to start all backend services and frontend
- All services will start in separate debug terminals
- Use "Stop All" to stop all services at once

## Tasks

Available tasks can be run from:
- Command Palette (Cmd/Ctrl + Shift + P) → "Tasks: Run Task"
- Terminal menu → "Run Task"

### Available Tasks

- **Start Frontend Dev Server** - Start Vite dev server for React frontend
- **Build Electron Client** - Build Electron app
- **Start Agent Service** - Start FastAPI agent
- **Start Platform Service** - Start Django platform
- **Start All Services** - Start all services in parallel
- **Stop All Services** - Kill all running services
- **Install All Dependencies** - Run `make install`
- **Build All Projects** - Run `make build-all`
- **Run Tests** - Run all tests
- **Lint All Projects** - Lint TypeScript projects

## Recommended Extensions

When you open this workspace, VS Code will prompt you to install recommended extensions. These include:

### Essential
- Python
- Pylance
- ESLint
- Prettier

### Development
- ES7+ React/Redux/React-Native snippets
- Makefile Tools
- GitLens

Install them for the best development experience!

## Workspace Settings

The workspace is configured with:

- **Auto-formatting on save** for Python, TypeScript, and JavaScript
- **ESLint auto-fix** on save
- **Import organization** on save
- **Python virtual environment** auto-detection
- **File exclusions** for build artifacts and dependencies
- **Rulers at 88 and 120 characters** (Python/TypeScript guidelines)

## Tips

### Multi-root Workspace

The settings.json includes folder configurations for each project. You can:
- Right-click folders in Explorer to see project-specific options
- Each project can have its own settings

### Keyboard Shortcuts

- **F5** - Start debugging
- **Shift + F5** - Stop debugging
- **Cmd/Ctrl + Shift + B** - Run build task
- **Cmd/Ctrl + Shift + P** - Command palette

### Python Virtual Environments

The Python interpreter is automatically set to:
- Agent: `heureum-agent/.venv/bin/python`
- Platform: `heureum-platform/.venv/bin/python`

If you need to change it:
1. Open Command Palette
2. Type "Python: Select Interpreter"
3. Choose the appropriate .venv

## Troubleshooting

### Debugger Not Attaching

If the debugger doesn't attach:
1. Make sure the service is not already running
2. Check that virtual environments are activated
3. Verify ports 8000, 8001, 5173 are available

### Electron Debugging Issues

For Electron debugging:
1. Build the project first (it runs automatically with preLaunchTask)
2. Make sure Electron binary is installed: `cd heureum-client && pnpm install`
3. For renderer debugging, start "Debug Electron Renderer Process" after main is running

### Port Conflicts

If you get port conflicts:
- Stop all services: Run "Stop All Services" task
- Or manually: `killall -9 uvicorn python node`

## Additional Resources

- [VS Code Debugging Guide](https://code.visualstudio.com/docs/editor/debugging)
- [Python in VS Code](https://code.visualstudio.com/docs/languages/python)
- [JavaScript in VS Code](https://code.visualstudio.com/docs/languages/javascript)
