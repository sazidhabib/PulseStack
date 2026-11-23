import { test, expect } from '@playwright/test';

test.describe('Authentication & Session Management E2E', () => {
  test('should render the landing page with 1-click demo button', async ({ page }) => {
    await page.goto('/');

    await expect(page.locator('text=PulseStack')).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Launch 1-Click Demo/i })
    ).toBeVisible();
  });

  test('should navigate to login page and display form elements', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByRole('heading', { name: /Sign In/i })).toBeVisible();
    await expect(page.getByLabel(/Email Address/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Launch 1-Click Demo/i })
    ).toBeVisible();
  });

  test('should navigate to register page and validate input fields', async ({ page }) => {
    await page.goto('/register');

    await expect(page.getByRole('heading', { name: /Create Organization/i })).toBeVisible();
    await expect(page.getByLabel(/Your Name/i)).toBeVisible();
    await expect(page.getByLabel(/Organization/i)).toBeVisible();
    await expect(page.getByLabel(/Work Email/i)).toBeVisible();
    await expect(page.getByLabel(/Password/i)).toBeVisible();

    // Trigger validation
    await page.getByRole('button', { name: /Create Account/i }).click();
    await expect(page.locator('text=Please enter a valid email address')).toBeVisible();
  });

  test('1-CLICK DEMO LOGIN: should authenticate demo@pulsestack.io and navigate to dashboard', async ({ page }) => {
    await page.goto('/login');

    // Click 1-Click demo button
    const demoButton = page.getByRole('button', { name: /Launch 1-Click Demo/i });
    await expect(demoButton).toBeVisible();

    // Mock API response if server offline in CI unit run
    await page.route('**/api/auth/demo', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: 'demo-user-id',
              email: 'demo@pulsestack.io',
              name: 'Demo Admin',
              role: 'owner',
              orgId: 'demo-org-id',
            },
            accessToken: 'mock-demo-jwt-token',
          },
        }),
      });
    });

    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: 'demo-user-id',
              email: 'demo@pulsestack.io',
              name: 'Demo Admin',
              role: 'owner',
              orgId: 'demo-org-id',
            },
            organization: {
              id: 'demo-org-id',
              name: 'PulseStack Demo',
              slug: 'pulsestack-demo',
              plan: 'pro',
            },
          },
        }),
      });
    });

    await demoButton.click();
    await page.waitForURL('**/dashboard');
    await expect(page.locator('text=System Overview')).toBeVisible();
  });
});
