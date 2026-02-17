<div align="center">

<img src="assets/hero.svg" width="100%" />

</div>

## Components

| Component | Tech | Description |
|-----------|------|-------------|
| **heureum-agent** | FastAPI, LangChain | AI agent service |
| **heureum-platform** | Django, DRF | Proxy and message storage |
| **heureum-frontend** | React, Vite | Web client |
| **heureum-client** | Electron, React | Desktop client (macOS, Windows) |
| **heureum-mobile** | React Native, Expo | Mobile app (iOS, Android) |
| **heureum-extension** | Manifest V3 | Browser extension |
| **heureum-infra** | Terraform, Kubernetes | Azure AKS deployment |

## Quick Start

```bash
# Configure environment
cp heureum-agent/.env.example heureum-agent/.env      # Set OPENAI_API_KEY
cp heureum-platform/.env.example heureum-platform/.env
cp heureum-frontend/.env.example heureum-frontend/.env

# Install, migrate, and run everything
make setup
```

## Development

```bash
make dev-agent            # Agent service
make dev-platform         # Platform service
make dev-frontend         # Web frontend
make dev-client           # Desktop app
make dev-mobile           # Mobile app
make dev-mobile-ios       # iOS simulator
make dev-mobile-android   # Android emulator
make dev-all              # All services at once
```

## Build & Release

```bash
make build-all            # Build all projects
make release-client-mac   # Package macOS DMG
make release-client-win   # Package Windows installer
```

Pushing a `v*` tag triggers CI to build and release all platforms (macOS, Windows, iOS, Android).

## Prerequisites

- Python 3.11+ and Poetry
- Node.js 20+ and pnpm
- Xcode (for iOS builds)
- Android SDK (for Android builds)

## Architecture

```
Frontend/Client/Mobile → Platform → Agent → LLM API
```
