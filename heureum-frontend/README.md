# Heureum Frontend

Modern React web application for interacting with the Heureum AI agent platform.

## Features

- **Modern UI**: Clean, responsive chat interface
- **Real-time Chat**: Interactive conversation with AI agent
- **State Management**: Zustand for efficient state handling
- **API Integration**: Axios + React Query for data fetching
- **TypeScript**: Full type safety
- **Vite**: Lightning-fast development and building

## Technology Stack

- React 19
- TypeScript
- Vite
- Zustand (state management)
- TanStack Query (data fetching)
- Axios (HTTP client)

## Installation

### Prerequisites

- Node.js 18 or higher
- pnpm (recommended) or npm

### Install Dependencies

```bash
pnpm install
```

### Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` to set your API URL:

```env
VITE_API_URL=http://localhost:8001
```

## Development

### Run Development Server

```bash
pnpm dev
```

Or from the monorepo root:

```bash
make dev-frontend
```

The application will be available at http://localhost:5173

### Build for Production

```bash
pnpm build
```

Or from the monorepo root:

```bash
make build-frontend
```

### Preview Production Build

```bash
pnpm preview
```

### Lint

```bash
pnpm lint
```

## Project Structure

```
heureum-frontend/
├── src/
│   ├── components/
│   │   ├── Chat.tsx          # Main chat component
│   │   ├── MessageList.tsx   # Message display
│   │   ├── ChatInput.tsx     # Message input
│   │   └── *.css            # Component styles
│   ├── lib/
│   │   └── api.ts           # API client
│   ├── store/
│   │   └── chatStore.ts     # Zustand store
│   ├── types/
│   │   └── index.ts         # TypeScript types
│   ├── App.tsx              # Main app component
│   ├── App.css              # App styles
│   └── main.tsx             # Entry point
├── public/                  # Static assets
├── index.html              # HTML template
├── vite.config.ts          # Vite configuration
├── tsconfig.json           # TypeScript configuration
└── package.json            # Dependencies
```

## Features

### Chat Interface

The chat interface provides:
- Message history display
- User and assistant message differentiation
- Loading indicators
- Error handling
- Session tracking

### State Management

Uses Zustand for:
- Message state
- Session ID tracking
- Loading states
- Error states

### API Integration

Uses TanStack Query for:
- Async state management
- Caching
- Error handling
- Mutation management

## Components

### Chat

Main chat container component that orchestrates the chat experience.

### MessageList

Displays the conversation history with:
- Auto-scrolling to latest message
- Empty state
- Loading animation
- User/assistant message styling

### ChatInput

Input component with:
- Multi-line support (Shift+Enter for new line)
- Enter to send
- Disabled state during loading
- Character preservation

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:8001` |

## Customization

### Styling

The application uses CSS modules and variables for easy customization. Main theme colors are defined in component CSS files and can be adjusted:

- Primary gradient: `#667eea` to `#764ba2`
- Background: `#f7f9fc`
- Borders: `#e9ecef`

### API Client

The API client is configured in [src/lib/api.ts](src/lib/api.ts). You can:
- Add authentication headers
- Configure timeout
- Add request/response interceptors

## License

See [LICENSE](../LICENSE) file for details.
