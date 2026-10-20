import { expect, type Page } from '@playwright/test';

export async function exploreExample(page: Page, basePath = '/', browserSnapshot = false) {
  await page.goto(basePath);
  await expect(page.getByRole('region', { name: 'About Quantum Job Tracker' })).toContainText('For developers and operators');
  await expect(page.getByText('Synthetic demo · jobs and results are simulated')).toBeVisible();
  await page.getByRole('link', { name: 'Start with Overview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Operational overview' })).toBeVisible();
  await expect(page.getByRole('article', { name: 'Compilation success rate' })).toBeVisible();
  await page.getByRole('link', { name: 'Explore example comparison', exact: true }).click();
  const comparisonURL = page.url();
  expect(new URL(comparisonURL).pathname).toBe(basePath);
  await expect(page.getByRole('heading', { name: 'Experiment comparison', exact: true })).toBeVisible();
  await expect(page.getByLabel('Baseline compiler version')).toHaveValue('synthetic-1.0.0');
  await expect(page.getByLabel('Candidate compiler version')).toHaveValue('synthetic-1.1.0');
  const guide = page.getByRole('region', { name: 'What to notice in the example' });
  await expect(guide).toContainText('One improvement');
  await expect(guide).toContainText('One change to investigate');
  await expect(guide).toContainText('not real compiler benchmarks');
  const gain = page.getByRole('region', { name: 'Changes to investigate: resource-gain', exact: true });
  await expect(gain).toContainText('Lower estimated circuit depth');
  await expect(gain).toContainText('-30 %');
  const failure = page.getByRole('region', { name: 'Changes to investigate: compile-regression', exact: true });
  await expect(failure).toContainText('Compilation failures observed');
  await expect(failure).toContainText('Insufficient data to compare');
  await failure.getByText('Supporting jobs for Compilation failures observed', { exact: true }).click();
  const candidate = failure.getByRole('heading', { name: 'Candidate — supporting observations (n=7)' }).locator('..');
  const link = candidate.getByRole('link').first();
  const href = new URL((await link.getAttribute('href'))!, comparisonURL);
  if (browserSnapshot) {
    expect(href.pathname).toBe(basePath);
    expect(href.searchParams.get('job')).toBeTruthy();
  }
  expect(href.searchParams.get('experiment')).toBe(new URL(comparisonURL).searchParams.get('experiment'));
  await link.click();
  await expect(page.getByRole('link', { name: '← Back to comparison', exact: true })).toBeVisible();
  await page.reload();
  await page.getByRole('link', { name: 'Jump to timeline and failure evidence ↓' }).click();
  await expect(page.getByRole('region', { name: 'Recorded failure evidence' })).toContainText('SYNTHETIC_CANDIDATE_COMPILE_FAILED');
  await expect(page.getByRole('region', { name: 'Recorded failure evidence' })).toContainText('Failure correlation ID');
  await expect(page.getByRole('region', { name: 'Timings' })).toContainText('Not available');
  await expect(page.getByRole('list', { name: 'Lifecycle timeline' }).getByRole('listitem')).toHaveCount(3);
  await page.getByRole('link', { name: '← Back to comparison', exact: true }).click();
  await expect(page).toHaveURL(comparisonURL);
  await page.reload();
  await expect(page.getByLabel('Candidate compiler version')).toHaveValue('synthetic-1.1.0');
  await expect(page.getByRole('region', { name: 'What to notice in the example' })).toBeVisible();
}
