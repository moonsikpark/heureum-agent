# Heureum Platform

Django-based proxy and message storage system for the Heureum AI agent platform.

## Features

- **Message Storage**: Persistent storage for all conversation messages
- **Proxy Service**: Forwards requests to the AI agent service
- **REST API**: Full RESTful API for message management
- **Admin Interface**: Django admin for easy data management
- **Session Management**: Track conversations by session ID
- **CORS Support**: Configured for cross-origin requests

## Technology Stack

- Python 3.11+
- Django 5.1+
- Django REST Framework
- SQLite (default, configurable to PostgreSQL)
- httpx for async HTTP requests

## Installation

### Prerequisites

- Python 3.11 or higher
- Poetry

### Install Dependencies

```bash
poetry install
```

**Note**: There is currently a known issue with Poetry and Python 3.14 on macOS. If you encounter installation errors, you may need to use Python 3.11 or 3.12.

### Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` with your settings:

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
AGENT_SERVICE_URL=http://localhost:8000
```

### Database Setup

Run migrations to create the database:

```bash
poetry run python manage.py migrate
```

Create a superuser for admin access:

```bash
poetry run python manage.py createsuperuser
```

## Development

### Run Development Server

```bash
poetry run python manage.py runserver 8001
```

Or from the monorepo root:

```bash
make dev-platform
```

The platform will be available at:
- API: http://localhost:8001
- Admin: http://localhost:8001/admin

### Run Tests

```bash
poetry run pytest
```

Or from the monorepo root:

```bash
make test-platform
```

### Code Quality

Format code with Black:

```bash
poetry run black heureum_platform
```

Lint with Ruff:

```bash
poetry run ruff check heureum_platform
```

Type check with mypy:

```bash
poetry run mypy heureum_platform
```

## API Endpoints

### Messages API

List all messages:
```http
GET /api/v1/messages/
```

Filter messages by session:
```http
GET /api/v1/messages/?session_id=<session-id>
```

Create a message:
```http
POST /api/v1/messages/
Content-Type: application/json

{
  "session_id": "session-123",
  "role": "user",
  "content": "Hello!",
  "metadata": {}
}
```

Get a specific message:
```http
GET /api/v1/messages/<id>/
```

Update a message:
```http
PUT /api/v1/messages/<id>/
```

Delete a message:
```http
DELETE /api/v1/messages/<id>/
```

### Proxy API

Forward a request to the agent service:
```http
POST /api/v1/proxy/
Content-Type: application/json

{
  "messages": [
    {
      "role": "user",
      "content": "Hello, how are you?"
    }
  ],
  "session_id": "optional-session-id"
}
```

Response:
```json
{
  "message": "I'm doing well, thank you!",
  "session_id": "session-id"
}
```

The proxy endpoint will:
1. Store incoming messages in the database
2. Forward the request to the agent service
3. Store the agent's response
4. Return the response to the client

## Project Structure

```
heureum-platform/
├── heureum_platform/
│   ├── __init__.py
│   ├── settings.py          # Django settings
│   ├── urls.py              # URL routing
│   ├── wsgi.py              # WSGI config
│   ├── asgi.py              # ASGI config
│   └── apps/
│       ├── messages/        # Message storage app
│       │   ├── models.py    # Message model
│       │   ├── views.py     # Message views
│       │   ├── serializers.py
│       │   └── admin.py
│       └── proxy/           # Proxy app
│           ├── views.py     # Proxy view
│           └── apps.py
├── manage.py                # Django management script
├── pyproject.toml           # Poetry configuration
├── .env.example             # Example environment variables
└── README.md
```

## Database Models

### Message

| Field | Type | Description |
|-------|------|-------------|
| `id` | Integer | Primary key |
| `session_id` | String | Session identifier |
| `role` | String | Message role (user/assistant/system) |
| `content` | Text | Message content |
| `metadata` | JSON | Additional metadata |
| `created_at` | DateTime | Creation timestamp |
| `updated_at` | DateTime | Last update timestamp |

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SECRET_KEY` | Django secret key | Required |
| `DEBUG` | Debug mode | `False` |
| `ALLOWED_HOSTS` | Allowed hosts | `[]` |
| `CORS_ALLOWED_ORIGINS` | CORS origins | See settings.py |
| `AGENT_SERVICE_URL` | Agent service URL | `http://localhost:8000` |

## Admin Interface

Access the Django admin at http://localhost:8001/admin

The admin interface provides:
- Message browsing and search
- Session filtering
- Message content preview
- User management

## License

See [LICENSE](../LICENSE) file for details.
