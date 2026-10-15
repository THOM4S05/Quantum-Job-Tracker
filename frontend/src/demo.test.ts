import { beforeEach, expect, it } from 'vitest';
import { addDemoJob, demoRequest, makeDemoJob, resetDemo, scenarios } from './demo';
import type { JobPage } from './App';

beforeEach(resetDemo);
const list = async (query = ''): Promise<JobPage> => (await demoRequest(`/api/jobs?${query}`)).json();

it('offers 200 jobs with filtered, stable pagination and case-insensitive references', async () => {
  const page = await list();
  expect(page.total).toBe(200);
  expect(page.items).toHaveLength(25);
  const failed = await list('status=failed&page_size=10&page=2');
  expect(failed.total).toBe(60);
  expect(failed.items).toHaveLength(10);
  expect(failed.items.every((job) => job.status === 'failed')).toBe(true);
  const match = await list('q=syn-0005');
  expect(match.items).toHaveLength(1);
  const detail = await (await demoRequest(`/api/jobs/${match.items[0].id}`)).json();
  expect(detail.job.error_stage).toBe('compilation');
  expect(detail.events.at(-1).to_status).toBe('failed');
});

it('combines provider and inclusive UTC date filters and returns empty pages honestly', async () => {
  const page = await list('provider=Synthetic+Aurora+Labs&submitted_from=2026-10-01&submitted_to=2026-10-01');
  expect(page.total).toBeGreaterThan(0);
  expect(page.items.every((job) => job.provider === 'Synthetic Aurora Labs' && job.created_at.startsWith('2026-10-01'))).toBe(true);
  expect((await list('page=999')).items).toHaveLength(0);
  expect((await list('q=unknown')).total).toBe(0);
});

it('rejects invalid filters and unknown jobs', async () => {
  for (const query of ['status=invalid', 'page=0', 'page_size=101', 'submitted_from=2026-02-30', 'submitted_from=2026-10-02&submitted_to=2026-10-01']) {
    expect((await demoRequest(`/api/jobs?${query}`)).status).toBe(422);
  }
  expect((await demoRequest('/api/jobs/missing')).status).toBe(404);
});

it('creates personal runs, persists them, and resets without removing the samples', async () => {
  const item = addDemoJob('My failure', 'execution_failure');
  expect(item.job.name).toBe('My failure');
  expect(item.job.status).toBe('failed');
  expect(item.job.error_stage).toBe('execution');
  expect((await list()).total).toBe(201);
  expect(localStorage.getItem('quantum-job-tracker-playground-v1')).toContain('My failure');
  expect((await demoRequest(`/api/jobs/${item.job.id}`)).status).toBe(200);
  resetDemo();
  expect((await list()).total).toBe(200);
  expect((await demoRequest(`/api/jobs/${item.job.id}`)).status).toBe(404);
});

it('generates consistent event histories for every simulated outcome', () => {
  for (const scenario of scenarios) {
    const { job, events } = makeDemoJob(0, scenario, '2026-10-01T09:00:00.000Z');
    expect(events.at(-1)?.to_status).toBe(job.status);
    expect(events.at(-1)?.occurred_at).toBe(job.updated_at);
    expect(job.version).toBe(events.length);
    events.forEach((event, index) => {
      expect(event.sequence).toBe(index + 1);
      expect(event.from_status).toBe(index ? events[index - 1].to_status : null);
    });
    if (scenario.includes('failure')) expect(job.finished_at).not.toBeNull();
    if (scenario === 'success') expect(job.result).not.toBeNull();
  }
});
