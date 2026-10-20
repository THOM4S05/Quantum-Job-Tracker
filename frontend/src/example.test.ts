import { expect, it } from 'vitest';
import { demoRequest, resetDemo } from './demo';
import { example, exampleHref } from './example';
import type { ComparisonData } from './Comparison';

it('opens the exported seed with complete matching evidence and both comparison directions', async () => {
  const params = new URL(exampleHref, 'https://demo.invalid/Quantum-Job-Tracker/').searchParams;
  params.delete('view');
  const response = await demoRequest(`/api/comparisons?${params}`);
  expect(response.status).toBe(200);
  const body = await response.json() as ComparisonData;
  expect(body.matched_groups).toBe(4);
  expect(body.selected_jobs).toBe(56);
  const ids = new Set<string>();
  for (const row of body.rows) {
    for (const side of ['baseline', 'candidate'] as const) {
      for (const job of row[side].jobs) {
        ids.add(job.id);
        const evidence = await (await demoRequest(`/api/jobs/${job.id}`)).json();
        expect(evidence.history_complete).toBe(true);
        expect(evidence.events.at(-1).to_status).toBe(evidence.job.status);
      }
    }
  }
  expect(ids.size).toBe(56);
  params.set('baseline', example.candidate);
  params.set('candidate', example.baseline);
  expect((await (await demoRequest(`/api/comparisons?${params}`)).json()).matched_groups).toBe(4);
  resetDemo();
  expect((await (await demoRequest('/api/jobs')).json()).total).toBe(256);
});

it('keeps empty, invalid and missing-data responses honest', async () => {
  const unknown = '00000000-0000-0000-0000-000000000000';
  const empty = await (await demoRequest(`/api/comparisons?experiment=${unknown}&baseline=a&candidate=b`)).json();
  expect(empty.rows).toEqual([]);
  expect(empty.selection_required).toBe(false);
  expect((await demoRequest(`/api/comparisons?experiment=${example.id}&baseline=a&candidate=a`)).status).toBe(422);
  const body = await (await demoRequest(`/api/comparisons?experiment=${example.id}&baseline=${example.baseline}&candidate=${example.candidate}`)).json() as ComparisonData;
  const failure = body.rows.find((row) => row.workload === 'compile-regression')!;
  expect(failure.candidate.compilation.failed).toBe(7);
  expect(failure.metrics.find((metric) => metric.key === 'execution_duration')!.candidate).toEqual({ value: null, samples: 0, job_ids: [] });
});
