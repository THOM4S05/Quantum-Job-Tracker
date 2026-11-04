import { expect, test } from '@playwright/test';

test('overview leads to failures, job evidence and a reloadable unfiltered list', async ({ page, baseURL }) => {
  await page.goto(baseURL!);
  await expect(page.getByRole('heading', { name: 'Operational overview' })).toBeVisible();
  await expect(page.getByRole('form', { name: 'Overview filters' })).not.toBeVisible();
  await page.getByRole('region', { name: 'Failures to review' }).getByRole('link', { name: /Compilation failures/ }).click();
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('failed');
  await expect(page.getByRole('combobox', { name: 'Failure stage', exact: true })).toHaveValue('compilation');
  const filteredURL = page.url();
  await page.getByRole('table').getByRole('link').first().click();
  await expect(page.getByRole('region', { name: 'Job outcome' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recorded failure evidence' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Program and compiler' })).not.toBeVisible();
  await page.getByText('Program, compiler and submission details', { exact: true }).click();
  await expect(page.getByRole('region', { name: 'Program and compiler' })).toBeVisible();
  await page.getByRole('link', { name: '← Back to filtered jobs' }).click();
  await expect(page).toHaveURL(filteredURL);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Jobs', exact: true })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('');
  await page.getByRole('button', { name: 'Running', exact: true }).click();
  await expect(page.getByRole('combobox', { name: 'Status', exact: true })).toHaveValue('running');
});
