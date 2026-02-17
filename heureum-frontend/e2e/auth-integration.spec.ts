import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:8001';

/** Generate a unique email for each test to avoid collisions. */
function uniqueEmail() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@test.local`;
}

/** Fetch the latest login code from the debug endpoint. */
async function getLatestCode(page: Page, email: string) {
  const res = await page.request.get(
    `${API}/api/v1/auth/test/latest-code/?email=${encodeURIComponent(email)}`,
  );
  expect(res.ok()).toBeTruthy();
  const data = await res.json();
  return data as { code: string; key: string };
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

async function revealAndSubmitCode(page: Page, code: string) {
  const codeInput = page.locator('input#code');
  if (!(await codeInput.isVisible())) {
    await page.click('text=Enter code manually');
  }
  await page.fill('input#code', code);
  await Promise.all([
    page.waitForResponse((res) => res.url().includes('/api/v1/auth/code/confirm/')),
    page.click('button[type="submit"]'),
  ]);
}

// ---------------------------------------------------------------------------
// Integration tests — hit the real Django backend
// ---------------------------------------------------------------------------

test.describe('Auth integration', () => {
  test('new user signup: email → code → name → chat', async ({ page }) => {
    const email = uniqueEmail();
    await goToLogin(page);

    // Step 1: request code
    await submitEmail(page, email);
    await expect(page.locator('.login-subtitle')).toHaveText('Check your email');

    // Step 2: get code from debug endpoint and submit
    const { code } = await getLatestCode(page, email);
    await revealAndSubmitCode(page, code);
    await expect(page.locator('.login-subtitle')).toHaveText('Create your account');

    // Step 3: complete signup
    await page.fill('input#firstName', 'E2E');
    await page.fill('input#lastName', 'Integration');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/v1/auth/signup/complete/')),
      page.click('button[type="submit"]'),
    ]);

    await page.waitForURL('**/chat', { timeout: 5000 });
    await expect(page.locator('.user-name')).toHaveText('E2E Integration');
  });

  test('existing user login: email → code → chat', async ({ page }) => {
    const email = uniqueEmail();

    // Pre-create user via the signup flow (API-level)
    await goToLogin(page);
    await submitEmail(page, email);
    const { code: signupCode } = await getLatestCode(page, email);
    await revealAndSubmitCode(page, signupCode);
    await page.fill('input#firstName', 'Existing');
    await page.fill('input#lastName', 'User');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/v1/auth/signup/complete/')),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForURL('**/chat', { timeout: 5000 });

    // Log out
    await page.click('.logout-button');
    await page.waitForURL('**/', { timeout: 5000 });

    // Now log in as the existing user
    await goToLogin(page);
    await submitEmail(page, email);
    await expect(page.locator('.login-subtitle')).toHaveText('Check your email');

    const { code } = await getLatestCode(page, email);
    await revealAndSubmitCode(page, code);

    // Should go directly to /chat (no signup step)
    await page.waitForURL('**/chat', { timeout: 5000 });
    await expect(page.locator('.user-name')).toHaveText('Existing User');
  });

  test('wrong code shows error', async ({ page }) => {
    const email = uniqueEmail();
    await goToLogin(page);

    await submitEmail(page, email);
    await expect(page.locator('.login-subtitle')).toHaveText('Check your email');

    // Submit a wrong code
    await revealAndSubmitCode(page, 'WRONG1');

    await expect(page.locator('.login-error')).toBeVisible();
    await expect(page.locator('.login-error')).toContainText('Invalid code');
    // Should stay on the code step
    await expect(page.locator('.login-subtitle')).toHaveText('Check your email');
  });

  test('user info returns authenticated user data', async ({ page }) => {
    const email = uniqueEmail();
    await goToLogin(page);

    // Sign up
    await submitEmail(page, email);
    const { code } = await getLatestCode(page, email);
    await revealAndSubmitCode(page, code);
    await page.fill('input#firstName', 'Info');
    await page.fill('input#lastName', 'Test');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/v1/auth/signup/complete/')),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForURL('**/chat', { timeout: 5000 });

    // Call /me endpoint from the browser context (shares session cookies)
    const meRes = await page.request.get(`${API}/api/v1/auth/me/`);
    expect(meRes.ok()).toBeTruthy();
    const user = await meRes.json();
    expect(user.email).toBe(email);
    expect(user.first_name).toBe('Info');
    expect(user.last_name).toBe('Test');
  });

  test('magic link login flow', async ({ page }) => {
    const email = uniqueEmail();
    await goToLogin(page);

    // Sign up first to create the user
    await submitEmail(page, email);
    const { code: signupCode } = await getLatestCode(page, email);
    await revealAndSubmitCode(page, signupCode);
    await page.fill('input#firstName', 'Magic');
    await page.fill('input#lastName', 'Link');
    await Promise.all([
      page.waitForResponse((res) => res.url().includes('/api/v1/auth/signup/complete/')),
      page.click('button[type="submit"]'),
    ]);
    await page.waitForURL('**/chat', { timeout: 5000 });

    // Log out
    await page.click('.logout-button');
    await page.waitForURL('**/', { timeout: 5000 });

    // Request a new code, then use the magic link key for token exchange
    await goToLogin(page);
    await submitEmail(page, email);
    const { key } = await getLatestCode(page, email);

    // Simulate magic link click: hit the confirm endpoint with the key
    // This triggers verify → token exchange → session login → redirect
    await page.goto(`${API}/api/v1/auth/login/confirm/?key=${key}`);

    // Should end up at /login/callback?status=ok → redirected to /chat
    await page.waitForURL('**/chat', { timeout: 10000 });
    await expect(page.locator('.user-name')).toHaveText('Magic Link');
  });
});
