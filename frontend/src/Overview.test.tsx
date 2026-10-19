import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { makeDemoJob, demoRequest } from './demo';
import { calculateOverview } from './overviewMetrics';
import type { OverviewData } from './overviewMetrics';

const at = '2026-10-01T09:00:00Z';
const id = '28c51bd0-b3c7-4bbb-adf7-123456789abc';
const jobs = ['success', 'compilation_failure', 'queueing_failure', 'execution_failure', 'queued', 'running', 'cancelled'].map((scenario, index) => makeDemoJob(index, scenario as Parameters<typeof makeDemoJob>[1], at).job);
const data: OverviewData = { ...calculateOverview(jobs), targets: ['simulator-8q'], compiler_versions: ['synthetic-1.0.0'], experiments: [{ id, name: 'Synthetic comparison' }] };

beforeEach(() => {
  window.history.replaceState(null, '', '/?view=overview');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(data)));
});
afterEach(() => { vi.unstubAllGlobals(); });

it('calculates recorded outcomes, pending/cancel exclusions and timing medians for the browser adapter', () => {
  const result = calculateOverview(jobs);
  expect(result.compilation).toMatchObject({ succeeded: 4, failed: 1, completed: 5, rate_percent: 80, not_started: 1, cancelled: 1 });
  expect(result.execution).toMatchObject({ succeeded: 1, failed: 1, completed: 2, rate_percent: 50, pending: 1, not_started: 3, cancelled: 1 });
  expect(result.queue_time).toEqual({ median_seconds: 1, samples: 3, excluded: 4 });
  expect(result.execution_duration).toEqual({ median_seconds: 1.5, samples: 2, excluded: 5 });
  const missing = { ...jobs[0], metadata: undefined };
  expect(calculateOverview([missing]).execution).toMatchObject({ succeeded: 1, rate_percent: 100 });
  expect(calculateOverview([missing]).compilation.unknown).toBe(1);
  expect(calculateOverview([missing]).execution_duration.median_seconds).toBeNull();
  expect(calculateOverview([]).queue_time.median_seconds).toBeNull();
});

it('does not classify an unknown-stage failure as compilation failure or include cancelled duration', () => {
  const unknown = { ...jobs[0], status: 'failed' as const, error_stage: null };
  const cancelled = { ...jobs[0], status: 'cancelled' as const };
  const result = calculateOverview([unknown, cancelled]);
  expect(result.compilation).toMatchObject({ failed: 0, succeeded: 0, unknown: 1, cancelled: 1, rate_percent: null });
  expect(result.execution_duration.samples).toBe(0);
  expect(result.queue_time.samples).toBe(2);
});

it('renders cards, sample counts, definitions and breakdown links preserving every cohort filter', async () => {
  window.history.replaceState(null, '', `/?view=overview&submitted_from=2026-10-01&submitted_to=2026-10-02&target=simulator-8q&compiler_version=synthetic-1.0.0&experiment=${id}`);
  render(<App />);
  const compilation = await screen.findByRole('article', { name: 'Compilation success rate' });
  expect(compilation).toHaveTextContent('80%');
  expect(compilation).toHaveTextContent('4 successful / 5 completed attempts');
  fireEvent.click(within(compilation).getByText('Excluded from denominator'));
  expect(compilation).toHaveTextContent('1 cancelled or cancelling');
  expect(screen.getByRole('article', { name: 'Median execution duration' })).toHaveTextContent('1.5 s');
  expect(screen.getByText(/Dates select a cohort/)).toHaveTextContent('job submission time (UTC)');
  expect(screen.getAllByText(/synthetic/i).length).toBeGreaterThan(0);
  const href = within(screen.getByRole('region', { name: 'Failures by stage' })).getByRole('link', { name: 'Compilation 1 job' }).getAttribute('href')!;
  const params = new URL(href, window.location.origin).searchParams;
  expect(params.get('view')).toBeNull();
  expect(params.get('experiment')).toBe(id);
  expect(params.get('compiler_version')).toBe('synthetic-1.0.0');
  expect(params.get('target')).toBe('simulator-8q');
  expect(params.get('submitted_to')).toBe('2026-10-02');
  expect(params.get('failure_stage')).toBe('compilation');
  expect(params.get('status')).toBe('failed');
  expect(within(screen.getByRole('region', { name: 'Jobs by target' })).getAllByRole('link')).toHaveLength(data.jobs_by_target.length);
});

it('shows loading, empty observation labels, filter application and URL restoration', async () => {
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}));
  const view = render(<App />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading overview');
  view.unmount();
  vi.mocked(fetch).mockResolvedValue(Response.json({ ...data, ...calculateOverview([]) }));
  render(<App />);
  expect(await screen.findAllByText('Not enough data')).toHaveLength(4);
  expect(screen.getByText(/No jobs match/)).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Target'), { target: { value: 'simulator-8q' } });
  fireEvent.change(screen.getByLabelText('Experiment'), { target: { value: id } });
  fireEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
  await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(`/api/overview?target=simulator-8q&experiment=${id}`, expect.anything()));
  window.history.replaceState(null, '', '/?view=overview&compiler_version=synthetic-1.0.0');
  fireEvent.popState(window);
  await waitFor(() => expect(screen.getByLabelText('Compiler version')).toHaveValue('synthetic-1.0.0'));
  expect(screen.getByLabelText('Target')).toHaveValue('');
});

it('explains invalid filters and allows retry after an API error', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 422 }));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Some filters are invalid');
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('article', { name: 'Execution success rate' })).toHaveTextContent('50%');
});

it('serves browser overview and drill-downs from recorded demo data with the shared filters', async () => {
  const overview = await (await demoRequest('/api/overview')).json() as OverviewData;
  expect(overview.total_jobs).toBe(200);
  expect(overview.compilation.rate_percent).toBe(87.5);
  expect(overview.execution.rate_percent).toBe(80);
  expect(overview.execution_duration).toEqual({ median_seconds: 2, samples: 100, excluded: 100 });
  for (const stage of overview.failures_by_stage) {
    const listed = await (await demoRequest(`/api/jobs?status=failed&failure_stage=${stage.key}`)).json();
    expect(listed.total).toBe(stage.count);
  }
  const selected = await (await demoRequest('/api/overview?target=simulator-8q&compiler_version=synthetic-1.0.0&submitted_from=2026-10-01&submitted_to=2026-10-02')).json();
  const listed = await (await demoRequest('/api/jobs?target=simulator-8q&compiler_version=synthetic-1.0.0&submitted_from=2026-10-01&submitted_to=2026-10-02')).json();
  expect(selected.total_jobs).toBe(listed.total);
  expect((await demoRequest('/api/overview?experiment=invalid')).status).toBe(422);
});
