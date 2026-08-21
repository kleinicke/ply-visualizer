import { expect, test } from '@playwright/test';

test('homepage presents all three developments and working destinations', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle(/Florian Nick/);
  await expect(page.getByRole('heading', { name: /seeing difficult data/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /3D Point Cloud/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Scientific Image/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Extension Downloads/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /Open live tracker/i })).toHaveAttribute(
    'href',
    'https://extensions.f-kleinicke.de'
  );
  await expect(page.getByRole('link', { name: /Try in browser/i })).toHaveAttribute(
    'href',
    '/3d-visualizer/'
  );
});

test('homepage remains readable on a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const bodyWidth = await page.locator('body').evaluate(body => body.scrollWidth);
  expect(bodyWidth).toBeLessThanOrEqual(390);
  await expect(page.getByRole('link', { name: /Open live tracker/i })).toBeVisible();
});
