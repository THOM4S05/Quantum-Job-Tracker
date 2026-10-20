import { expect, test } from '@playwright/test';

test('compare compiler versions including compilation failures and inspect a timeline', async ({ page }) => {
  await page.goto('/?view=comparison');
  await page.getByLabel('Experiment', { exact: true }).selectOption({ label: 'Synthetic compiler comparison v1' });
  await page.getByLabel('Baseline compiler version').selectOption('synthetic-1.0.0');
  await page.getByLabel('Candidate compiler version').selectOption('synthetic-1.1.0');
  await page.getByRole('button', { name: 'Compare versions', exact: true }).click();
  const gain = page.getByRole('region', { name: /resource-gain comparison/ });
  await expect(gain).toContainText('-25 %');
  const failures = page.getByRole('region', { name: /compile-regression comparison/ });
  await expect(failures).toContainText('-100 pp');
  await expect(failures).toContainText('7 failed / 7 completed');
  await expect(failures).toContainText('Not enough data');
  const slowdown = page.getByRole('region', { name: /execution-slowdown comparison/ });
  await expect(slowdown).toContainText('+8 s');
  await expect(slowdown).toContainText('+80 %');
  const comparisonURL = page.url();
  await page.screenshot({ path: '/tmp/quantum-comparison.png', fullPage: true });
  await failures.getByText('Candidate jobs (7)', { exact: true }).click();
  await failures.getByRole('link').last().click();
  await expect(page.getByRole('region', { name: 'Recorded failure evidence' })).toContainText('SYNTHETIC_CANDIDATE_COMPILE_FAILED');
  await expect(page.getByRole('list', { name: 'Lifecycle timeline' }).getByRole('listitem')).toHaveCount(3);
  await page.getByRole('link', { name: '← Back to comparison', exact: true }).click();
  await expect(page).toHaveURL(comparisonURL);
  await expect(page.getByLabel('Baseline compiler version')).toHaveValue('synthetic-1.0.0');
  await page.reload();
  await expect(page.getByRole('region', { name: /compile-regression comparison/ })).toContainText('-100 pp');
});
