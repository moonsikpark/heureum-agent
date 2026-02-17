#!/usr/bin/env bash
# =============================================================================
# End-to-end integration test script
#
# Prerequisites:
#   - Agent server running on http://localhost:8000
#   - MCP server running on http://localhost:3001
#
# Usage:
#   ./tests/integration/test_e2e.sh
# =============================================================================
set -euo pipefail

AGENT_URL="http://localhost:8000"
MCP_URL="http://localhost:3001"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

green() { printf "\033[32m%s\033[0m\n" "$1"; }
red()   { printf "\033[31m%s\033[0m\n" "$1"; }
bold()  { printf "\033[1m%s\033[0m\n" "$1"; }

# Save JSON with readable Korean (handles nested JSON strings in 'arguments')
save_json() {
    local json_str="$1" out_path="$2"
    echo "$json_str" | python3 -c "
import sys, json
def fix_nested(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if k == 'arguments' and isinstance(v, str):
                try: obj[k] = json.dumps(json.loads(v), ensure_ascii=False)
                except: pass
            else: fix_nested(v)
    elif isinstance(obj, list):
        for item in obj: fix_nested(item)
data = json.load(sys.stdin)
fix_nested(data)
with open('$out_path', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=4)
    f.write('\n')
" 2>/dev/null || true
}

assert_status() {
    local test_name="$1" url="$2" method="$3" expected="$4"
    shift 4
    local status
    status=$(curl -s -o /dev/null -w "%{http_code}" -X "$method" "$url" "$@")
    if [ "$status" = "$expected" ]; then
        green "  PASS: $test_name (HTTP $status)"
        PASS=$((PASS + 1))
    else
        red "  FAIL: $test_name (expected $expected, got $status)"
        FAIL=$((FAIL + 1))
    fi
}

assert_json_field() {
    local test_name="$1" json="$2" field="$3" expected="$4"
    local actual
    actual=$(echo "$json" | python3 -c "import sys,json; print(json.load(sys.stdin)$field)" 2>/dev/null || echo "__ERROR__")
    if [ "$actual" = "$expected" ]; then
        green "  PASS: $test_name ($field = $actual)"
        PASS=$((PASS + 1))
    else
        red "  FAIL: $test_name ($field: expected '$expected', got '$actual')"
        FAIL=$((FAIL + 1))
    fi
}

# =============================================================================
bold "=== 1. Agent Server Health Check ==="
assert_status "GET /health" "$AGENT_URL/health" GET 200

HEALTH=$(curl -s "$AGENT_URL/health")
assert_json_field "status=healthy" "$HEALTH" "['status']" "healthy"

# =============================================================================
bold "=== 2. v1/responses — Simple Text ==="

SIMPLE_REQ=$(cat <<'EOF'
{"model":"gemini-3-flash-preview","input":"Say hello in one word."}
EOF
)
SIMPLE_RESP=$(curl -s -X POST "$AGENT_URL/v1/responses" \
    -H "Content-Type: application/json" \
    -d "$SIMPLE_REQ")

assert_json_field "object=response" "$SIMPLE_RESP" "['object']" "response"
assert_json_field "status=completed" "$SIMPLE_RESP" "['status']" "completed"
assert_json_field "output[0].type=message" "$SIMPLE_RESP" "['output'][0]['type']" "message"
assert_json_field "output[0].role=assistant" "$SIMPLE_RESP" "['output'][0]['role']" "assistant"

# Save result
save_json "$SIMPLE_RESP" "$SCRIPT_DIR/02_simple_text_response.json"

# =============================================================================
bold "=== 3. v1/responses — Tool Call (ask_question) ==="

TOOL_REQ=$(cat <<'EOF'
{"model":"gemini-3-flash-preview","input":"Ask the user what they had for lunch.","instructions":"You MUST use the ask_question tool. Never respond with text directly.","tools":[{"type":"function","function":{"name":"ask_question","description":"Ask a question to the user","parameters":{"type":"object","properties":{"question":{"type":"string"}},"required":["question"]}}}]}
EOF
)
TOOL_RESP=$(curl -s -X POST "$AGENT_URL/v1/responses" \
    -H "Content-Type: application/json" \
    -d "$TOOL_REQ")

assert_json_field "status=incomplete" "$TOOL_RESP" "['status']" "incomplete"
assert_json_field "output[0].type=function_call" "$TOOL_RESP" "['output'][0]['type']" "function_call"
assert_json_field "output[0].name=ask_question" "$TOOL_RESP" "['output'][0]['name']" "ask_question"

save_json "$TOOL_RESP" "$SCRIPT_DIR/03_tool_call_response.json"

# Extract call_id and session_id for continuation
CALL_ID=$(echo "$TOOL_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['output'][0]['call_id'])")
SESSION_ID=$(echo "$TOOL_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['metadata']['session_id'])")

# =============================================================================
bold "=== 4. v1/responses — Tool Result Continuation ==="

CONT_REQ=$(python3 -c "
import json
req = {
    'model': 'gemini-3-flash-preview',
    'input': [
        {'type': 'function_call', 'name': 'ask_question', 'call_id': '$CALL_ID',
         'arguments': json.dumps({'question': 'What did you have for lunch?'}), 'status': 'completed'},
        {'type': 'function_call_output', 'call_id': '$CALL_ID', 'output': 'I had pizza'}
    ],
    'metadata': {'session_id': '$SESSION_ID'},
    'tools': [{'type': 'function', 'function': {'name': 'ask_question', 'description': 'Ask a question',
               'parameters': {'type': 'object', 'properties': {'question': {'type': 'string'}}, 'required': ['question']}}}]
}
print(json.dumps(req))
")
CONT_RESP=$(curl -s -X POST "$AGENT_URL/v1/responses" \
    -H "Content-Type: application/json" \
    -d "$CONT_REQ")

assert_json_field "status=completed" "$CONT_RESP" "['status']" "completed"
assert_json_field "session preserved" "$CONT_RESP" "['metadata']['session_id']" "$SESSION_ID"
assert_json_field "output[0].type=message" "$CONT_RESP" "['output'][0]['type']" "message"

save_json "$CONT_RESP" "$SCRIPT_DIR/04_tool_result_continuation.json"

# =============================================================================
bold "=== 5. MCP Server — Initialize ==="

MCP_INIT=$(curl -s -X POST "$MCP_URL/mcp" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}}}' \
    | grep '^data: ' | sed 's/^data: //')

assert_json_field "serverInfo.name" "$MCP_INIT" "['result']['serverInfo']['name']" "heureum-web"

save_json "$MCP_INIT" "$SCRIPT_DIR/05_mcp_initialize.json"

# Get session ID for tools/list
MCP_SESSION=$(curl -si -X POST "$MCP_URL/mcp" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"0.1"}}}' \
    | grep -i 'mcp-session-id' | awk '{print $2}' | tr -d '\r')

# =============================================================================
bold "=== 6. MCP Server — Tools List ==="

MCP_TOOLS=$(curl -s -X POST "$MCP_URL/mcp" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -H "Mcp-Session-Id: $MCP_SESSION" \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' \
    | grep '^data: ' | sed 's/^data: //')

TOOL_COUNT=$(echo "$MCP_TOOLS" | python3 -c "import sys,json; print(len(json.load(sys.stdin)['result']['tools']))")
if [ "$TOOL_COUNT" -ge 1 ]; then
    green "  PASS: tools/list returned $TOOL_COUNT tool(s)"
    PASS=$((PASS + 1))
else
    red "  FAIL: tools/list returned $TOOL_COUNT tools (expected >= 1)"
    FAIL=$((FAIL + 1))
fi

save_json "$MCP_TOOLS" "$SCRIPT_DIR/06_mcp_tools_list.json"

# =============================================================================
bold "=== 7. v1/responses — Agentic Loop (web_search with approval) ==="

AGENT_REQ=$(cat <<'EOF'
{"model":"gemini-3-flash-preview","input":"2026년 최신 AI 뉴스를 검색해서 한 줄로 요약해줘.","instructions":"You have access to web_search tool. Use it to search and then summarize in one sentence in Korean.","tools":[{"type":"function","function":{"name":"web_search","description":"Search the web for current information","parameters":{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}}}]}
EOF
)
AGENT_RESP=$(curl -s --max-time 120 -X POST "$AGENT_URL/v1/responses" \
    -H "Content-Type: application/json" \
    -d "$AGENT_REQ")

# web_search requires approval, so the response should be incomplete
# with an ask_question function_call for the approval prompt
assert_json_field "status=incomplete" "$AGENT_RESP" "['status']" "incomplete"
assert_json_field "output[0].type=function_call" "$AGENT_RESP" "['output'][0]['type']" "function_call"
assert_json_field "output[0].name=ask_question" "$AGENT_RESP" "['output'][0]['name']" "ask_question"

save_json "$AGENT_RESP" "$SCRIPT_DIR/07_agentic_loop_web_search.json"

# =============================================================================
echo ""
bold "=== Results ==="
green "Passed: $PASS"
if [ "$FAIL" -gt 0 ]; then
    red "Failed: $FAIL"
    exit 1
else
    green "All tests passed!"
fi
