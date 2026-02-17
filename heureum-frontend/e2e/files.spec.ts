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
    session_id: 'sess-file-test-1111',
    title: 'File Test Session',
    cwd: null,
    created_at: new Date(Date.now() - 3600000).toISOString(),
    updated_at: new Date(Date.now() - 1800000).toISOString(),
    message_count: 2,
    total_cost: 0,
  },
];

const mockSessionMessages = {
  results: [
    {
      type: 'message',
      role: 'user',
      content: [{ type: 'input_text', text: 'Hello' }],
    },
    {
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: 'Hi there!' }],
    },
  ],
  next: null,
};

const mockFiles = [
  {
    id: 'sf_abc123',
    path: 'notes.md',
    filename: 'notes.md',
    content_type: 'text/markdown',
    size: 42,
    is_text: true,
    created_by: 'user',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sf_def456',
    path: 'photo.png',
    filename: 'photo.png',
    content_type: 'image/png',
    size: 12345,
    is_text: false,
    created_by: 'agent',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'sf_ghi789',
    path: 'todo.md',
    filename: 'todo.md',
    content_type: 'text/markdown',
    size: 100,
    is_text: true,
    text_content: '- [ ] Buy groceries\n- [x] Clean house',
    created_by: 'agent',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

/** Set up route mocks for an authenticated user with an active session. */
async function mockApiWithFiles(
  page: Page,
  overrides: {
    files?: () => { status: number; body: unknown };
    fileDetail?: (fileId: string) => { status: number; body: unknown };
    fileUpload?: () => { status: number; body: unknown };
    fileUpdate?: (fileId: string) => { status: number; body: unknown };
    fileDelete?: (fileId: string) => { status: number; body: unknown };
    fileDownload?: (fileId: string) => { status: number; body: unknown };
  } = {},
) {
  // Auth session
  await page.route(`${API}/_allauth/browser/v1/auth/session`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'Set-Cookie': 'csrftoken=test-csrf-token; Path=/' },
      body: JSON.stringify({ status: 200, meta: { is_authenticated: true } }),
    }),
  );

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
    if (request.method() === 'DELETE') return;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSessions),
    });
  });

  // Session messages
  await page.route(`${API}/api/v1/messages/*`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockSessionMessages),
    }),
  );

  // Generate title
  await page.route(`${API}/api/v1/sessions/*/generate-title/`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ title: 'Test Title' }),
    }),
  );

  // CWD update
  await page.route(`${API}/api/v1/sessions/*/cwd/`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }),
  );

  // Individual session operations
  await page.route(`${API}/api/v1/sessions/*/`, (route, request) => {
    if (request.method() === 'DELETE') {
      return route.fulfill({ status: 204, body: '' });
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // Suggested questions
  await page.route(`${API}/api/v1/suggested-questions/`, (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );

  // ── File endpoints ──

  // File list (GET) and upload (POST)
  await page.route(`${API}/api/v1/sessions/*/files/`, (route, request) => {
    // Skip if URL includes a deeper path (e.g., /files/read/, /files/write/)
    const url = request.url();
    const afterFiles = url.split('/files/')[1];
    if (afterFiles && afterFiles.length > 0 && !afterFiles.startsWith('?')) {
      return route.fallback();
    }

    if (request.method() === 'POST') {
      if (overrides.fileUpload) {
        const res = overrides.fileUpload();
        return route.fulfill({
          status: res.status,
          contentType: 'application/json',
          body: JSON.stringify(res.body),
        });
      }
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'sf_new_' + Date.now(),
          path: 'uploaded.txt',
          filename: 'uploaded.txt',
          content_type: 'text/plain',
          size: 100,
          is_text: true,
          text_content: 'uploaded content',
          created_by: 'user',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      });
    }

    // GET - list files
    if (overrides.files) {
      const res = overrides.files();
      return route.fulfill({
        status: res.status,
        contentType: 'application/json',
        body: JSON.stringify(res.body),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockFiles),
    });
  });

  // File detail (GET/PUT/DELETE) - /files/{id}/
  await page.route(new RegExp(`${API}/api/v1/sessions/[^/]+/files/sf_[^/]+/$`), (route, request) => {
    const url = request.url();
    const fileIdMatch = url.match(/files\/(sf_[^/]+)\//);
    const fileId = fileIdMatch ? fileIdMatch[1] : '';

    if (request.method() === 'GET') {
      if (overrides.fileDetail) {
        const res = overrides.fileDetail(fileId);
        return route.fulfill({
          status: res.status,
          contentType: 'application/json',
          body: JSON.stringify(res.body),
        });
      }
      const file = mockFiles.find((f) => f.id === fileId) || mockFiles[0];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...file, text_content: file.is_text ? 'File content here' : null }),
      });
    }

    if (request.method() === 'PUT') {
      if (overrides.fileUpdate) {
        const res = overrides.fileUpdate(fileId);
        return route.fulfill({
          status: res.status,
          contentType: 'application/json',
          body: JSON.stringify(res.body),
        });
      }
      const body = request.postDataJSON();
      const file = mockFiles.find((f) => f.id === fileId) || mockFiles[0];
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...file, text_content: body.text_content, size: body.text_content?.length || 0 }),
      });
    }

    if (request.method() === 'DELETE') {
      if (overrides.fileDelete) {
        const res = overrides.fileDelete(fileId);
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

  // File download - /files/{id}/download/
  await page.route(new RegExp(`${API}/api/v1/sessions/[^/]+/files/sf_[^/]+/download/`), (route) => {
    const url = route.request().url();
    const fileIdMatch = url.match(/files\/(sf_[^/]+)\/download/);
    const fileId = fileIdMatch ? fileIdMatch[1] : '';

    if (overrides.fileDownload) {
      const res = overrides.fileDownload(fileId);
      return route.fulfill({
        status: res.status,
        body: res.body as string,
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'text/plain',
      body: 'File content for download',
    });
  });
}

async function goToChat(page: Page) {
  await page.goto('/chat');
  await page.waitForResponse((res) => res.url().includes('/_allauth/browser/v1/auth/session'));
  await page.waitForResponse((res) => res.url().includes('/api/v1/auth/me/'));
}

async function openSession(page: Page) {
  // Wait for session items to appear (loaded asynchronously)
  await page.waitForSelector('.ac-sb-session', { timeout: 5000 });
  // Set up response listener before clicking to avoid race condition
  const msgPromise = page.waitForResponse((res) => res.url().includes('/api/v1/messages/'));
  await page.click('.ac-sb-session');
  await msgPromise;
}

// ═══════════════════════════════════════════════════════════════════════════════
// File Panel Toggle
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('File panel toggle', () => {
  test('file button is hidden when no session is active', async ({ page }) => {
    await mockApiWithFiles(page);
    await goToChat(page);

    // No session active on new chat — button should be absent
    await expect(page.locator('.ac-topbar-files')).not.toBeVisible();
  });

  test('file button appears when a session is active', async ({ page }) => {
    await mockApiWithFiles(page);
    await goToChat(page);
    await openSession(page);

    await expect(page.locator('.ac-topbar-files')).toBeVisible();
  });

  test('clicking file button opens the file panel', async ({ page }) => {
    await mockApiWithFiles(page);
    await goToChat(page);
    await openSession(page);

    // Panel should not be visible initially
    await expect(page.locator('.fp-panel')).not.toBeVisible();

    // Click file button
    await page.click('.ac-topbar-files');

    // Panel should appear
    await expect(page.locator('.fp-panel')).toBeVisible();
    await expect(page.locator('.fp-title')).toHaveText('Files');
  });

  test('clicking file button again closes the panel', async ({ page }) => {
    await mockApiWithFiles(page);
    await goToChat(page);
    await openSession(page);

    await page.click('.ac-topbar-files');
    await expect(page.locator('.fp-panel')).toBeVisible();

    await page.click('.ac-topbar-files');
    await expect(page.locator('.fp-panel')).not.toBeVisible();
  });

  test('close button inside panel closes it', async ({ page }) => {
    await mockApiWithFiles(page);
    await goToChat(page);
    await openSession(page);

    await page.click('.ac-topbar-files');
    await expect(page.locator('.fp-panel')).toBeVisible();

    await page.click('.fp-btn-close');
    await expect(page.locator('.fp-panel')).not.toBeVisible();
  });

  test('file button has active class when panel is open', async ({ page }) => {
    await mockApiWithFiles(page);
    await goToChat(page);
    await openSession(page);

    await expect(page.locator('.ac-topbar-files')).not.toHaveClass(/active/);

    await page.click('.ac-topbar-files');
    await expect(page.locator('.ac-topbar-files')).toHaveClass(/active/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// File List
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('File list', () => {
  test('shows files when panel opens', async ({ page }) => {
    await mockApiWithFiles(page);
    await goToChat(page);
    await openSession(page);
    await page.click('.ac-topbar-files');

    // Wait for file list to populate
    await expect(page.locator('.fp-file-item')).toHaveCount(3);
  });

  test('displays file names and sizes', async ({ page }) => {
    await mockApiWithFiles(page);
    await goToChat(page);
    await openSession(page);
    await page.click('.ac-topbar-files');

    await expect(page.locator('.fp-file-item')).toHaveCount(3);

    // Check first file name
    const firstFileName = page.locator('.fp-file-item').first().locator('.fp-file-name');
    await expect(firstFileName).toHaveText('notes.md');
  });

  test('shows agent badge for agent-created files', async ({ page }) => {
    await mockApiWithFiles(page);
    await goToChat(page);
    await openSession(page);
    await page.click('.ac-topbar-files');

    // photo.png and todo.md are created by agent
    const badges = page.locator('.fp-badge');
    await expect(badges).toHaveCount(2);
  });

  test('shows empty state when no files', async ({ page }) => {
    await mockApiWithFiles(page, {
      files: () => ({ status: 200, body: [] }),
    });
    await goToChat(page);
    await openSession(page);
    await page.click('.ac-topbar-files');

    await expect(page.locator('.fp-empty')).toBeVisible();
    await expect(page.locator('.fp-empty')).toHaveText('No files yet');
  });

  test('shows upload zone', async ({ page }) => {
    await mockApiWithFiles(page);
    await goToChat(page);
    await openSession(page);
    await page.click('.ac-topbar-files');

    await expect(page.locator('.fp-upload-zone')).toBeVisible();
    await expect(page.locator('.fp-upload-zone')).toContainText('Drop files here or click to upload');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// File Editor
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('File editor', () => {
  test('clicking a text file opens the editor', async ({ page }) => {
    await mockApiWithFiles(page);
    await goToChat(page);
    await openSession(page);
    await page.click('.ac-topbar-files');

    // Click on the first text file (notes.md)
    await page.locator('.fp-file-item').first().click();

    // Editor should appear
    await expect(page.locator('.fp-editor')).toBeVisible();
    await expect(page.locator('.fp-editor-path')).toHaveText('notes.md');
    await expect(page.locator('.fp-editor-textarea')).toBeVisible();
  });

  test('back button returns to file list', async ({ page }) => {
    await mockApiWithFiles(page);
    await goToChat(page);
    await openSession(page);
    await page.click('.ac-topbar-files');

    // Open editor
    await page.locator('.fp-file-item').first().click();
    await expect(page.locator('.fp-editor')).toBeVisible();

    // Click back
    await page.click('.fp-btn-back');

    // Should return to list mode
    await expect(page.locator('.fp-editor')).not.toBeVisible();
    await expect(page.locator('.fp-list')).toBeVisible();
  });

  test('save button triggers API call', async ({ page }) => {
    let updateCalled = false;
    await mockApiWithFiles(page, {
      fileUpdate: (fileId) => {
        updateCalled = true;
        return {
          status: 200,
          body: { ...mockFiles[0], text_content: 'Updated!' },
        };
      },
    });
    await goToChat(page);
    await openSession(page);
    await page.click('.ac-topbar-files');

    // Open editor for first file
    await page.locator('.fp-file-item').first().click();

    // Modify content
    await page.locator('.fp-editor-textarea').fill('Updated content');

    // Click save
    await page.click('.fp-btn-save');

    // Wait a moment for the request
    await page.waitForTimeout(500);
    expect(updateCalled).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// File Preview (binary files)
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('File preview', () => {
  test('clicking a binary file opens preview mode', async ({ page }) => {
    await mockApiWithFiles(page);
    await goToChat(page);
    await openSession(page);
    await page.click('.ac-topbar-files');

    // Click on photo.png (second file, binary)
    await page.locator('.fp-file-item').nth(1).click();

    // Preview should appear (not editor)
    await expect(page.locator('.fp-preview')).toBeVisible();
    await expect(page.locator('.fp-editor')).not.toBeVisible();
    await expect(page.locator('.fp-editor-path')).toHaveText('photo.png');
  });

  test('image files show image preview', async ({ page }) => {
    await mockApiWithFiles(page);
    await goToChat(page);
    await openSession(page);
    await page.click('.ac-topbar-files');

    // Click on photo.png
    await page.locator('.fp-file-item').nth(1).click();

    // Should render an img tag
    await expect(page.locator('.fp-preview-image')).toBeVisible();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// File Delete
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('File delete', () => {
  test('delete button removes file from list', async ({ page }) => {
    let deleteCalled = false;
    await mockApiWithFiles(page, {
      fileDelete: (fileId) => {
        deleteCalled = true;
        return { status: 204, body: '' };
      },
    });
    await goToChat(page);
    await openSession(page);
    await page.click('.ac-topbar-files');

    await expect(page.locator('.fp-file-item')).toHaveCount(3);

    // Hover to reveal delete button and accept confirmation
    page.on('dialog', (dialog) => dialog.accept());
    const firstItem = page.locator('.fp-file-item').first();
    await firstItem.hover();
    await firstItem.locator('.fp-btn-danger').click();

    // Wait for deletion
    await page.waitForTimeout(500);
    expect(deleteCalled).toBe(true);

    // File should be removed from the list
    await expect(page.locator('.fp-file-item')).toHaveCount(2);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// File Download
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('File download', () => {
  test('download button triggers download', async ({ page }) => {
    let downloadRequested = false;
    await mockApiWithFiles(page, {
      fileDownload: (fileId) => {
        downloadRequested = true;
        return { status: 200, body: 'file-content-here' };
      },
    });
    await goToChat(page);
    await openSession(page);
    await page.click('.ac-topbar-files');

    // Hover over first file to reveal action buttons
    const firstItem = page.locator('.fp-file-item').first();
    await firstItem.hover();

    // Click download button (first button in actions)
    const downloadBtn = firstItem.locator('.fp-btn-icon').first();
    const downloadPromise = page.waitForEvent('download').catch(() => null);
    await downloadBtn.click();

    // The download will be triggered via blob URL
    await page.waitForTimeout(500);
    expect(downloadRequested).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Upload zone
// ═══════════════════════════════════════════════════════════════════════════════

test.describe('File upload', () => {
  test('upload zone triggers file input', async ({ page }) => {
    await mockApiWithFiles(page);
    await goToChat(page);
    await openSession(page);
    await page.click('.ac-topbar-files');

    // The upload zone should contain a hidden file input
    const fileInput = page.locator('.fp-upload-zone input[type="file"]');
    await expect(fileInput).toBeHidden();
  });

  test('file input upload triggers API call', async ({ page }) => {
    let uploadCalled = false;
    await mockApiWithFiles(page, {
      fileUpload: () => {
        uploadCalled = true;
        return {
          status: 201,
          body: {
            id: 'sf_uploaded',
            path: 'test.txt',
            filename: 'test.txt',
            content_type: 'text/plain',
            size: 11,
            is_text: true,
            text_content: 'hello world',
            created_by: 'user',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
        };
      },
    });
    await goToChat(page);
    await openSession(page);
    await page.click('.ac-topbar-files');

    // Set file on the hidden input
    const fileInput = page.locator('.fp-upload-zone input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello world'),
    });

    await page.waitForTimeout(1000);
    expect(uploadCalled).toBe(true);
  });
});
