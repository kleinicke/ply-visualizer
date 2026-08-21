import { expect, test } from '@playwright/test';

test('standalone deployment serves the visualizer at its root', async ({ page }) => {
  await page.goto('/');

  await expect(page).toHaveTitle('3D Point Cloud Visualizer');
  await expect(page.locator('#viewer-container')).toBeVisible();
  await expect(page.getByRole('link', { name: 'About' })).toHaveAttribute(
    'href',
    'https://f-kleinicke.de/'
  );
  await expect(page.getByRole('link', { name: 'Impressum' })).toHaveAttribute(
    'href',
    'https://f-kleinicke.de/impressum.html'
  );
});
