import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8001';

const mockUser = {
  id: 1,
  email: 'test@example.com',
  first_name: 'E2E',
  last_name: 'TestUser',
};

const mockTasks = [
  {
    id: 'pt_abc123',
    session_id: 'sess-aaaa-1111',
    title: 'Daily NASDAQ Report',
    description: 'Fetch NASDAQ data and save as markdown',
    recipe: { version: 1, objective: 'Fetch NASDAQ report' },
    schedule: { type: 'cron', cron: { minute: 0, hour: 9 } },
    timezone_name: 'Asia/Seoul',
    status: 'active',
    max_retries: 3,
    consecutive_failures: 0,
    next_run_at: new Date(Date.now() + 3600000).toISOString(),
    last_run_at: new Date(Date.now() - 86400000).toISOString(),
    total_runs: 5,
    total_successes: 4,
    total_failures: 1,
    created_at: new Date(Date.now() - 604800000).toISOString(),
    updated_at: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'pt_def456',
    session_id: 'sess-bbbb-2222',
    title: 'Weekly Summary',
    description: 'Generate weekly summary report',
    recipe: { version: 1, objective: 'Weekly summary' },
    schedule: { type: 'cron', cron: { minute: 0, hour: 10, day_of_week: '1' } },
    timezone_name: 'Asia/Seoul',
    status: 'paused',
    max_retries: 3,
    consecutive_failures: 0,
    next_run_at: null,
    last_run_at: null,
    total_runs: 0,
    total_successes: 0,
    total_failures: 0,
    created_at: new Date(Date.now() - 172800000).toISOString(),
    updated_at: new Date(Date.now() - 172800000).toISOString(),
  },
  {
    id: 'pt_ghi789',
    session_id: 'sess-cccc-3333',
    title: 'Failed Data Fetch',
    description: 'This task has failed',
    recipe: { version: 1, objective: 'Broken task' },
    schedule: { type: 'cron', cron: { minute: 30, hour: 8 } },
    timezone_name: 'UTC',
    status: 'failed',
    max_retries: 3,
    consecutive_failures: 3,
    next_run_at: null,
    last_run_at: new Date(Date.now() - 7200000).toISOString(),
    total_runs: 3,
    total_successes: 0,
    total_failures: 3,
    created_at: new Date(Date.now() - 259200000).toISOString(),
    updated_at: new Date(Date.now() - 7200000).toISOString(),
  },
];

const mockRuns = [
  {
    id: 'ptr_run1',
    task_id: 'pt_abc123',
    status: 'completed',
    attempt: 1,
    output_summary: 'NASDAQ report for 2026-02-14 saved successfully.',
    error_message: '',
    files_created: ['2026-02-14-nasdaq-report.md'],
    input_tokens: 1000,
    output_tokens: 500,
    total_tokens: 1500,
    total_cost: '0.012000',
    iterations: 3,
    tool_calls_count: 2,
    started_at: new Date(Date.now() - 86400000).toISOString(),
    completed_at: new Date(Date.now() - 86400000 + 30000).toISOString(),
  },
  {
    id: 'ptr_run2',
    task_id: 'pt_abc123',
    status: 'failed',
    attempt: 1,
    output_summary: '',
    error_message: 'Timeout fetching Yahoo Finance',
    files_created: [],
    input_tokens: 800,
    output_tokens: 100,
    total_tokens: 900,
    total_cost: '0.006000',
    iterations: 1,
    tool_calls_count: 1,
    started_at: new Date(Date.now() - 172800000).toISOString(),
    completed_at: new Date(Date.now() - 172800000 + 10000).toISOString(),
  },
];

/** Mock all API routes for the tasks page. */
async function mockTasksApi(
  page: Page,
  overrides: {
    tasks?: () => { status: number; body: unknown };
    taskRuns?: (taskId: string) => { status: number; body: unknown };
    pause?: (taskId: string) => { status: number; body: unknown };
    resume?: (taskId: string) => { status: number; body: unknown };
    deleteTask?: (taskId: string) => { status: number; body: unknown };
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

  // Periodic tasks list
  await page.route(`${API}/api/v1/periodic-tasks/`, (route, request) => {
    if (request.method() !== 'GET') return route.continue();
    if (overrides.tasks) {
      const res = overrides.tasks();
      return route.fulfill({
        status: res.status,
        contentType: 'application/json',
        body: JSON.stringify(res.body),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTasks),
    });
  });

  // Task runs
  await page.route(`${API}/api/v1/periodic-tasks/*/runs/`, (route) => {
    const url = route.request().url();
    const match = url.match(/periodic-tasks\/([^/]+)\/runs\//);
    const taskId = match ? match[1] : '';
    if (overrides.taskRuns) {
      const res = overrides.taskRuns(taskId);
      return route.fulfill({
        status: res.status,
        contentType: 'application/json',
        body: JSON.stringify(res.body),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(taskId === 'pt_abc123' ? mockRuns : []),
    });
  });

  // Pause
  await page.route(`${API}/api/v1/periodic-tasks/*/pause/`, (route) => {
    const url = route.request().url();
    const match = url.match(/periodic-tasks\/([^/]+)\/pause\//);
    const taskId = match ? match[1] : '';
    if (overrides.pause) {
      const res = overrides.pause(taskId);
      return route.fulfill({
        status: res.status,
        contentType: 'application/json',
        body: JSON.stringify(res.body),
      });
    }
    const task = mockTasks.find((t) => t.id === taskId);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...task, status: 'paused' }),
    });
  });

  // Resume
  await page.route(`${API}/api/v1/periodic-tasks/*/resume/`, (route) => {
    const url = route.request().url();
    const match = url.match(/periodic-tasks\/([^/]+)\/resume\//);
    const taskId = match ? match[1] : '';
    if (overrides.resume) {
      const res = overrides.resume(taskId);
      return route.fulfill({
        status: res.status,
        contentType: 'application/json',
        body: JSON.stringify(res.body),
      });
    }
    const task = mockTasks.find((t) => t.id === taskId);
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        ...task,
        status: 'active',
        consecutive_failures: 0,
        next_run_at: new Date(Date.now() + 3600000).toISOString(),
      }),
    });
  });

  // Delete
  await page.route(`${API}/api/v1/periodic-tasks/*/`, (route, request) => {
    if (request.method() !== 'DELETE') return route.continue();
    const url = route.request().url();
    const match = url.match(/periodic-tasks\/([^/]+)\//);
    const taskId = match ? match[1] : '';
    if (overrides.deleteTask) {
      const res = overrides.deleteTask(taskId);
      return route.fulfill({ status: res.status, body: '' });
    }
    return route.fulfill({ status: 204, body: '' });
  });
}

async function goToTasks(page: Page) {
  await page.goto('/tasks');
  await page.waitForResponse((res) => res.url().includes('/_allauth/browser/v1/auth/session'));
  await page.waitForResponse((res) => res.url().includes('/api/v1/auth/me/'));
}

// ---------------------------------------------------------------------------
// Tasks Page Layout
// ---------------------------------------------------------------------------

test.describe('Tasks page layout', () => {
  test('displays page title and task count', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    await expect(page.locator('.pt-list-title')).toHaveText('Scheduled Tasks');
    await expect(page.locator('.pt-list-count')).toHaveText('3');
  });

  test('displays all tasks in the list', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    const items = page.locator('.pt-list-item');
    await expect(items).toHaveCount(3);

    await expect(items.nth(0).locator('.pt-list-item-title')).toHaveText('Daily NASDAQ Report');
    await expect(items.nth(1).locator('.pt-list-item-title')).toHaveText('Weekly Summary');
    await expect(items.nth(2).locator('.pt-list-item-title')).toHaveText('Failed Data Fetch');
  });

  test('displays status badges for each task', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    const items = page.locator('.pt-list-item');
    await expect(items.nth(0).locator('.pt-badge')).toHaveText('Active');
    await expect(items.nth(1).locator('.pt-badge')).toHaveText('Paused');
    await expect(items.nth(2).locator('.pt-badge')).toHaveText('Failed');
  });

  test('displays empty state when no tasks', async ({ page }) => {
    await mockTasksApi(page, {
      tasks: () => ({ status: 200, body: [] }),
    });
    await goToTasks(page);

    await expect(page.locator('.pt-empty')).toContainText('No scheduled tasks yet');
  });

  test('displays detail placeholder when no task selected', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    await expect(page.locator('.pt-detail-empty')).toHaveText('Select a task to see details');
  });

  test('has back button that navigates to chat', async ({ page }) => {
    await mockTasksApi(page);
    // Also mock chat page routes so navigation works
    await page.route(`${API}/api/v1/sessions/`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      }),
    );
    await goToTasks(page);

    await page.click('.pt-back');
    await page.waitForURL('**/chat');
  });
});

// ---------------------------------------------------------------------------
// Task Detail View
// ---------------------------------------------------------------------------

test.describe('Task detail view', () => {
  test('clicking a task shows its details', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    await page.locator('.pt-list-item').first().click();

    await expect(page.locator('.pt-detail-title')).toHaveText('Daily NASDAQ Report');
    await expect(page.locator('.pt-detail-desc')).toHaveText(
      'Fetch NASDAQ data and save as markdown',
    );
  });

  test('detail view shows schedule information', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    await page.locator('.pt-list-item').first().click();

    // Check info rows exist
    const infoRows = page.locator('.pt-info-row');
    await expect(infoRows.filter({ hasText: 'Schedule' })).toBeVisible();
    await expect(infoRows.filter({ hasText: 'Timezone' })).toContainText('Asia/Seoul');
  });

  test('detail view shows run statistics', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    await page.locator('.pt-list-item').first().click();

    const infoRows = page.locator('.pt-info-row');
    await expect(infoRows.filter({ hasText: 'Total Runs' })).toContainText('5');
    await expect(infoRows.filter({ hasText: 'Total Runs' })).toContainText('4 ok');
    await expect(infoRows.filter({ hasText: 'Total Runs' })).toContainText('1 failed');
  });

  test('selected task gets active class', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    const firstItem = page.locator('.pt-list-item').first();
    await firstItem.click();

    await expect(firstItem).toHaveClass(/pt-list-item-active/);
  });
});

// ---------------------------------------------------------------------------
// Pause / Resume Actions
// ---------------------------------------------------------------------------

test.describe('Task actions', () => {
  test('active task shows pause button', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    // Select active task
    await page.locator('.pt-list-item').first().click();

    await expect(page.locator('.pt-action-pause')).toBeVisible();
    await expect(page.locator('.pt-action-pause')).toHaveText('Pause');
  });

  test('paused task shows resume button', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    // Select paused task (2nd item)
    await page.locator('.pt-list-item').nth(1).click();

    await expect(page.locator('.pt-action-resume')).toBeVisible();
    await expect(page.locator('.pt-action-resume')).toHaveText('Resume');
  });

  test('failed task shows resume button', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    // Select failed task (3rd item)
    await page.locator('.pt-list-item').nth(2).click();

    await expect(page.locator('.pt-action-resume')).toBeVisible();
  });

  test('pause button calls API and updates status', async ({ page }) => {
    let pauseCalled = false;
    await mockTasksApi(page, {
      pause: (taskId) => {
        pauseCalled = true;
        const task = mockTasks.find((t) => t.id === taskId);
        return { status: 200, body: { ...task, status: 'paused' } };
      },
    });
    await goToTasks(page);

    await page.locator('.pt-list-item').first().click();
    await page.click('.pt-action-pause');

    // Wait for the API response
    await page.waitForTimeout(500);
    expect(pauseCalled).toBe(true);

    // Status should update to paused
    await expect(page.locator('.pt-detail-header .pt-badge')).toHaveText('Paused');
  });

  test('resume button calls API and updates status', async ({ page }) => {
    let resumeCalled = false;
    await mockTasksApi(page, {
      resume: (taskId) => {
        resumeCalled = true;
        const task = mockTasks.find((t) => t.id === taskId);
        return {
          status: 200,
          body: {
            ...task,
            status: 'active',
            consecutive_failures: 0,
            next_run_at: new Date(Date.now() + 3600000).toISOString(),
          },
        };
      },
    });
    await goToTasks(page);

    // Select paused task
    await page.locator('.pt-list-item').nth(1).click();
    await page.click('.pt-action-resume');

    await page.waitForTimeout(500);
    expect(resumeCalled).toBe(true);

    await expect(page.locator('.pt-detail-header .pt-badge')).toHaveText('Active');
  });

  test('delete button shows confirmation and removes task', async ({ page }) => {
    let deleteCalled = false;

    // Handle the confirm dialog
    page.on('dialog', (dialog) => dialog.accept());

    await mockTasksApi(page, {
      deleteTask: () => {
        deleteCalled = true;
        return { status: 204, body: '' };
      },
    });
    await goToTasks(page);

    await page.locator('.pt-list-item').first().click();
    await page.click('.pt-action-delete');

    await page.waitForTimeout(500);
    expect(deleteCalled).toBe(true);

    // Task should be removed from list
    await expect(page.locator('.pt-list-item')).toHaveCount(2);
  });

  test('delete button respects cancel on confirm', async ({ page }) => {
    // Dismiss the confirm dialog
    page.on('dialog', (dialog) => dialog.dismiss());

    await mockTasksApi(page);
    await goToTasks(page);

    await page.locator('.pt-list-item').first().click();
    await page.click('.pt-action-delete');

    // Task should still be in the list
    await expect(page.locator('.pt-list-item')).toHaveCount(3);
  });

  test('all tasks show delete button', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    // Select each task and verify delete button exists
    for (let i = 0; i < 3; i++) {
      await page.locator('.pt-list-item').nth(i).click();
      await expect(page.locator('.pt-action-delete')).toBeVisible();
    }
  });
});

// ---------------------------------------------------------------------------
// Execution History
// ---------------------------------------------------------------------------

test.describe('Execution history', () => {
  test('shows execution history for selected task', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    // Select the first task (has runs)
    await page.locator('.pt-list-item').first().click();

    await expect(page.locator('.pt-runs-title')).toHaveText('Execution History');
    await expect(page.locator('.pt-run-item')).toHaveCount(2);
  });

  test('shows run status badges', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    await page.locator('.pt-list-item').first().click();

    const runs = page.locator('.pt-run-item');
    await expect(runs.nth(0).locator('.pt-run-badge')).toHaveText('Completed');
    await expect(runs.nth(1).locator('.pt-run-badge')).toHaveText('Failed');
  });

  test('shows run output summary', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    await page.locator('.pt-list-item').first().click();

    await expect(page.locator('.pt-run-summary').first()).toContainText(
      'NASDAQ report for 2026-02-14',
    );
  });

  test('shows run error message', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    await page.locator('.pt-list-item').first().click();

    await expect(page.locator('.pt-run-error').first()).toContainText(
      'Timeout fetching Yahoo Finance',
    );
  });

  test('shows run metadata (tokens, iterations, duration)', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    await page.locator('.pt-list-item').first().click();

    const firstRunMeta = page.locator('.pt-run-item').first().locator('.pt-run-meta');
    await expect(firstRunMeta).toContainText('1,500 tokens');
    await expect(firstRunMeta).toContainText('3 iterations');
  });

  test('shows empty state for task with no runs', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    // Select paused task (no runs)
    await page.locator('.pt-list-item').nth(1).click();

    await expect(page.locator('.pt-runs-empty')).toHaveText('No runs yet');
  });
});

// ---------------------------------------------------------------------------
// Schedule Display
// ---------------------------------------------------------------------------

test.describe('Schedule formatting', () => {
  test('displays cron schedule as readable time', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    // First task: daily at 09:00
    const firstMeta = page.locator('.pt-list-item').first().locator('.pt-list-item-meta');
    await expect(firstMeta).toContainText('Every day at 09:00');
  });

  test('shows next run time for active tasks', async ({ page }) => {
    await mockTasksApi(page);
    await goToTasks(page);

    const firstMeta = page.locator('.pt-list-item').first().locator('.pt-list-item-meta');
    await expect(firstMeta).toContainText('Next:');
  });
});

// ---------------------------------------------------------------------------
// Route Protection
// ---------------------------------------------------------------------------

test.describe('Route protection', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.route(`${API}/_allauth/browser/v1/auth/session`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Set-Cookie': 'csrftoken=test-csrf-token; Path=/' },
        body: JSON.stringify({ status: 200, meta: { is_authenticated: false } }),
      }),
    );

    await page.goto('/tasks');
    await page.waitForURL('**/login');
  });
});
