import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8001';

const mockUser = {
  id: 1,
  email: 'test@example.com',
  first_name: 'E2E',
  last_name: 'TestUser',
};

/** Mock all API routes so tests run without a backend. */
async function mockApi(
  page: Page,
  overrides: {
    confirmCode?: (body: Record<string, string>) => { status: number; body: unknown };
    signupComplete?: (body: Record<string, string>) => { status: number; body: unknown };
    userInfo?: () => { status: number; body: unknown };
  } = {},
) {
  // Session endpoint — return unauthenticated + set csrftoken cookie
  await page.route(`${API}/_allauth/browser/v1/auth/session`, (route, request) => {
    if (request.method() === 'GET') {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Set-Cookie': 'csrftoken=test-csrf-token; Path=/' },
        body: JSON.stringify({ status: 200, meta: { is_authenticated: false } }),
      });
    }
    // DELETE (logout)
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
  });

  // Request code — always succeeds
  await page.route(`${API}/api/v1/auth/code/request/`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    }),
  );

  // Confirm code
  await page.route(`${API}/api/v1/auth/code/confirm/`, async (route) => {
    const body = route.request().postDataJSON();
    if (overrides.confirmCode) {
      const res = overrides.confirmCode(body);
      return route.fulfill({
        status: res.status,
        contentType: 'application/json',
        body: JSON.stringify(res.body),
      });
    }
    // Default: new user → signup_required
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ status: 'signup_required' }),
    });
  });

  // Signup complete
  await page.route(`${API}/api/v1/auth/signup/complete/`, async (route) => {
    const body = route.request().postDataJSON();
    if (overrides.signupComplete) {
      const res = overrides.signupComplete(body);
      return route.fulfill({
        status: res.status,
        contentType: 'application/json',
        body: JSON.stringify(res.body),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...mockUser, first_name: body.first_name, last_name: body.last_name }),
    });
  });

  // User info
  await page.route(`${API}/api/v1/auth/me/`, (route) => {
    if (overrides.userInfo) {
      const res = overrides.userInfo();
      return route.fulfill({
        status: res.status,
        contentType: 'application/json',
        body: JSON.stringify(res.body),
      });
    }
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockUser),
    });
  });
}

async function goToLogin(page: Page) {
  await page.goto('/login');
  await page.waitForResponse((res) =>
    res.url().includes('/_allauth/browser/v1/auth/session'),
  );
}

async function submitEmail(page: Page, email: string) {
  await page.fill('input#email', email);
  await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/v1/auth/code/request/')),
    page.click('button[type="submit"]'),
  ]);
}

async function revealCodeInput(page: Page) {
  const codeInput = page.locator('input#code');
  if (!(await codeInput.isVisible())) {
    await page.click('text=Enter code manually');
  }
}

async function submitCode(page: Page, code: string) {
  await revealCodeInput(page);
  await page.fill('input#code', code);
  await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/v1/auth/code/confirm/')),
    page.click('button[type="submit"]'),
  ]);
}

// ---------------------------------------------------------------------------
// Auth flow tests
// ---------------------------------------------------------------------------

test.describe('Auth flow', () => {
  test('new user signup: email → code → name → chat', async ({ page }) => {
    await mockApi(page);
    await goToLogin(page);

    // Step 1: Enter email
    await submitEmail(page, 'new@example.com');
    await expect(page.locator('.login-subtitle')).toHaveText('Check your email');

    // Step 2: Enter code → signup_required (default mock)
    await submitCode(page, 'ABC123');
    await expect(page.locator('.login-subtitle')).toHaveText('Create your account');

    // Step 3: Complete signup
    await page.fill('input#firstName', 'E2E');
    await page.fill('input#lastName', 'TestUser');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/v1/auth/signup/complete/')),
      page.click('button[type="submit"]'),
    ]);

    await page.waitForURL('**/chat', { timeout: 5000 });
    await expect(page.locator('.user-name')).toHaveText('E2E TestUser');
  });

  test('existing user login: email → code → chat', async ({ page }) => {
    await mockApi(page, {
      confirmCode: () => ({
        status: 200,
        body: { status: 'authenticated', user: mockUser },
      }),
    });
    await goToLogin(page);

    await submitEmail(page, 'existing@example.com');
    await expect(page.locator('.login-subtitle')).toHaveText('Check your email');

    await submitCode(page, 'ABC123');

    // Should go directly to /chat (no signup step)
    await page.waitForURL('**/chat', { timeout: 5000 });
    await expect(page.locator('.user-name')).toHaveText('E2E TestUser');
  });

  test('wrong code shows error', async ({ page }) => {
    await mockApi(page, {
      confirmCode: () => ({
        status: 400,
        body: { error: 'invalid_code' },
      }),
    });
    await goToLogin(page);

    await submitEmail(page, 'test@example.com');
    await expect(page.locator('.login-subtitle')).toHaveText('Check your email');

    await submitCode(page, 'WRONG1');

    await expect(page.locator('.login-error')).toBeVisible();
    await expect(page.locator('.login-error')).toContainText('Invalid code');
    // Should stay on code step
    await expect(page.locator('.login-subtitle')).toHaveText('Check your email');
  });

  test('expired code shows error', async ({ page }) => {
    await mockApi(page, {
      confirmCode: () => ({
        status: 400,
        body: { error: 'code_expired' },
      }),
    });
    await goToLogin(page);

    await submitEmail(page, 'test@example.com');
    await submitCode(page, 'OLD123');

    await expect(page.locator('.login-error')).toContainText('Code expired');
  });

  test('too many attempts shows error', async ({ page }) => {
    await mockApi(page, {
      confirmCode: () => ({
        status: 400,
        body: { error: 'too_many_attempts' },
      }),
    });
    await goToLogin(page);

    await submitEmail(page, 'test@example.com');
    await submitCode(page, 'GUESS1');

    await expect(page.locator('.login-error')).toContainText('Too many failed attempts');
  });

  test('code input hidden by default, revealed by toggle', async ({ page }) => {
    await mockApi(page);
    await goToLogin(page);

    await submitEmail(page, 'test@example.com');
    await expect(page.locator('.login-subtitle')).toHaveText('Check your email');

    // Code input should be hidden
    await expect(page.locator('input#code')).not.toBeVisible();

    // Click toggle to reveal
    await page.click('text=Enter code manually');
    await expect(page.locator('input#code')).toBeVisible();
  });

  test('back to email from code step', async ({ page }) => {
    await mockApi(page);
    await goToLogin(page);

    await submitEmail(page, 'test@example.com');
    await expect(page.locator('.login-subtitle')).toHaveText('Check your email');

    await page.click('text=Use a different email');

    await expect(page.locator('.login-subtitle')).toHaveText('Sign in to your account');
    await expect(page.locator('input#email')).toBeVisible();
  });

  test('back to email from signup step', async ({ page }) => {
    await mockApi(page);
    await goToLogin(page);

    await submitEmail(page, 'test@example.com');
    await submitCode(page, 'ABC123');
    await expect(page.locator('.login-subtitle')).toHaveText('Create your account');

    await page.click('.login-link');

    await expect(page.locator('.login-subtitle')).toHaveText('Sign in to your account');
    await expect(page.locator('input#email')).toBeVisible();
  });

  test('email taken during signup shows error', async ({ page }) => {
    await mockApi(page, {
      signupComplete: () => ({
        status: 409,
        body: { error: 'email_taken' },
      }),
    });
    await goToLogin(page);

    await submitEmail(page, 'taken@example.com');
    await submitCode(page, 'ABC123');
    await expect(page.locator('.login-subtitle')).toHaveText('Create your account');

    await page.fill('input#firstName', 'Dup');
    await page.fill('input#lastName', 'User');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/v1/auth/signup/complete/')),
      page.click('button[type="submit"]'),
    ]);

    await expect(page.locator('.login-error')).toContainText('already exists');
  });
});

// ---------------------------------------------------------------------------
// Magic link / login callback tests
// ---------------------------------------------------------------------------

test.describe('Magic link callback', () => {
  test('successful login redirects to /chat', async ({ page }) => {
    // Mock session as authenticated after magic link
    await page.route(`${API}/_allauth/browser/v1/auth/session`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Set-Cookie': 'csrftoken=test-csrf-token; Path=/' },
        body: JSON.stringify({ status: 200, meta: { is_authenticated: true } }),
      }),
    );
    await page.route(`${API}/api/v1/auth/me/`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockUser),
      }),
    );

    await page.goto('/login/callback?status=ok');

    await page.waitForURL('**/chat', { timeout: 5000 });
    await expect(page.locator('.user-name')).toHaveText('E2E TestUser');
  });

  test('signup_required redirects to /login', async ({ page }) => {
    await page.route(`${API}/_allauth/browser/v1/auth/session`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Set-Cookie': 'csrftoken=test-csrf-token; Path=/' },
        body: JSON.stringify({ status: 200, meta: { is_authenticated: false } }),
      }),
    );

    await page.goto('/login/callback?status=signup_required');

    await page.waitForURL('**/login', { timeout: 5000 });
    await expect(page.locator('.login-subtitle')).toHaveText('Sign in to your account');
  });

  test('error with expired reason shows message', async ({ page }) => {
    await page.route(`${API}/_allauth/browser/v1/auth/session`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Set-Cookie': 'csrftoken=test-csrf-token; Path=/' },
        body: JSON.stringify({ status: 200, meta: { is_authenticated: false } }),
      }),
    );

    await page.goto('/login/callback?status=error&reason=expired');

    await expect(page.locator('.login-error')).toContainText('expired');
    await expect(page.locator('.login-subtitle')).toHaveText('Sign-in failed');
  });

  test('error with invalid_code reason shows message', async ({ page }) => {
    await page.route(`${API}/_allauth/browser/v1/auth/session`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Set-Cookie': 'csrftoken=test-csrf-token; Path=/' },
        body: JSON.stringify({ status: 200, meta: { is_authenticated: false } }),
      }),
    );

    await page.goto('/login/callback?status=error&reason=invalid_code');

    await expect(page.locator('.login-error')).toContainText('Invalid sign-in code');
  });

  test('try again button navigates to /login', async ({ page }) => {
    await page.route(`${API}/_allauth/browser/v1/auth/session`, (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: { 'Set-Cookie': 'csrftoken=test-csrf-token; Path=/' },
        body: JSON.stringify({ status: 200, meta: { is_authenticated: false } }),
      }),
    );

    await page.goto('/login/callback?status=error&reason=no_pending_login');

    await expect(page.locator('.login-error')).toBeVisible();
    await page.click('.login-button');

    await page.waitForURL('**/login', { timeout: 5000 });
    await expect(page.locator('.login-subtitle')).toHaveText('Sign in to your account');
  });
});
