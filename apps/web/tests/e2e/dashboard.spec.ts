import { test, expect } from '@playwright/test';

test.describe('Dashboard Shell & Overview E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            user: {
              id: 'u-1',
              email: 'owner@test.com',
              role: 'owner',
              orgId: 'org-test-1',
            },
            organization: {
              id: 'org-test-1',
              name: 'Enterprise Telemetry Inc',
              plan: 'enterprise',
            },
          },
        }),
      });
    });

    await page.route('**/api/auth/refresh', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: { accessToken: 'valid-test-access-token' },
        }),
      });
    });

    await page.route('**/api/monitors', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            { id: 'm-1', name: 'Auth Microservice', url: 'https://auth.internal/health', status: 'up', latestLatency: 35 },
            { id: 'm-2', name: 'Payment Processor', url: 'https://payments.internal/health', status: 'up', latestLatency: 62 },
          ],
        }),
      });
    });

    await page.route('**/api/incidents', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [],
        }),
      });
    });
  });

  test('should render dashboard navigation, stats cards, and org name', async ({ page }) => {
    await page.goto('/dashboard');

    await expect(page.locator('text=Enterprise Telemetry Inc')).toBeVisible();
    await expect(page.locator('text=System Overview')).toBeVisible();
    await expect(page.locator('text=Total Monitors')).toBeVisible();
    await expect(page.locator('text=Current Health')).toBeVisible();
    await expect(page.locator('text=Avg Response Time')).toBeVisible();
    await expect(page.locator('text=Active Incidents')).toBeVisible();

    // Verify sidebar links
    await expect(page.getByRole('link', { name: /Dashboard/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Monitors/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Incidents/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Webhooks/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Settings/i })).toBeVisible();
  });
});
