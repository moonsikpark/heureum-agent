import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8001';

const mockUser = {
  id: 1,
  email: 'test@example.com',
  first_name: 'E2E',
  last_name: 'TestUser',
};

const mockSessions = [
  {
    id: 1,
    session_id: 'sess-aaaa-1111-bbbb-2222',
    title: 'First chat about coding',
    cwd: '/home/user/projects',
    created_at: new Date(Date.now() - 3600000).toISOString(), // 1h ago
    updated_at: new Date(Date.now() - 1800000).toISOString(), // 30m ago
    message_count: 5,
  },
  {
    id: 2,
    session_id: 'sess-cccc-3333-dddd-4444',
    title: 'Discussion about React',
    cwd: null,
    created_at: new Date(Date.now() - 86400000).toISOString(), // 1d ago
    updated_at: new Date(Date.now() - 86400000).toISOString(),
    message_count: 12,
  },
  {
    id: 3,
    session_id: 'sess-eeee-5555-ffff-6666',
    title: null, // Untitled
    cwd: null,
    created_at: new Date(Date.now() - 172800000).toISOString(), // 2d ago
    updated_at: new Date(Date.now() - 172800000).toISOString(),
    message_count: 1,
  },
];

const mockSessionMessages = {
  results: [
    {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: 'Hello, how are you?' }],
    },
    {
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'I am doing well! How can I help you today?' }],
    },
    {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: 'Tell me about JavaScript' }],
    },
    {
      type: 'message',
      role: 'assistant',
      content: [
        {
          type: 'output_text',
          text: 'JavaScript is a versatile programming language used for web development.',
        },
      ],
    },
  ],
};

function makeProxyResponse(text: string, sessionId: string) {
  return {
    id: 'resp-' + Math.random().toString(36).slice(2),
    created_at: Date.now(),
    completed_at: Date.now(),
    model: 'claude-test',
    status: 'completed',
    output: [
      {
        type: 'message',
        role: 'assistant',
        status: 'completed',
        content: [{ type: 'output_text', text }],
      },
    ],
    usage: { input_tokens: 10, output_tokens: 20, total_tokens: 30 },
    metadata: { session_id: sessionId },
  };
}

function makeProxyResponseWithToolCall(
  toolName: string,
  args: string,
  callId: string,
  sessionId: string,
) {
  return {
    id: 'resp-' + Math.random().toString(36).slice(2),
    created_at: Date.now(),
    model: 'claude-test',
    status: 'completed',
    output: [
      {
        type: 'function_call',
        call_id: callId,
        name: toolName,
        arguments: args,
        status: 'completed',
      },
    ],
    metadata: { session_id: sessionId },
  };
}

/** Mock all API routes so tests run without a backend. */
async function mockAuthenticatedApi(
  page: Page,
  overrides: {
    sessions?: () => { status: number; body: unknown };
    sessionMessages?: (sessionId: string) => { status: number; body: unknown };
    proxy?: (body: Record<string, unknown>) => { status: number; body: unknown };
    deleteSession?: (sessionId: string) => { status: number; body: unknown };
    generateTitle?: (sessionId: string) => { status: number; body: unknown };
  } = {},
) {
  // Authenticated session
  await page.route(`${API}/_allauth/browser/v1/auth/session`, (route, request) => {
    if (request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Set-Cookie': 'csrftoken=test-csrf-token; Path=/' },
        body: JSON.stringify({ status: 200, meta: { is_authenticated: true } }),
      });
    }
    // DELETE (logout) — return unauthenticated
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 200, meta: { is_authenticated: false } }),
    });
  });

  // User info
  await page.route(`${API}/api/v1/auth/me/`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUser),
    }),
  );

  // Sessions list
  await page.route(`${API}/api/v1/sessions/`, (route, request) => {
    if (request.method() === 'DELETE') return; // handled by individual session route
    if (overrides.sessions) {
      const res = overrides.sessions();
      return route.fulfill({
        status: res.status,
        contentType: 'application/json',
        body: JSON.stringify(res.body),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSessions),
    });
  });

  // Session messages
  await page.route(`${API}/api/v1/messages/*`, (route) => {
    const url = new URL(route.request().url());
    const sessionId = url.searchParams.get('session_id') || '';
    if (overrides.sessionMessages) {
      const res = overrides.sessionMessages(sessionId);
      return route.fulfill({
        status: res.status,
        contentType: 'application/json',
        body: JSON.stringify(res.body),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSessionMessages),
    });
  });

  // Generate title endpoint
  await page.route(`${API}/api/v1/sessions/*/generate-title/`, (route) => {
    const url = route.request().url();
    const sessionIdMatch = url.match(/sessions\/([^/]+)\/generate-title/);
    const sessionId = sessionIdMatch ? sessionIdMatch[1] : '';
    if (overrides.generateTitle) {
      const res = overrides.generateTitle(sessionId);
      return route.fulfill({
        status: res.status,
        contentType: 'application/json',
        body: JSON.stringify(res.body),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ title: 'Generated Title' }),
    });
  });

  // CWD update endpoint
  await page.route(`${API}/api/v1/sessions/*/cwd/`, (route) => {
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // Individual session operations (delete)
  await page.route(`${API}/api/v1/sessions/*/`, (route, request) => {
    const url = route.request().url();
    const method = request.method();

    if (method === 'DELETE') {
      const sessionIdMatch = url.match(/sessions\/([^/]+)\//);
      const sessionId = sessionIdMatch ? sessionIdMatch[1] : '';
      if (overrides.deleteSession) {
        const res = overrides.deleteSession(sessionId);
        return route.fulfill({
          status: res.status,
          contentType: 'application/json',
          body: JSON.stringify(res.body),
        });
      }
      return route.fulfill({ status: 204, body: '' });
    }

    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // Proxy (chat) endpoint
  await page.route(`${API}/api/v1/proxy/`, (route) => {
    const body = route.request().postDataJSON();
    if (overrides.proxy) {
      const res = overrides.proxy(body);
      return route.fulfill({
        status: res.status,
        contentType: 'application/json',
        body: JSON.stringify(res.body),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(makeProxyResponse('Hello! I am your AI assistant.', 'new-session-id')),
    });
  });
}

async function goToChat(page: Page) {
  await page.goto('/chat');
  await page.waitForResponse((res) => res.url().includes('/_allauth/browser/v1/auth/session'));
  await page.waitForResponse((res) => res.url().includes('/api/v1/auth/me/'));
}

async function sendMessage(page: Page, text: string) {
  await page.fill('.chat-input', text);
  await page.click('.send-button');
}

// ---------------------------------------------------------------------------
// Chat Page Layout
// ---------------------------------------------------------------------------

test.describe('Chat page layout', () => {
  test('displays header with user name, sidebar toggle, and sign out button', async ({
    page,
  }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await expect(page.locator('.user-name')).toHaveText('E2E TestUser');
    await expect(page.locator('.sidebar-toggle-btn')).toBeVisible();
    await expect(page.locator('.logout-button')).toHaveText('Sign out');
  });

  test('displays chat input and send button', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await expect(page.locator('.chat-input')).toBeVisible();
    await expect(page.locator('.send-button')).toBeVisible();
    await expect(page.locator('.send-button')).toBeDisabled();
  });

  test('shows empty state when no messages', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.empty-state')).toContainText('Start a conversation');
  });

  test('sign out navigates to home page', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await page.click('.logout-button');
    await page.waitForURL('**/');
  });
});

// ---------------------------------------------------------------------------
// Chat Input
// ---------------------------------------------------------------------------

test.describe('Chat input', () => {
  test('send button enables when text is entered', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await expect(page.locator('.send-button')).toBeDisabled();
    await page.fill('.chat-input', 'Hello');
    await expect(page.locator('.send-button')).toBeEnabled();
  });

  test('send button disables for whitespace-only input', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await page.fill('.chat-input', '   ');
    await expect(page.locator('.send-button')).toBeDisabled();
  });

  test('sends message on Enter key press', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    const proxyPromise = page.waitForRequest((req) => req.url().includes('/api/v1/proxy/'));
    await page.fill('.chat-input', 'Hello AI');
    await page.press('.chat-input', 'Enter');
    await proxyPromise;

    // Input should be cleared after send
    await expect(page.locator('.chat-input')).toHaveValue('');
  });

  test('Shift+Enter does not send message', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await page.fill('.chat-input', 'Line 1');
    await page.press('.chat-input', 'Shift+Enter');

    // Should NOT clear or send
    // The textarea should still have content
    const value = await page.locator('.chat-input').inputValue();
    expect(value.length).toBeGreaterThan(0);
  });

  test('sends message on send button click', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    const proxyPromise = page.waitForRequest((req) => req.url().includes('/api/v1/proxy/'));
    await sendMessage(page, 'Hello from button click');
    await proxyPromise;

    await expect(page.locator('.chat-input')).toHaveValue('');
  });

  test('input is disabled while loading', async ({ page }) => {
    // Use a slow proxy response so we can observe loading state
    await mockAuthenticatedApi(page);
    await page.route(`${API}/api/v1/proxy/`, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeProxyResponse('Response', 'sess-1')),
      });
    });
    await goToChat(page);

    // Send a message
    await page.fill('.chat-input', 'Hello');
    await page.click('.send-button');

    // Chat input and send button should be disabled while loading
    await expect(page.locator('.chat-input')).toBeDisabled();
    await expect(page.locator('.send-button')).toBeDisabled();
  });
});

// ---------------------------------------------------------------------------
// Message sending and display
// ---------------------------------------------------------------------------

test.describe('Message sending and display', () => {
  test('user message appears in message list', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await sendMessage(page, 'Hello AI!');

    // User message should appear
    const userMsg = page.locator('.message-user .message-content');
    await expect(userMsg).toHaveText('Hello AI!');
  });

  test('assistant response appears after sending message', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await sendMessage(page, 'Hi there');

    // Wait for assistant response
    const assistantMsg = page.locator('.message-assistant .message-content').first();
    await expect(assistantMsg).toHaveText('Hello! I am your AI assistant.', { timeout: 5000 });
  });

  test('empty state disappears after first message', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await expect(page.locator('.empty-state')).toBeVisible();
    await sendMessage(page, 'First message');
    await expect(page.locator('.empty-state')).not.toBeVisible();
  });

  test('loading indicator shows while waiting for response', async ({ page }) => {
    await mockAuthenticatedApi(page);
    // Use a slow proxy response so loading dots are visible
    await page.route(`${API}/api/v1/proxy/`, async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(makeProxyResponse('Response', 'sess-loading')),
      });
    });
    await goToChat(page);

    // Send message — loading dots should appear
    await page.fill('.chat-input', 'Hello');
    await page.click('.send-button');

    // The loading indicator with dots
    await expect(page.locator('.message-content.loading')).toBeVisible();
  });

  test('multiple messages accumulate in the list', async ({ page }) => {
    let callCount = 0;
    await mockAuthenticatedApi(page, {
      proxy: () => {
        callCount++;
        return {
          status: 200,
          body: makeProxyResponse(`Response ${callCount}`, 'sess-multi'),
        };
      },
    });
    await goToChat(page);

    // Send first message
    await sendMessage(page, 'First message');
    await expect(page.locator('.message-assistant .message-content').first()).toHaveText(
      'Response 1',
      { timeout: 5000 },
    );

    // Send second message
    await sendMessage(page, 'Second message');
    await expect(page.locator('.message-assistant .message-content').nth(1)).toHaveText(
      'Response 2',
      { timeout: 5000 },
    );

    // Should have 2 user + 2 assistant messages
    await expect(page.locator('.message-user')).toHaveCount(2);
    await expect(page.locator('.message-assistant')).toHaveCount(2);
  });

  test('error message displays when API fails', async ({ page }) => {
    await mockAuthenticatedApi(page, {
      proxy: () => ({
        status: 500,
        body: { error: 'Internal server error' },
      }),
    });
    await goToChat(page);

    await sendMessage(page, 'This should fail');

    await expect(page.locator('.error-message')).toBeVisible({ timeout: 5000 });
  });

  test('error message displays when API returns failed status', async ({ page }) => {
    await mockAuthenticatedApi(page, {
      proxy: () => ({
        status: 200,
        body: {
          id: 'resp-fail',
          created_at: Date.now(),
          model: 'claude-test',
          status: 'failed',
          output: [],
          error: { type: 'server_error', message: 'Model overloaded' },
        },
      }),
    });
    await goToChat(page);

    await sendMessage(page, 'Test failure');

    await expect(page.locator('.error-message')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.error-message')).toContainText('Model overloaded');
  });
});

// ---------------------------------------------------------------------------
// Question prompt (ask_question tool)
// ---------------------------------------------------------------------------

test.describe('Question prompt', () => {
  test('displays question with choices when AI asks', async ({ page }) => {
    let proxyCallCount = 0;
    await mockAuthenticatedApi(page, {
      proxy: (body) => {
        proxyCallCount++;
        if (proxyCallCount === 1) {
          return {
            status: 200,
            body: makeProxyResponseWithToolCall(
              'ask_question',
              JSON.stringify({
                question: 'Which language do you prefer?',
                choices: ['JavaScript', 'Python', 'Rust'],
                allow_user_input: false,
              }),
              'call-q1',
              'sess-question',
            ),
          };
        }
        // Second call after user answers
        return {
          status: 200,
          body: makeProxyResponse('Great choice!', 'sess-question'),
        };
      },
    });
    await goToChat(page);

    await sendMessage(page, 'Ask me something');

    // Question prompt should appear as bottom panel
    await expect(page.locator('.question-panel')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.question-panel-text')).toHaveText('Which language do you prefer?');

    // Choices should be visible
    await expect(page.locator('.question-panel-choice').nth(0)).toContainText('JavaScript');
    await expect(page.locator('.question-panel-choice').nth(1)).toContainText('Python');
    await expect(page.locator('.question-panel-choice').nth(2)).toContainText('Rust');
  });

  test('selecting a choice and submitting answers the question', async ({ page }) => {
    let proxyCallCount = 0;
    await mockAuthenticatedApi(page, {
      proxy: (body) => {
        proxyCallCount++;
        if (proxyCallCount === 1) {
          return {
            status: 200,
            body: makeProxyResponseWithToolCall(
              'ask_question',
              JSON.stringify({
                question: 'Pick a color',
                choices: ['Red', 'Blue', 'Green'],
                allow_user_input: false,
              }),
              'call-q2',
              'sess-q2',
            ),
          };
        }
        return {
          status: 200,
          body: makeProxyResponse('You picked Blue!', 'sess-q2'),
        };
      },
    });
    await goToChat(page);

    await sendMessage(page, 'Ask me');
    await expect(page.locator('.question-panel')).toBeVisible({ timeout: 5000 });

    // Select "Blue"
    await page.locator('.question-panel-choice', { hasText: 'Blue' }).click();
    await expect(page.locator('.question-panel-choice', { hasText: 'Blue' })).toHaveClass(/selected/);

    // Submit should be enabled
    await expect(page.locator('.question-panel-submit')).toBeEnabled();
    await page.click('.question-panel-submit');

    // Should show the AI's follow-up response
    await expect(page.locator('.message-assistant .message-content').last()).toHaveText(
      'You picked Blue!',
      { timeout: 5000 },
    );
  });

  test('submit disabled until choice is selected', async ({ page }) => {
    let proxyCallCount = 0;
    await mockAuthenticatedApi(page, {
      proxy: () => {
        proxyCallCount++;
        if (proxyCallCount === 1) {
          return {
            status: 200,
            body: makeProxyResponseWithToolCall(
              'ask_question',
              JSON.stringify({
                question: 'Yes or no?',
                choices: ['Yes', 'No'],
                allow_user_input: false,
              }),
              'call-q3',
              'sess-q3',
            ),
          };
        }
        return { status: 200, body: makeProxyResponse('OK', 'sess-q3') };
      },
    });
    await goToChat(page);

    await sendMessage(page, 'Ask');
    await expect(page.locator('.question-panel')).toBeVisible({ timeout: 5000 });

    // Submit should be disabled initially
    await expect(page.locator('.question-panel-submit')).toBeDisabled();

    // Select a choice
    await page.locator('.question-panel-choice', { hasText: 'Yes' }).click();
    await expect(page.locator('.question-panel-submit')).toBeEnabled();
  });

  test('question with allow_user_input shows Other button and textarea', async ({ page }) => {
    let proxyCallCount = 0;
    await mockAuthenticatedApi(page, {
      proxy: () => {
        proxyCallCount++;
        if (proxyCallCount === 1) {
          return {
            status: 200,
            body: makeProxyResponseWithToolCall(
              'ask_question',
              JSON.stringify({
                question: 'What is your favorite food?',
                choices: ['Pizza', 'Sushi', 'Other'],
                allow_user_input: true,
              }),
              'call-q4',
              'sess-q4',
            ),
          };
        }
        return { status: 200, body: makeProxyResponse('Yum!', 'sess-q4') };
      },
    });
    await goToChat(page);

    await sendMessage(page, 'Ask about food');
    await expect(page.locator('.question-panel')).toBeVisible({ timeout: 5000 });

    // "Other" from choices should be filtered out, replaced by the "Other..." button
    await expect(page.locator('.question-panel-choice-other')).toBeVisible();

    // Click "Other..." to show custom input
    await page.click('.question-panel-choice-other');
    await expect(page.locator('.question-panel-input')).toBeVisible();

    // Submit should be disabled until text is entered
    await expect(page.locator('.question-panel-submit')).toBeDisabled();

    // Type custom answer
    await page.fill('.question-panel-input', 'Tacos');
    await expect(page.locator('.question-panel-submit')).toBeEnabled();

    // Submit
    await page.click('.question-panel-submit');
    await expect(page.locator('.message-assistant .message-content').last()).toHaveText('Yum!', {
      timeout: 5000,
    });
  });

  test('answered question shows in message list', async ({ page }) => {
    let proxyCallCount = 0;
    await mockAuthenticatedApi(page, {
      proxy: () => {
        proxyCallCount++;
        if (proxyCallCount === 1) {
          return {
            status: 200,
            body: makeProxyResponseWithToolCall(
              'ask_question',
              JSON.stringify({
                question: 'Pick one',
                choices: ['A', 'B'],
                allow_user_input: false,
              }),
              'call-q5',
              'sess-q5',
            ),
          };
        }
        return { status: 200, body: makeProxyResponse('Done', 'sess-q5') };
      },
    });
    await goToChat(page);

    await sendMessage(page, 'Question test');
    await expect(page.locator('.question-panel')).toBeVisible({ timeout: 5000 });

    await page.locator('.question-panel-choice', { hasText: 'A' }).first().click();
    await page.click('.question-panel-submit');

    // Wait for the follow-up response
    await expect(page.locator('.message-assistant .message-content').last()).toHaveText('Done', {
      timeout: 5000,
    });

    // The answered question should be visible in the messages
    await expect(page.locator('.question-block.answered')).toBeVisible();
    await expect(page.locator('.question-answer-display')).toContainText('Selected: A');
  });
});

// ---------------------------------------------------------------------------
// Chat Sidebar
// ---------------------------------------------------------------------------

test.describe('Chat sidebar', () => {
  test('sidebar opens and closes with toggle button', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    const sidebar = page.locator('.chat-sidebar');

    // Click hamburger to open
    await page.click('.sidebar-toggle-btn');
    await expect(sidebar).toHaveClass(/open/);

    // Click hamburger again to close (close button is only visible on mobile)
    await page.click('.sidebar-toggle-btn');
    await expect(sidebar).not.toHaveClass(/open/);
  });

  test('sidebar displays session list with titles', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await page.click('.sidebar-toggle-btn');

    // Should show sessions
    const items = page.locator('.sidebar-session-item');
    await expect(items).toHaveCount(3, { timeout: 5000 });

    // First session
    await expect(items.nth(0).locator('.session-item-title')).toHaveText(
      'First chat about coding',
    );

    // Second session
    await expect(items.nth(1).locator('.session-item-title')).toHaveText(
      'Discussion about React',
    );

    // Third session (null title should show "Untitled Chat")
    await expect(items.nth(2).locator('.session-item-title')).toHaveText('Untitled Chat');
  });

  test('sidebar shows message count for each session', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await page.click('.sidebar-toggle-btn');

    const firstMeta = page.locator('.sidebar-session-item').nth(0).locator('.session-item-meta');
    await expect(firstMeta).toContainText('5 messages');

    const secondMeta = page.locator('.sidebar-session-item').nth(1).locator('.session-item-meta');
    await expect(secondMeta).toContainText('12 messages');
  });

  test('sidebar shows time ago for sessions', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await page.click('.sidebar-toggle-btn');

    // First session: 30m ago
    const firstMeta = page.locator('.sidebar-session-item').nth(0).locator('.session-item-meta');
    await expect(firstMeta).toContainText('30m ago');

    // Second session: 1d ago
    const secondMeta = page.locator('.sidebar-session-item').nth(1).locator('.session-item-meta');
    await expect(secondMeta).toContainText('1d ago');
  });

  test('clicking a session loads its messages', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await page.click('.sidebar-toggle-btn');

    // Click the first session
    const msgPromise = page.waitForResponse((res) => res.url().includes('/api/v1/messages/'));
    await page.locator('.sidebar-session-item').nth(0).click();
    await msgPromise;

    // Sidebar should close after selection
    await expect(page.locator('.chat-sidebar')).not.toHaveClass(/open/);

    // Messages should be loaded
    await expect(page.locator('.message-user').first()).toBeVisible({ timeout: 5000 });
    const userMessages = page.locator('.message-user .message-content');
    await expect(userMessages.first()).toHaveText('Hello, how are you?');
  });

  test('new chat button clears current chat', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    // First, send a message to have some content
    await sendMessage(page, 'Some message');
    await expect(page.locator('.message-user')).toHaveCount(1, { timeout: 5000 });

    // Open sidebar and click "New Chat"
    await page.click('.sidebar-toggle-btn');
    await page.click('.sidebar-new-chat-btn');

    // Messages should be cleared
    await expect(page.locator('.empty-state')).toBeVisible();
    await expect(page.locator('.message-user')).toHaveCount(0);
  });

  test('deleting a session removes it from the list', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await page.click('.sidebar-toggle-btn');
    await expect(page.locator('.sidebar-session-item')).toHaveCount(3, { timeout: 5000 });

    // Hover over first session to reveal delete button, then click
    await page.locator('.sidebar-session-item').nth(0).hover();
    await page.locator('.sidebar-session-item').nth(0).locator('.session-delete-btn').click();

    // Session should be removed
    await expect(page.locator('.sidebar-session-item')).toHaveCount(2, { timeout: 5000 });
  });

  test('sidebar shows empty state when no sessions exist', async ({ page }) => {
    await mockAuthenticatedApi(page, {
      sessions: () => ({ status: 200, body: [] }),
    });
    await goToChat(page);

    await page.click('.sidebar-toggle-btn');
    await expect(page.locator('.sidebar-empty')).toHaveText('No previous chats');
  });

  test('sidebar shows loading state', async ({ page }) => {
    // Add a delay to the sessions endpoint
    await mockAuthenticatedApi(page);

    // Override sessions to be slow
    await page.route(`${API}/api/v1/sessions/`, async (route) => {
      await new Promise((r) => setTimeout(r, 1000));
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSessions),
      });
    });

    await goToChat(page);
    await page.click('.sidebar-toggle-btn');

    // Should show loading
    await expect(page.locator('.sidebar-loading')).toBeVisible();
  });

  test('sidebar refreshes when a new session is created', async ({ page }) => {
    let sessionCallCount = 0;
    await mockAuthenticatedApi(page, {
      sessions: () => {
        sessionCallCount++;
        if (sessionCallCount === 1) {
          return { status: 200, body: [] };
        }
        // After a message is sent, show the new session
        return {
          status: 200,
          body: [
            {
              id: 10,
              session_id: 'new-session-id',
              title: 'New Chat',
              cwd: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              message_count: 1,
            },
          ],
        };
      },
    });
    await goToChat(page);

    // Send a message to create a new session
    await sendMessage(page, 'Hello');
    await expect(page.locator('.message-assistant .message-content').first()).toBeVisible({
      timeout: 5000,
    });

    // Open sidebar — should show the new session
    await page.click('.sidebar-toggle-btn');
    await expect(page.locator('.sidebar-session-item')).toHaveCount(1, { timeout: 5000 });
    await expect(page.locator('.session-item-title')).toHaveText('New Chat');
  });

  test('deleting active session clears the chat', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    // Send a message to establish a session
    await sendMessage(page, 'Hello');
    await expect(page.locator('.message-assistant .message-content').first()).toBeVisible({
      timeout: 5000,
    });

    // Open sidebar, load a session
    await page.click('.sidebar-toggle-btn');
    const msgPromise = page.waitForResponse((res) => res.url().includes('/api/v1/messages/'));
    await page.locator('.sidebar-session-item').nth(0).click();
    await msgPromise;

    // Now reopen sidebar and delete that session
    await page.click('.sidebar-toggle-btn');
    await page.locator('.sidebar-session-item').nth(0).hover();

    // The active session's delete should clear messages
    const sessionId = mockSessions[0].session_id;
    await page.locator('.sidebar-session-item.active .session-delete-btn').click();

    // Chat should be cleared
    await expect(page.locator('.empty-state')).toBeVisible({ timeout: 5000 });
  });

  test('sidebar closes when clicking overlay', async ({ page }) => {
    await mockAuthenticatedApi(page);

    // Set a mobile viewport so overlay is visible
    await page.setViewportSize({ width: 375, height: 812 });
    await goToChat(page);

    await page.click('.sidebar-toggle-btn');
    await expect(page.locator('.chat-sidebar')).toHaveClass(/open/);

    // Click the overlay
    await page.locator('.sidebar-overlay').click({ force: true });
    await expect(page.locator('.chat-sidebar')).not.toHaveClass(/open/);
  });
});

// ---------------------------------------------------------------------------
// Session management
// ---------------------------------------------------------------------------

test.describe('Session management', () => {
  test('session ID appears in chat header after first message', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    // No session ID initially
    await expect(page.locator('.session-id')).not.toBeVisible();

    await sendMessage(page, 'Hello');
    await expect(page.locator('.message-assistant .message-content').first()).toBeVisible({
      timeout: 5000,
    });

    // Session ID should now be visible
    await expect(page.locator('.session-id')).toBeVisible();
    await expect(page.locator('.session-id')).toContainText('Session: new-sess');
  });

  test('title is generated for new sessions', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    // Wait for both the assistant response and the title generation request
    const titlePromise = page.waitForRequest(
      (req) => req.url().includes('generate-title'),
      { timeout: 10000 },
    );

    await sendMessage(page, 'Hello');
    await expect(page.locator('.message-assistant .message-content').first()).toBeVisible({
      timeout: 5000,
    });

    // The title generation request should have been made
    await titlePromise;
  });
});

// ---------------------------------------------------------------------------
// Theme toggle
// ---------------------------------------------------------------------------

test.describe('Theme toggle', () => {
  test('theme toggle switches between light and dark', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    // Get initial theme
    const initialTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );

    // Click theme toggle
    await page.click('.theme-toggle');

    const newTheme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );

    expect(newTheme).not.toBe(initialTheme);
    expect(['light', 'dark']).toContain(newTheme);
  });

  test('theme persists after toggle', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    // Set to dark
    await page.evaluate(() => {
      localStorage.setItem('heureum-theme', 'dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    });

    // Reload
    await page.reload();
    await page.waitForResponse((res) => res.url().includes('/_allauth/browser/v1/auth/session'));

    const theme = await page.evaluate(() =>
      document.documentElement.getAttribute('data-theme'),
    );
    expect(theme).toBe('dark');
  });
});

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

test.describe('Home page', () => {
  test('unauthenticated user sees landing page with sign in button', async ({ page }) => {
    // Mock as unauthenticated
    await page.route(`${API}/_allauth/browser/v1/auth/session`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Set-Cookie': 'csrftoken=test-csrf-token; Path=/' },
        body: JSON.stringify({ status: 200, meta: { is_authenticated: false } }),
      }),
    );

    await page.goto('/');
    await page.waitForResponse((res) => res.url().includes('/_allauth/browser/v1/auth/session'));

    await expect(page.locator('.landing-headline')).toBeVisible();
    await expect(page.locator('.nav-cta')).toHaveText('Sign in');
  });

  test('sign in button navigates to login page', async ({ page }) => {
    await page.route(`${API}/_allauth/browser/v1/auth/session`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Set-Cookie': 'csrftoken=test-csrf-token; Path=/' },
        body: JSON.stringify({ status: 200, meta: { is_authenticated: false } }),
      }),
    );

    await page.goto('/');
    await page.waitForResponse((res) => res.url().includes('/_allauth/browser/v1/auth/session'));

    await page.click('.nav-cta');
    await page.waitForURL('**/login');
  });

  test('authenticated user sees Open Chat and welcome message', async ({ page }) => {
    await mockAuthenticatedApi(page);

    // Home page should redirect to /chat for authenticated users
    await page.goto('/');
    await page.waitForURL('**/chat', { timeout: 5000 });
  });

  test('Get Started button navigates to login', async ({ page }) => {
    await page.route(`${API}/_allauth/browser/v1/auth/session`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Set-Cookie': 'csrftoken=test-csrf-token; Path=/' },
        body: JSON.stringify({ status: 200, meta: { is_authenticated: false } }),
      }),
    );

    await page.goto('/');
    await page.waitForResponse((res) => res.url().includes('/_allauth/browser/v1/auth/session'));

    await page.click('.hero-cta-button');
    await page.waitForURL('**/login');
  });
});

// ---------------------------------------------------------------------------
// Routing / Auth guards
// ---------------------------------------------------------------------------

test.describe('Route guards', () => {
  test('unauthenticated user is redirected from /chat to /login', async ({ page }) => {
    await page.route(`${API}/_allauth/browser/v1/auth/session`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Set-Cookie': 'csrftoken=test-csrf-token; Path=/' },
        body: JSON.stringify({ status: 200, meta: { is_authenticated: false } }),
      }),
    );

    await page.goto('/chat');
    await page.waitForURL('**/login', { timeout: 5000 });
  });

  test('authenticated user is redirected from /login to /chat', async ({ page }) => {
    await mockAuthenticatedApi(page);

    await page.goto('/login');
    await page.waitForURL('**/chat', { timeout: 5000 });
  });

  test('authenticated user is redirected from / to /chat', async ({ page }) => {
    await mockAuthenticatedApi(page);

    await page.goto('/');
    await page.waitForURL('**/chat', { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Message role labels
// ---------------------------------------------------------------------------

test.describe('Message rendering', () => {
  test('user messages show "user" role label', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await sendMessage(page, 'Hello');

    const userRole = page.locator('.message-user .message-role');
    await expect(userRole).toHaveText('user');
  });

  test('assistant messages show "assistant" role label', async ({ page }) => {
    await mockAuthenticatedApi(page);
    await goToChat(page);

    await sendMessage(page, 'Hello');

    const assistantRole = page.locator('.message-assistant .message-role').first();
    await expect(assistantRole).toHaveText('assistant', { timeout: 5000 });
  });
});

// ---------------------------------------------------------------------------
// Failed response handling
// ---------------------------------------------------------------------------

test.describe('Failed response handling', () => {
  test('shows error when agent returns response.failed via SSE', async ({ page }) => {
    const failedSSE = [
      'data: ' +
        JSON.stringify({
          type: 'response.failed',
          response: {
            status: 'failed',
            error: { type: 'server_error', message: 'Agent service error: Connection refused' },
            metadata: { session_id: 'new-session-id' },
          },
        }),
      'data: [DONE]',
      '',
    ].join('\n');

    await mockAuthenticatedApi(page, {
      proxy: () => ({ status: 200, body: '' }), // placeholder, overridden below
    });

    // Override proxy route with SSE response
    await page.route(`${API}/api/v1/proxy/`, (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        body: failedSSE,
      });
    });

    await goToChat(page);
    await page.fill('.ac-input', 'Hello');
    await page.click('.ac-send-btn');

    await expect(page.locator('.ac-error')).toContainText('Agent service error', { timeout: 5000 });
  });

  test('shows error when proxy returns HTTP error', async ({ page }) => {
    await mockAuthenticatedApi(page, {
      proxy: () => ({ status: 502, body: { type: 'server_error', message: 'Bad gateway' } }),
    });

    await goToChat(page);
    await page.fill('.ac-input', 'Hello');
    await page.click('.ac-send-btn');

    await expect(page.locator('.ac-error')).toBeVisible({ timeout: 5000 });
  });
});
