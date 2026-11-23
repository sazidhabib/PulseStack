import { test, expect } from '@playwright/test';

test.describe('Monitor Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Authenticate session via route interception
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
              name: 'Test Corp',
              plan: 'pro',
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
  });

  test('should display monitor list and open create monitor modal', async ({ page }) => {
    await page.route('**/api/monitors', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: [
              {
                id: 'mon-e2e-1',
                name: 'Production Gateway',
                url: 'https://api.prod.com/health',
                method: 'GET',
                intervalSeconds: 60,
                status: 'up',
                isActive: true,
                latestLatency: 42,
              },
            ],
          }),
        });
      }
    });

    await page.goto('/monitors');

    await expect(page.getByRole('heading', { name: /Monitored Endpoints/i })).toBeVisible();
    await expect(page.locator('text=Production Gateway')).toBeVisible();
    await expect(page.locator('text=42 ms')).toBeVisible();

    // Click "New Monitor"
    await page.getByRole('button', { name: /New Monitor/i }).first().click();
    await expect(page.getByRole('heading', { name: /Create New Monitor/i })).toBeVisible();
    await expect(page.getByLabel(/Monitor Name/i)).toBeVisible();
    await expect(page.getByLabel(/Target URL/i)).toBeVisible();
  });
});
