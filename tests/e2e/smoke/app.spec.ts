import { test, expect } from '@playwright/test';

test.describe('Dyad Smoke Suite', () => {
  test('should load the landing page', async ({ page }) => {
    await page.goto('/');

    // Check title
    // Allowing "CCS Dashboard" temporarily
    await expect(page).toHaveTitle(/Dyad|Card Games|CCS Dashboard/i);

    // Verify H1 presence
    const heading = page.getByRole('heading', { level: 1 }).first();
    await expect(heading).toBeVisible();
  });

  test('should navigate to game detail page', async ({ page }) => {
    // Attempt direct navigation to a known route
    await page.goto('/en/games/tien-len');

    // Verify game title
    await expect(page.getByRole('heading', { name: /Tiến Lên|Tien Len/i })).toBeVisible();

    // Verify tabs exist
    await expect(page.getByRole('tab', { name: /Rules|Luật/i })).toBeVisible();
  });
});
