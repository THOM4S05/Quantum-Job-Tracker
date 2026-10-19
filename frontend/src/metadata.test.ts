import { expect, it, vi } from 'vitest';
import { deriveDurations, emptyMetadata, syntheticMetadata } from './metadata';
import { makeDemoJob, scenarios } from './demo';

it('keeps unknown endpoints null, genuine zero intervals zero, and fractional/timezone arithmetic consistent', () => {
  expect(deriveDurations(emptyMetadata())).toEqual({ compilation_seconds: null, queue_seconds: null, execution_seconds: null });
  expect(deriveDurations({ ...emptyMetadata(),
    compilation_started_at: '2026-10-01T10:00:00.000100+01:00', compilation_finished_at: '2026-10-01T09:00:01.250900Z',
    queue_entered_at: '2026-10-01T09:00:01.250900Z', queue_left_at: '2026-10-01T09:00:01.250900Z',
    execution_started_at: '2026-10-01T09:00:02Z',
  })).toEqual({ compilation_seconds: 1.2508, queue_seconds: 0, execution_seconds: null });
  expect(deriveDurations({ ...emptyMetadata(), execution_finished_at: '2026-10-01T09:00:02Z' }).execution_seconds).toBeNull();
  expect(deriveDurations({ ...emptyMetadata(), queue_entered_at: '2026-10-01T09:00:02Z', queue_left_at: '2026-10-01T09:00:01Z' }).queue_seconds).toBeNull();
});

it('gives each demo outcome the backend metadata shape without using observed results as estimates', () => {
  for (const scenario of scenarios) {
    const item = makeDemoJob(4, scenario, '2026-10-01T09:00:00Z');
    expect(Object.keys(item.job.metadata!).sort()).toEqual(Object.keys(emptyMetadata()).sort());
    expect(item.job.metadata!.compiler_name).toMatch(/^Synthetic/);
    expect(item.job.metadata!.compiler_version).toBe('synthetic-1.0.0');
    expect(item.job.metadata!.estimated_gate_count).toBe(604);
    expect(item.job.durations).toEqual(deriveDurations(item.job.metadata!));
    if (scenario === 'success') expect(item.job.durations).toEqual({ compilation_seconds: 1, queue_seconds: 1, execution_seconds: 2 });
    if (scenario === 'running') expect(item.job.durations!.execution_seconds).toBeNull();
    if (scenario === 'compilation_failure') expect(item.job.metadata!.execution_started_at).toBeNull();
  }
  expect(syntheticMetadata(0, 'Unknown estimates', 'success', '2026-10-01T09:00:00Z').estimated_gate_count).toBeNull();
});

it('loads older personal runs with unavailable metadata rather than fabricating a compiler or zeros', async () => {
  const old = makeDemoJob(250, 'success', '2026-10-01T09:00:00Z');
  delete old.job.metadata;
  delete old.job.durations;
  localStorage.setItem('quantum-job-tracker-playground-v1', JSON.stringify([old]));
  vi.resetModules();
  const demo = await import('./demo');
  const loaded = await (await demo.demoRequest(`/api/jobs/${old.job.id}`)).json();
  expect(loaded.job.metadata).toEqual(emptyMetadata());
  expect(loaded.job.durations).toEqual(deriveDurations(emptyMetadata()));
  expect(loaded.job.result).toEqual(old.job.result);
  expect(loaded.events).toEqual(old.events);
  demo.resetDemo();
});
