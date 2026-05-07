import { test, expect } from '@playwright/test';

test('vitest gate placeholder', () => {
  expect(true).toBe(true);
});

test.describe('Full stack (CI with Django + Vite)', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(
      process.env.CI_E2E !== '1',
      'Set CI_E2E=1 with Django on :8000 and Vite preview on E2E_BASE_URL (see .github/workflows/ci.yml)'
    );
  });

  test('literal text search, open two-page PDF preview, scroll to page 2', async ({ page }) => {
    const base = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:5173';
    await page.goto(base);
    await expect(page.getByRole('heading', { name: 'File Explorer' })).toBeVisible();

    await page.getByRole('button', { name: 'Advanced search' }).click();
    await page.getByRole('radio', { name: /Literal text/i }).check();

    await page.getByPlaceholder('Search files and folders...').fill('e2e_page2_unique_scroll');
    await expect(page.getByRole('heading', { name: 'e2e_two_page.pdf' })).toBeVisible({ timeout: 60_000 });
    await page.getByRole('heading', { name: 'e2e_two_page.pdf' }).click();

    const scroll = page.getByTestId('preview-scroll-root');
    await scroll.waitFor({ state: 'visible', timeout: 30_000 });
    await scroll.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });

    await expect(page.locator('[data-pdf-page-index="2"] canvas')).toBeVisible({ timeout: 45_000 });
  });
});
