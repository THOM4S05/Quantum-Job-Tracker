import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import type { ComparisonData } from './Comparison';
import { makeDemoJob, demoRequest } from './demo';

const experiment = '28c51bd0-b3c7-4bbb-adf7-123456789abc';
const choice = `view=comparison&experiment=${experiment}&baseline=synthetic-1.0.0&candidate=synthetic-1.1.0`;
const evidence = makeDemoJob(4, 'compilation_failure', '2026-10-01T09:00:00Z');
const attempts = { succeeded: 1, failed: 0, completed: 1, pending: 0, cancelled: 0, not_started: 0, unknown: 0, rate_percent: 100 };
const side = { runs: 1, compilation: attempts, execution: attempts, jobs: [{ id: evidence.job.id, name: evidence.job.name, status: 'failed' }] };
const data: ComparisonData = { synthetic: true, selection_required: false, experiment_jobs: 2, selected_jobs: 2, excluded_version_jobs: 0, matched_groups: 1,
  experiments: [{ id: experiment, name: 'Synthetic comparison' }], compiler_versions: ['synthetic-1.0.0', 'synthetic-1.1.0'], rows: [{ workload: 'synthetic-workload', status: 'matched', configuration: { target: 'synthetic' }, differences: [], missing_fields: [], baseline: side, candidate: side, metrics: [
    { key: 'compilation_success', label: 'Compilation success rate', unit: '%', delta_unit: 'pp', baseline: { value: 100, samples: 1 }, candidate: { value: 0, samples: 1 }, absolute_change: -100, percentage_change: null },
    { key: 'execution_duration', label: 'Median execution duration', unit: 's', delta_unit: 's', baseline: { value: null, samples: 0 }, candidate: { value: null, samples: 0 }, absolute_change: null, percentage_change: null },
    { key: 'estimated_gate_count', label: 'Median estimated gate count', unit: 'gates', delta_unit: 'gates', baseline: { value: 0, samples: 1 }, candidate: { value: 10, samples: 1 }, absolute_change: 10, percentage_change: null },
  ] }] };
beforeEach(() => { window.history.replaceState(null, '', `/?${choice}`); vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(data))); });
afterEach(() => { vi.unstubAllGlobals(); });

it('renders baseline/candidate samples, percentage points and unavailable percentages without hiding failures', async () => {
  render(<App />);
  const panel = await screen.findByRole('region', { name: 'synthetic-workload comparison 1' });
  expect(panel).toHaveTextContent('-100 pp');
  expect(within(panel).getAllByText('Not enough data')).toHaveLength(2);
  expect(within(panel).getAllByText('Not applicable').length).toBeGreaterThan(2);
  expect(panel).toHaveTextContent('0 gates');
  expect(panel).toHaveTextContent('n=0');
  expect(panel).toHaveTextContent('0 failed / 1 completed');
  expect(screen.getByText(/Queue time can be affected/)).toBeInTheDocument();
});

it('flags configuration differences, missing identity, and unmatched workloads', async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ ...data, rows: [{ ...data.rows[0], status: 'unverifiable', differences: ['target'], missing_fields: ['inputs'] }, { ...data.rows[0], workload: 'baseline-only', status: 'baseline_only' }] }));
  render(<App />);
  expect(await screen.findByText(/Other configurations differ/)).toHaveTextContent('target');
  expect(screen.getByText(/Unverifiable fields/)).toHaveTextContent('inputs');
  expect(screen.getByText(/Unmatched configuration/)).toHaveTextContent('no candidate runs');
});

it('loads experiment-scoped options, applies choices and restores them from browser history', async () => {
  window.history.replaceState(null, '', '/?view=comparison');
  vi.mocked(fetch).mockImplementation((path) => Promise.resolve(Response.json(String(path).includes('baseline=') ? data : { ...data, selection_required: true, rows: [] })));
  render(<App />);
  await screen.findByText('Choose an experiment, then a baseline and a different candidate compiler version.');
  fireEvent.change(screen.getByLabelText('Experiment'), { target: { value: experiment } });
  await waitFor(() => expect(fetch).toHaveBeenCalledWith(`/api/comparisons?experiment=${experiment}`, expect.anything()));
  await screen.findByText('Choose an experiment, then a baseline and a different candidate compiler version.');
  fireEvent.change(screen.getByLabelText('Baseline compiler version'), { target: { value: 'synthetic-1.0.0' } });
  fireEvent.change(screen.getByLabelText('Candidate compiler version'), { target: { value: 'synthetic-1.1.0' } });
  fireEvent.click(screen.getByRole('button', { name: 'Compare versions' }));
  await screen.findByRole('table');
  expect(window.location.search).toBe(`?${choice}`);
  window.history.replaceState(null, '', `/?view=comparison&experiment=${experiment}`);
  fireEvent.popState(window);
  await waitFor(() => expect(screen.getByLabelText('Baseline compiler version')).toHaveValue(''));
});

it('drills to the recorded timeline and returns to the exact comparison choices', async () => {
  const view = render(<App />);
  const panel = await screen.findByRole('region', { name: 'synthetic-workload comparison 1' });
  fireEvent.click(within(panel).getByText('Candidate jobs (1)'));
  const href = within(panel).getAllByRole('link', { name: evidence.job.name }).at(-1)!.getAttribute('href')!;
  expect(href).toBe(`/jobs/${evidence.job.id}?${choice}`);
  view.unmount();
  window.history.replaceState(null, '', href);
  vi.mocked(fetch).mockResolvedValue(Response.json(evidence));
  render(<App />);
  expect(await screen.findByRole('heading', { name: evidence.job.name })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '← Back to comparison' })).toHaveAttribute('href', `/?${choice}`);
  expect(screen.getByRole('list', { name: 'Lifecycle timeline' })).toBeInTheDocument();
});

it('shows loading, validation errors, retry and empty selections honestly', async () => {
  vi.mocked(fetch).mockImplementationOnce(() => new Promise(() => {}));
  const first = render(<App />);
  expect(screen.getByRole('status')).toHaveTextContent('Loading comparison');
  first.unmount();
  vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 422 }));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('two different compiler versions');
  vi.mocked(fetch).mockResolvedValue(Response.json({ ...data, experiments: [], rows: [], selection_required: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(/No named experiments/)).toBeInTheDocument();
  const browser = await (await demoRequest('/api/comparisons')).json();
  expect(browser.selection_required).toBe(true);
  expect(browser.experiments).toHaveLength(1);
});
