# Heureum Client

Electron desktop client application for the Heureum AI agent platform.

## Features

- **Native Desktop App**: Cross-platform desktop application (Windows, macOS, Linux)
- **Same UI as Web**: Consistent experience with the web frontend
- **Electron + Vite**: Fast development and building
- **Auto-updates**: Built-in update mechanism
- **System Integration**: Native notifications and system tray

## Technology Stack

- Electron
- React 19
- TypeScript
- Vite
- electron-vite (build tool)
- electron-builder (packaging)

## Installation

### Prerequisites

- Node.js 18 or higher
- pnpm (recommended) or npm

### Install Dependencies

```bash
pnpm install
```

## Development

### Run Development Mode

```bash
pnpm dev
```

Or from the monorepo root:

```bash
make dev-client
```

This will:
1. Start the Vite development server
2. Launch the Electron app with hot-reload

### Build

Build for current platform:

```bash
pnpm build
```

Or from the monorepo root:

```bash
make build-client
```

Build for specific platforms:

```bash
pnpm build:win    # Windows
pnpm build:mac    # macOS
pnpm build:linux  # Linux
```

## Project Structure

```
heureum-client/
├── src/
│   ├── main/                  # Electron main process
│   │   └── index.ts          # Main process entry
│   ├── preload/              # Preload scripts
│   │   └── index.ts          # Preload entry
│   └── renderer/             # Renderer process (React app)
│       ├── src/
│       │   ├── components/   # UI components (shared with web)
│       │   ├── lib/          # API client
│       │   ├── store/        # State management
│       │   ├── types/        # TypeScript types
│       │   ├── App.tsx       # Main app component
│       │   ├── main.tsx      # Renderer entry
│       │   └── index.css     # Global styles
│       └── index.html        # HTML template
├── resources/                # App icons and resources
├── electron.vite.config.ts   # Vite configuration
├── package.json              # Dependencies
└── tsconfig.json             # TypeScript configuration
```

## Architecture

The Electron app consists of three main parts:

### Main Process ([src/main/index.ts](src/main/index.ts))
- Creates and manages browser windows
- Handles system-level operations
- Manages application lifecycle

### Preload Script ([src/preload/index.ts](src/preload/index.ts))
- Bridge between main and renderer processes
- Exposes safe APIs to renderer
- Handles IPC communication

### Renderer Process ([src/renderer/src](src/renderer/src))
- React application (same as web frontend)
- User interface and interaction
- Communicates with backend API

## Features

### Code Sharing with Web Frontend

The client shares the following components with the web frontend:
- UI components (Chat, MessageList, ChatInput)
- API client
- State management (Zustand store)
- TypeScript types

This ensures consistency between web and desktop experiences.

### Electron-specific Features

- Window management
- Native menus
- System tray integration
- Auto-updates
- Deep linking
- File system access

## Configuration

### electron-builder

Configure build settings in [package.json](package.json):

```json
{
  "build": {
    "appId": "com.heureum.client",
    "productName": "Heureum Agent",
    "directories": {
      "output": "dist"
    },
    "files": [
      "dist/**/*"
    ]
  }
}
```

### Auto-updates

The app includes electron-updater for automatic updates. Configure your update server in the build settings.

## Development Tips

### Hot Reload

During development, both the main process and renderer process support hot reload:
- Main process: Automatically restarts on changes
- Renderer: Hot module replacement (HMR)

### DevTools

The Electron window opens with DevTools enabled in development mode.

### Debugging

Use VS Code's built-in debugger or Electron's DevTools for debugging.

## Building for Distribution

### Before Building

1. Update version in [package.json](package.json)
2. Ensure app icons are in the `resources` folder
3. Test the app thoroughly

### Creating Installers

```bash
# Windows installer
pnpm build:win

# macOS installer (DMG)
pnpm build:mac

# Linux packages
pnpm build:linux
```

The built applications will be in the `dist` directory.

## License

See [LICENSE](../LICENSE) file for details.
