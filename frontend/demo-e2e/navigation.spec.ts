import { expect, test } from '@playwright/test';

test('mobile menu opens by keyboard and provides the same navigation on job details', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL!);
  const menu = page.getByRole('button', { name: 'Menu', exact: true });
  const navigation = page.getByRole('navigation', { name: 'Main', exact: true });
  await expect(navigation).not.toBeVisible();
  await menu.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link')).toHaveCount(5);
  await navigation.getByRole('link', { name: 'Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Operational overview' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Main', exact: true })).not.toBeVisible();
  await page.goto(`${baseURL}?status=failed`);
  await page.getByText('Explore network examples', { exact: true }).click();
  await page.getByRole('link', { name: 'Open network success example', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Network execution', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  const jobs = page.getByRole('navigation', { name: 'Main', exact: true }).getByRole('link', { name: 'Jobs', exact: true });
  await jobs.click();
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('failed');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
