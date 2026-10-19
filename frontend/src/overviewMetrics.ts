// Browser-demo adapter only. Keep definitions aligned with docs/metrics.md and API.
import type { JobEvidence } from './JobDetails';
import type { CohortOptions } from './CohortFields';
export type Attempts = { succeeded: number; failed: number; completed: number; pending: number; cancelled: number; not_started: number; unknown: number; rate_percent: number | null };
export type Timing = { median_seconds: number | null; samples: number; excluded: number };
export type OverviewData = CohortOptions & {
  synthetic: boolean; total_jobs: number; cancelled_jobs: number; cancelling_jobs: number;
  compilation: Attempts; execution: Attempts; queue_time: Timing; execution_duration: Timing;
  failures_by_stage: { key: string; count: number }[]; jobs_by_target: { key: string; count: number }[];
};
type Snapshot = JobEvidence['job'];
const time = (value: string | null | undefined) => value && /(?:Z|[+-]\d{2}:\d{2})$/.test(value) && Number.isFinite(Date.parse(value)) ? Date.parse(value) : null;
function attempt(job: Snapshot, phase: 'compilation' | 'execution'): Exclude<keyof Attempts, 'completed' | 'rate_percent'> {
  const m = job.metadata;
  if (['cancelled', 'cancel_requested'].includes(job.status)) return 'cancelled';
  if (job.status === 'failed' && job.error_stage === phase) return 'failed';
  if (phase === 'execution') {
    if (job.status === 'succeeded') return 'succeeded';
    if (time(m?.execution_started_at) !== null) return ['queued', 'running'].includes(job.status) ? 'pending' : 'unknown';
    return job.status === 'failed' && !['compilation', 'queueing'].includes(job.error_stage ?? '') ? 'unknown' : 'not_started';
  }
  if (time(m?.compilation_finished_at) !== null && (job.status !== 'failed' || ['queueing', 'execution'].includes(job.error_stage ?? ''))) return 'succeeded';
  if (job.status === 'queued' && !m?.compilation_started_at) return 'not_started';
  if (['queued', 'running'].includes(job.status) && time(m?.compilation_started_at) !== null) return 'pending';
  return 'unknown';
}
export function calculateOverview(rows: Snapshot[]): OverviewData {
  const rate = (phase: 'compilation' | 'execution'): Attempts => {
    const counts: Attempts = { succeeded: 0, failed: 0, completed: 0, pending: 0, cancelled: 0, not_started: 0, unknown: 0, rate_percent: null };
    rows.forEach((job) => counts[attempt(job, phase)]++);
    counts.completed = counts.succeeded + counts.failed;
    counts.rate_percent = counts.completed ? Math.round(100_000_000 * counts.succeeded / counts.completed) / 1_000_000 : null;
    return counts;
  };
  const duration = (start: string | null | undefined, end: string | null | undefined) => {
    const a = time(start), b = time(end);
    return a === null || b === null || b < a ? null : (b - a) / 1000;
  };
  const median = (values: (number | null)[]): Timing => {
    const known = values.filter((value): value is number => value !== null).sort((a, b) => a - b);
    const n = known.length;
    return { median_seconds: n ? (known[Math.floor((n - 1) / 2)] + known[Math.floor(n / 2)]) / 2 : null, samples: n, excluded: rows.length - n };
  };
  return { synthetic: true, total_jobs: rows.length, cancelled_jobs: rows.filter((job) => job.status === 'cancelled').length,
    cancelling_jobs: rows.filter((job) => job.status === 'cancel_requested').length, compilation: rate('compilation'), execution: rate('execution'),
    queue_time: median(rows.map((job) => duration(job.metadata?.queue_entered_at, job.metadata?.execution_started_at))),
    execution_duration: median(rows.map((job) => ['succeeded', 'failed'].includes(attempt(job, 'execution')) ? duration(job.metadata?.execution_started_at, job.metadata?.execution_finished_at) : null)),
    failures_by_stage: ['compilation', 'queueing', 'execution', 'unknown'].map((key) => ({ key, count: rows.filter((job) => job.status === 'failed' && (job.error_stage || 'unknown') === key).length })),
    jobs_by_target: [...new Set(rows.map((job) => job.target))].sort().map((key) => ({ key, count: rows.filter((job) => job.target === key).length })),
  };
}
