# Heureum Agent

AI agent service built with FastAPI and LangChain for intelligent message processing and routing.

## Features

- **FastAPI**: Modern, fast web framework for building APIs
- **LangChain**: Framework for developing applications powered by language models
- **OpenAI Integration**: Uses OpenAI models for intelligent responses
- **Session Management**: Maintains conversation context across requests
- **Type Safety**: Full type hints and Pydantic models
- **Testing**: Comprehensive test suite with pytest

## Technology Stack

- Python 3.11+
- FastAPI
- LangChain
- OpenAI
- Pydantic
- Uvicorn

## Installation

### Prerequisites

- Python 3.11 or higher
- Poetry

### Install Dependencies

```bash
poetry install
```

**Note**: There is currently a known issue with Poetry and Python 3.14 on macOS. If you encounter installation errors, you may need to:

1. Use Python 3.11 or 3.12
2. Manually create a virtual environment: `python3 -m venv .venv`
3. Activate it: `source .venv/bin/activate`
4. Install with pip: `pip install -r requirements.txt` (after generating requirements.txt)

### Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and add your OpenAI API key:

```env
OPENAI_API_KEY=your-openai-api-key-here
```

## Development

### Run Development Server

```bash
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Or from the monorepo root:

```bash
make dev-agent
```

The API will be available at:
- API: http://localhost:8000
- Interactive docs: http://localhost:8000/docs
- Alternative docs: http://localhost:8000/redoc

### Run Tests

```bash
poetry run pytest
```

Or from the monorepo root:

```bash
make test-agent
```

### Code Quality

Format code with Black:

```bash
poetry run black app tests
```

Lint with Ruff:

```bash
poetry run ruff check app tests
```

Type check with mypy:

```bash
poetry run mypy app
```

## API Endpoints

### Health Check

```http
GET /health
```

Response:

```json
{
  "status": "healthy",
  "version": "0.1.0"
}
```

### Chat with Agent

```http
POST /api/v1/agent/chat
```

Request body:

```json
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
  "message": "I'm doing well, thank you! How can I help you today?",
  "session_id": "generated-or-provided-session-id"
}
```

### Get Session

```http
GET /api/v1/agent/sessions/{session_id}
```

### Delete Session

```http
DELETE /api/v1/agent/sessions/{session_id}
```

## Project Structure

```
heureum-agent/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI application
│   ├── config.py            # Configuration settings
│   ├── routers/
│   │   ├── __init__.py
│   │   └── agent.py         # Agent endpoints
│   └── services/
│       ├── __init__.py
│       └── agent_service.py # LangChain agent logic
├── tests/
│   ├── __init__.py
│   └── test_main.py         # Tests
├── .env.example             # Example environment variables
├── pyproject.toml           # Poetry configuration
└── README.md
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `APP_NAME` | Application name | `Heureum Agent` |
| `DEBUG` | Debug mode | `false` |
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `AGENT_MODEL` | OpenAI model to use | `gpt-4o-mini` |
| `AGENT_TEMPERATURE` | Model temperature | `0.7` |
| `AGENT_MAX_TOKENS` | Maximum tokens per response | `2000` |
| `CORS_ORIGINS` | Allowed CORS origins | See config.py |
| `LANGCHAIN_TRACING_V2` | Enable LangChain tracing | `false` |
| `LANGCHAIN_API_KEY` | LangChain API key | Optional |

## Adding Tools

To add LangChain tools to your agent, modify [app/services/agent_service.py](app/services/agent_service.py):

```python
from langchain.tools import Tool

# Define your tools
tools = [
    Tool(
        name="Calculator",
        func=lambda x: eval(x),
        description="Useful for mathematical calculations"
    )
]

# Add to agent creation
agent = create_openai_functions_agent(
    llm=self.llm,
    tools=tools,  # Pass your tools here
    prompt=prompt,
)
```

## License

See [LICENSE](../LICENSE) file for details.
