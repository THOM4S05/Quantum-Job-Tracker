import { expect, test } from '@playwright/test';
import type { JobEvidence } from '../src/JobDetails';

test('filter failed jobs, open recorded failure evidence, and return to the filtered list', async ({ page, request }) => {
  const ready = await request.get('/api/health/ready');
  expect(ready.ok(), 'Start the Compose stack and seed PostgreSQL before running this test').toBeTruthy();

  await page.goto('/');
  await page.getByRole('table').waitFor();
  await page.getByLabel('Status').selectOption('failed');
  await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
  await expect(page).toHaveURL(/\?status=failed$/);
  const filteredURL = page.url();
  const firstJob = page.getByRole('table').getByRole('link').first();
  await expect(firstJob).toBeVisible();
  const href = await firstJob.getAttribute('href');
  expect(href).toBeTruthy();
  const path = new URL(href!, page.url()).pathname;
  const response = await request.get(`/api${path}`);
  expect(response.ok()).toBeTruthy();
  const evidence = await response.json() as JobEvidence;
  expect(evidence.job.status).toBe('failed');
  const failure = evidence.events.filter((event) => event.to_status === 'failed' && event.from_status !== 'failed').at(-1)!;
  expect(failure, 'The seeded failed job should have a recorded failure event').toBeTruthy();

  await firstJob.click();
  await expect(page.getByRole('heading', { name: evidence.job.name, exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Program and compiler' })).toContainText(evidence.job.metadata!.compiler_name!);
  await expect(page.getByRole('region', { name: 'Estimated resources' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Timings' })).toBeVisible();
  const panel = page.getByRole('region', { name: 'Recorded failure evidence' });
  await expect(panel).toContainText(evidence.job.error_code!);
  await expect(panel).toContainText(evidence.job.error_message!);
  await expect(panel).toContainText(failure.correlation_id!);
  const stage = evidence.job.error_stage!.replace(/^./, (letter) => letter.toUpperCase());
  await expect(panel).toContainText(stage);

  const timeline = page.getByRole('list', { name: 'Lifecycle timeline' });
  const rows = timeline.getByRole('listitem');
  await expect(rows).toHaveCount(evidence.events.length);
  expect(await rows.evaluateAll((items) => items.map((item) => item.getAttribute('data-sequence'))))
    .toEqual(evidence.events.map((event) => String(event.sequence)));
  for (let index = 0; index < evidence.events.length; index++) {
    await expect(rows.nth(index)).toContainText(evidence.events[index].message!);
  }
  await page.getByText(`Structured diagnostics for event ${failure.sequence}`, { exact: true }).click();
  await expect(rows.last().locator('pre')).toHaveText(JSON.stringify(failure.details, null, 2));
  await page.reload();
  await expect(panel).toContainText(evidence.job.error_code!);
  await page.getByRole('link', { name: '← Back to filtered jobs', exact: true }).click();
  await expect(page).toHaveURL(filteredURL);
  await expect(page.getByLabel('Status')).toHaveValue('failed');
  await expect(page.getByRole('table')).toBeVisible();
});
