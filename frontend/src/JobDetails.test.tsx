import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { JobDetails, JobEvidence, RecordedEvent } from './JobDetails';
import { emptyMetadata } from './metadata';

const jobId = '00000000-0000-0000-0000-000000000005';
const correlation = '00000000-0000-0000-0000-000000000099';
const time = '2026-10-01T09:00:00Z';
const event = (sequence: number, from_status: string | null, to_status: string, stage: string): RecordedEvent => ({
  id: `event-${sequence}`, job_id: jobId, sequence, occurred_at: time, stage, from_status, to_status,
  message: `Recorded event ${sequence}`, actor: 'synthetic-worker', correlation_id: correlation, details: {},
});
const evidence: JobEvidence = {
  job: { id: jobId, name: 'Synthetic failure investigation', external_reference: 'SYN-0005',
    provider: 'Synthetic Nebula Works', target: 'simulator-8q', status: 'failed',
    created_at: time, updated_at: time, started_at: time, finished_at: time,
    requested_by: 'demo.operator', version: 3, retry_of: null, original_job_id: null,
    specification: { synthetic: true }, scenario: 'compilation_failure', seed: 10004,
    simulation_version: 'v1', result: null, error_stage: 'compilation',
    error_code: 'SYNTHETIC_COMPILATION_FAILED', error_message: 'The fictional compiler rejected this synthetic input.' },
  events: [event(1, null, 'queued', 'submission'), event(2, 'queued', 'running', 'compilation'),
    { ...event(3, 'running', 'failed', 'compilation'), details: { synthetic: true, diagnostic: { line: 12 } } }],
  history_complete: true,
};
const response = (body: JobEvidence) => new Response(JSON.stringify(body));

beforeEach(() => vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response(evidence)))));
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function show() { return render(<JobDetails jobId={jobId} backHref="/?status=failed&provider=Synthetic+Nebula+Works&page=2" />); }

it('shows loading and keeps the filtered-list link available', () => {
  vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
  show();
  expect(screen.getByRole('status')).toHaveTextContent('Loading job evidence');
  expect(screen.getByRole('link', { name: /Back to filtered jobs/ })).toHaveAttribute('href', '/?status=failed&provider=Synthetic+Nebula+Works&page=2');
});

it('displays recorded evidence, ordered events, correlation, and expandable raw diagnostics', async () => {
  show();
  const failure = await screen.findByRole('region', { name: 'Recorded failure evidence' });
  expect(within(failure).getByText(evidence.job.error_message!)).toBeInTheDocument();
  expect(within(failure).getByText('SYNTHETIC_COMPILATION_FAILED')).toBeInTheDocument();
  expect(within(failure).getByText(correlation)).toBeInTheDocument();
  const overview = screen.getByRole('region', { name: 'Target and configuration' });
  expect(overview).toHaveTextContent('Synthetic Nebula Works');
  expect(overview).toHaveTextContent('simulator-8q');
  expect(screen.getByRole('region', { name: 'Timings' })).toHaveTextContent('UTC');
  const rows = within(screen.getByRole('list', { name: 'Lifecycle timeline' })).getAllByRole('listitem');
  expect(rows.map((row) => row.getAttribute('data-sequence'))).toEqual(['1', '2', '3']);
  expect(rows[2]).toHaveTextContent('Running → Failed');
  await userEvent.click(screen.getByText('Structured diagnostics for event 3'));
  expect(screen.getByText(/"line": 12/)).toBeVisible();
  expect(screen.getByText(/does not establish a root cause/)).toBeInTheDocument();
});

it('labels absent failure diagnostics and missing timestamps honestly', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(response({
    ...evidence, history_complete: false, events: [],
    job: { ...evidence.job, error_stage: null, error_code: null, error_message: null, started_at: null },
  }));
  show();
  await screen.findByRole('region', { name: 'Recorded failure evidence' });
  expect(screen.getByText('No explanation was recorded.')).toBeInTheDocument();
  expect(screen.getByText(/No failure transition event was recorded/)).toBeInTheDocument();
  expect(screen.getByText(/Missing events have not been reconstructed/)).toBeInTheDocument();
  expect(screen.getByText(/No lifecycle events were recorded/)).toBeInTheDocument();
  expect(screen.queryByText('SYNTHETIC_COMPILATION_FAILED')).not.toBeInTheDocument();
});

it('shows missing-job feedback and a return link on 404', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 404 }));
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('Job not found');
  expect(screen.getByRole('link', { name: /Back to filtered jobs/ })).toBeInTheDocument();
  expect(screen.queryByRole('list')).not.toBeInTheDocument();
});

it('shows an invalid ID honestly rather than a missing job', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 422 }));
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('Invalid job ID');
});

it('retries an unavailable evidence endpoint', async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Offline'));
  show();
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to load job evidence');
  await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('list', { name: 'Lifecycle timeline' })).toBeInTheDocument();
});

it('retains stale evidence on polling failure and replaces snapshots without duplicate events', async () => {
  vi.useFakeTimers();
  vi.mocked(fetch).mockResolvedValueOnce(response(evidence)).mockRejectedValueOnce(new TypeError('Offline'));
  show();
  await act(async () => {});
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(screen.getByRole('alert')).toHaveTextContent('Showing previously loaded evidence');
  expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3);
  await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3);
});

it('does not label successful jobs as failures', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(response({ ...evidence, job: { ...evidence.job, status: 'succeeded',
    result: { synthetic: true }, error_code: null, error_message: null, error_stage: null } }));
  show();
  await screen.findByRole('region', { name: 'Target and configuration' });
  expect(screen.queryByRole('region', { name: 'Recorded failure evidence' })).not.toBeInTheDocument();
  expect(screen.getByText('Recorded result (synthetic observed output)')).toBeInTheDocument();
});

it('groups compiler metadata, configuration, estimates, timings and evidence, keeping zero distinct from unknown', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(response({ ...evidence, job: { ...evidence.job,
    metadata: { ...emptyMetadata(), program_name: 'Synthetic workload', program_revision: 'synthetic-r1',
      compiler_name: 'Synthetic Test Compiler', compiler_version: 'synthetic-1.0.0',
      requested_shots: 1024, estimated_logical_qubits: 0, estimated_gate_count: 20 },
    durations: { compilation_seconds: 1.25, queue_seconds: 0, execution_seconds: null },
  } }));
  show();
  const program = await screen.findByRole('region', { name: 'Program and compiler' });
  expect(program).toHaveTextContent('Synthetic Test Compiler');
  expect(program).toHaveTextContent('synthetic-r1');
  const resources = screen.getByRole('region', { name: 'Estimated resources' });
  expect(within(resources).getByText('0', { selector: 'dd' })).toBeInTheDocument();
  expect(within(resources).getByText('Not available', { selector: 'dd' })).toBeInTheDocument();
  const timings = screen.getByRole('region', { name: 'Timings' });
  expect(timings).toHaveTextContent('1.25 s');
  expect(timings).toHaveTextContent('0 s');
  expect(timings).toHaveTextContent('Not available');
  expect(screen.getByRole('region', { name: 'Lifecycle and failure evidence' })).toBeInTheDocument();
});
