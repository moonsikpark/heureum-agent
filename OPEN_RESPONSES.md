# Open Responses Implementation

This document describes the [Open Responses](https://www.openresponses.org/) specification implementation across the Heureum platform.

## Overview

Open Responses is an open-source specification for building multi-provider, interoperable LLM interfaces based on the OpenAI Responses API. Our implementation provides a standardized way to communicate between the agent, platform, and frontend services.

## Architecture

```
┌─────────────┐      ┌──────────────┐      ┌───────────┐
│   Frontend  │─────▶│   Platform   │─────▶│   Agent   │
│  (React/TS) │      │   (Django)   │      │  (FastAPI)│
└─────────────┘      └──────────────┘      └───────────┘
      │                     │                     │
      │                     ▼                     │
      │               ┌─────────┐                 │
      │               │Database │                 │
      │               │(SQLite) │                 │
      │               └─────────┘                 │
      │                                          │
      └──────────────────────────────────────────┘
         All using Open Responses format
```

## Endpoints

### Agent Service (Port 8000)

- **POST /v1/responses** - Standard Open Responses endpoint
  - Accepts: `ResponseRequest` format
  - Returns: `ResponseObject` format

- **POST /api/v1/agent/chat** - Legacy endpoint (backward compatible)
  - Accepts: `AgentRequest` format
  - Returns: `AgentResponse` format

### Platform Service (Port 8001)

- **POST /v1/responses** - Proxy to agent with database storage
  - Validates request
  - Stores input items
  - Forwards to agent
  - Stores output items
  - Returns response

- **POST /api/v1/proxy/** - Legacy endpoint (backward compatible)

## Data Models

### Request Format

```typescript
{
  "model": "gpt-4",
  "input": "Hello, world!" | [MessageItem, ...],
  "previous_response_id": "resp_xxx",  // Optional
  "instructions": "Additional context",  // Optional
  "temperature": 0.7,  // Optional
  "max_output_tokens": 1000,  // Optional
  "stream": false,  // Optional
  "metadata": {  // Optional
    "session_id": "session_123"
  }
}
```

### Response Format

```typescript
{
  "id": "resp_a1b2c3d4...",
  "created_at": 1234567890,
  "completed_at": 1234567900,
  "model": "gpt-4",
  "status": "completed",
  "output": [
    {
      "id": "msg_x1y2z3...",
      "type": "message",
      "role": "assistant",
      "status": "completed",
      "content": [
        {
          "type": "output_text",
          "text": "Response text here"
        }
      ]
    }
  ],
  "usage": {
    "input_tokens": 10,
    "output_tokens": 20,
    "total_tokens": 30
  },
  "metadata": {}
}
```

### Message Item Format

```typescript
{
  "id": "msg_abc123...",
  "type": "message",
  "role": "user" | "assistant" | "system" | "developer",
  "status": "in_progress" | "incomplete" | "completed" | "failed",
  "content": [
    {
      "type": "input_text" | "output_text",
      "text": "Message content"
    }
  ]
}
```

## Database Schema

### Response Table

Stores Open Responses response objects:

- `id` (PK) - Format: `resp_<uuid>`
- `session_id` - For conversation grouping
- `model` - Model identifier
- `status` - Response status
- `created_at`, `completed_at` - Timestamps
- `input_tokens`, `output_tokens`, `total_tokens` - Usage stats
- `metadata` - JSON field for custom data
- `previous_response_id` - For conversation continuity

### Message Table

Stores Open Responses message items:

- `id` (PK) - Format: `msg_<uuid>`
- `type` - Item type (default: "message")
- `role` - Message role
- `status` - Item status
- `content` - JSON array of content parts
- `response_id` (FK) - Link to Response
- `session_id` - For indexing
- `metadata` - JSON field for additional data

## Testing

### Platform Test

Run Django model and serializer tests:

```bash
cd heureum-platform
.venv/bin/python test_open_responses.py
```

Expected output:
- ✓ Models create and retrieve successfully
- ✓ Serializers validate correctly
- ✓ Response objects serialize properly
- ✓ String input converts to message items

### Agent Test

Run agent endpoint tests:

```bash
cd heureum-agent
.venv/bin/python test_agent.py
```

Expected output:
- ✓ String input processed correctly
- ✓ Items array input processed correctly
- ✓ Response format is valid
- ✓ Usage statistics calculated

### Integration Test

Run full end-to-end tests (requires services running):

```bash
# Terminal 1: Start agent
cd heureum-agent
poetry run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Terminal 2: Start platform
cd heureum-platform
poetry run python manage.py runserver 8001

# Terminal 3: Run integration tests
./test_integration.sh
```

Expected output:
- ✓ Agent service responding at /v1/responses
- ✓ Platform service proxying requests
- ✓ Database storing requests and responses
- ✓ Legacy endpoints still functional

## Usage Examples

### Simple String Input

```bash
curl -X POST http://localhost:8000/v1/responses \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "input": "Hello, how are you?",
    "metadata": {"session_id": "test_session"}
  }'
```

### Items Array Input

```bash
curl -X POST http://localhost:8000/v1/responses \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gpt-4",
    "input": [
      {
        "id": "msg_user_1",
        "type": "message",
        "role": "user",
        "content": [
          {
            "type": "input_text",
            "text": "What is 2+2?"
          }
        ]
      }
    ]
  }'
```

### Via Platform Proxy

```bash
curl -X POST http://localhost:8001/v1/responses \
  -H "Content-Type": application/json" \
  -d '{
    "input": "Hello from platform!",
    "metadata": {"session_id": "platform_test"}
  }'
```

## Frontend Integration

### TypeScript Types

The frontend includes complete TypeScript types in `src/types/index.ts`:

- `MessageItem` - Message structure
- `ResponseRequest` - Request format
- `ResponseObject` - Response format
- `Usage` - Token usage stats
- Helper functions for format conversion

### Helper Functions

```typescript
// Convert legacy Message to Open Responses MessageItem
const item = messageToItem(legacyMessage);

// Convert Open Responses MessageItem to legacy Message
const message = itemToMessage(item);

// Extract text from MessageItem
const text = extractTextFromItem(item);
```

### Example Usage

```typescript
import type { ResponseRequest, ResponseObject } from './types';

async function sendMessage(text: string): Promise<ResponseObject> {
  const request: ResponseRequest = {
    model: 'gpt-4',
    input: text,
    metadata: { session_id: getCurrentSessionId() }
  };

  const response = await fetch('http://localhost:8001/v1/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });

  return response.json();
}
```

## Migration Notes

### Database Migration

The platform includes migrations to convert from the old schema to Open Responses:

```bash
cd heureum-platform
.venv/bin/python manage.py makemigrations
.venv/bin/python manage.py migrate
```

**Note**: If you have existing data, you may need to backup and recreate the database:

```bash
mv db.sqlite3 db.sqlite3.backup
.venv/bin/python manage.py migrate
```

### Backward Compatibility

Both services maintain backward compatibility:

- Agent: `/api/v1/agent/chat` still works with old format
- Platform: `/api/v1/proxy/` still works with old format
- Frontend: Helper functions convert between formats

## Future Enhancements

### Planned Features

1. **Streaming Responses**
   - Server-sent events (SSE)
   - Progressive message delivery
   - Real-time token updates

2. **Tool Calling**
   - Function definitions
   - Tool execution results
   - Parallel tool calls

3. **Multimodal Content**
   - Image inputs
   - File attachments
   - Video content

4. **Reasoning Items**
   - Model thought processes
   - Step-by-step reasoning
   - Confidence scores

5. **Advanced Features**
   - `previous_response_id` for efficient context
   - Truncation strategies
   - Service tier priorities

## Specification Reference

- Official Spec: https://www.openresponses.org/specification
- API Reference: https://www.openresponses.org/reference
- Compliance Tests: https://www.openresponses.org/compliance

## Troubleshooting

### Common Issues

**Issue**: Migration fails with JSON constraint error
```bash
# Solution: Fresh database
mv db.sqlite3 db.sqlite3.backup
.venv/bin/python manage.py migrate
```

**Issue**: Agent returns 500 error
```bash
# Solution: Check agent is using correct imports
# Make sure AssistantMessageItem is used for assistant messages
```

**Issue**: Platform can't connect to agent
```bash
# Solution: Check AGENT_SERVICE_URL in .env
# Default: http://localhost:8000
```

**Issue**: Frontend types not working
```bash
# Solution: Rebuild frontend
cd heureum-frontend
pnpm install
pnpm run build
```

## Contact

For questions or issues:
- Check the official Open Responses spec
- Review the test files for examples
- Check the agent and platform logs for errors
