import { expect, type Page } from '@playwright/test';

export async function followGuide(page: Page, basePath = '/', browserSnapshot = false) {
  await page.goto(basePath);
  await page.getByRole('complementary', { name: 'Workspace navigation' }).getByRole('link', { name: 'Demo & Guide', exact: true }).click();
  expect(new URL(page.url()).pathname).toBe(basePath);
  await expect(page.getByRole('heading', { level: 1, name: 'Demo & Guide', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('link', { name: 'Explore example comparison', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'A small glossary' })).toBeVisible();
  await expect(page.getByText('Independent portfolio project · synthetic jobs and results')).toBeVisible();
  const guideURL = page.url();
  const supporting = page.getByRole('link', { name: 'Open supporting compilation-failure job', exact: true });
  await expect(supporting).toBeVisible();
  const href = new URL((await supporting.getAttribute('href'))!, guideURL);
  if (browserSnapshot) expect(href.pathname).toBe(basePath);
  expect(href.searchParams.get('view')).toBe('comparison');
  await page.getByRole('link', { name: 'Explore example comparison', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Experiment comparison', exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(basePath);
  const comparisonURL = page.url();
  await expect(page.getByRole('region', { name: 'Changes to investigate: compile-regression', exact: true })).toContainText('Compilation failures observed');
  await page.goto(guideURL);
  await page.getByRole('link', { name: 'Open supporting compilation-failure job', exact: true }).click();
  await page.reload();
  await expect(page.getByRole('region', { name: 'Recorded failure evidence' })).toContainText('SYNTHETIC_CANDIDATE_COMPILE_FAILED');
  await expect(page.getByRole('list', { name: 'Lifecycle timeline' }).getByRole('listitem')).toHaveCount(3);
  await page.getByRole('link', { name: '← Back to comparison', exact: true }).click();
  await expect(page).toHaveURL(comparisonURL);
  await page.getByRole('complementary', { name: 'Workspace navigation' }).getByRole('link', { name: 'Demo & Guide', exact: true }).click();
  await expect(page).toHaveURL(guideURL);
}
