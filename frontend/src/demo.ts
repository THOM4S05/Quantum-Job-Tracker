import type { Job, JobPage } from './App';
import type { JobEvidence, RecordedEvent } from './JobDetails';
import { calculateOverview } from './overviewMetrics';
import { emptyMetadata, deriveDurations, syntheticMetadata } from './metadata';

export const scenarios = ['success', 'compilation_failure', 'queueing_failure', 'execution_failure', 'queued', 'running', 'cancelled'] as const;
export type Scenario = typeof scenarios[number];
const providers = ['Synthetic Aurora Labs', 'Synthetic Nebula Works', 'Synthetic Quasar Forge'];
const storageKey = 'quantum-job-tracker-playground-v1';

export function makeDemoJob(index: number, scenario: Scenario, created: string, name?: string): JobEvidence {
  const id = `00000000-0000-4000-8000-${(index + 1).toString(16).padStart(12, '0')}`;
  const events: RecordedEvent[] = [];
  const at = (seconds: number) => new Date(Date.parse(created) + seconds * 1000).toISOString();
  const job: JobEvidence['job'] = {
    id, name: name || `Synthetic experiment ${String(index + 1).padStart(3, '0')}`,
    provider: providers[index % 3], target: `simulator-${8 + index % 4 * 8}q`,
    external_reference: `${index < 200 ? 'SYN' : 'PLAY'}-${String(index + 1).padStart(4, '0')}`,
    status: 'queued', created_at: created, updated_at: created, requested_by: index < 200 ? 'demo.operator.alex' : 'you.playground',
    retry_of: null, original_job_id: null, started_at: null, finished_at: null, version: 0,
    specification: { qubits: 8 + index % 4 * 8, shots: 1024, synthetic: true }, scenario,
    seed: 10000 + index, simulation_version: 'browser-v1', result: null,
    error_code: null, error_message: null, error_stage: null,
  };
  job.metadata = syntheticMetadata(index, job.name, scenario, created);
  job.durations = deriveDurations(job.metadata);
  // Update the job and its history together so they always agree
  function record(status: Job['status'], stage: string, seconds: number, message: string) {
    events.push({ id: `${id}-${events.length + 1}`, job_id: id, sequence: events.length + 1,
      occurred_at: at(seconds), stage, from_status: events.length ? job.status : null, to_status: status,
      message, details: { synthetic: true, scenario }, correlation_id: id, actor: 'browser-simulator' });
    job.status = status;
    job.updated_at = at(seconds);
    job.version = events.length;
  }
  record('queued', 'submission', 0, 'Synthetic job submitted');
  if (scenario === 'cancelled') {
    record('cancelled', 'cancellation', 1, 'Synthetic job cancelled before compilation');
    job.finished_at = at(1);
  } else if (scenario !== 'queued') {
    record('running', 'compilation', 1, 'Synthetic compilation started');
    job.started_at = at(1);
    for (const [step, stage] of ['compilation', 'queueing', 'execution'].entries()) {
      if (scenario === `${stage}_failure`) {
        record('failed', stage, step + 2, `Simulated ${stage} failure`);
        job.error_stage = stage;
        job.error_code = `SYNTHETIC_${stage.toUpperCase()}_FAILED`;
        job.error_message = `Fictional provider reported a synthetic ${stage} failure`;
        job.finished_at = at(step + 2);
        break;
      }
      record('running', stage, step + 2, `Synthetic ${stage} checkpoint`);
    }
    if (scenario === 'success') {
      record('succeeded', 'execution', 5, 'Synthetic execution completed');
      job.finished_at = at(5);
      job.result = { synthetic: true, shots: 1024, counts: { '00': 500 + index % 25, '11': 524 - index % 25 } };
    }
  }
  return { job, events, history_complete: true };
}

// Use the same dates and outcomes each time the sample jobs are made
const fixtures = Array.from({ length: 200 }, (_, index) => {
  const bucket = index % 10;
  return makeDemoJob(index, bucket < 4 ? 'success' : scenarios[bucket - 3],
    new Date(Date.UTC(2026, 9, 1, 9) + index * 7 * 60_000).toISOString());
});
let customJobs: JobEvidence[] = [];
try {
  const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || '[]');
  if (Array.isArray(saved)) customJobs = saved.filter((item): item is JobEvidence =>
    item?.job?.id && typeof item.job.created_at === 'string' && Array.isArray(item.events)).slice(0, 100).map((item) => {
      // Older saved personal runs retain unknown fields; never invent compiler data.
      item.job.metadata = { ...emptyMetadata(), ...item.job.metadata };
      item.job.durations = deriveDurations(item.job.metadata);
      return item;
    });
} catch { /* A fresh playground remains available when browser storage is disabled. */ }

function save() {
  try { localStorage.setItem(storageKey, JSON.stringify(customJobs)); } catch { /* Runs still work in memory. */ }
}
export function addDemoJob(name: string, scenario: Scenario) {
  // At most 100 personal runs; timestamp-derived IDs avoid reusing removed run IDs.
  const item = makeDemoJob(Date.now(), scenario, new Date(Date.now() - 5000).toISOString(), name.trim() || 'My quantum experiment');
  customJobs = [item, ...customJobs].slice(0, 100);
  save();
  return item;
}
export function resetDemo() { customJobs = []; save(); }

export async function demoRequest(path: string): Promise<Response> {
  const url = new URL(path, 'https://demo.invalid');
  const all = [...customJobs, ...fixtures];
  // Browser samples have no named experiments. Do not fabricate backend comparisons.
  if (url.pathname === '/api/comparisons') return Response.json({ synthetic: true, selection_required: true,
    experiments: [], compiler_versions: [], experiment_jobs: 0, rows: [], selected_jobs: 0, excluded_version_jobs: 0, matched_groups: 0 });
  const id = url.pathname.match(/^\/api\/jobs\/([^/]+)$/)?.[1];
  if (id) {
    const found = all.find((item) => item.job.id === decodeURIComponent(id));
    return Response.json(found ?? {}, { status: found ? 200 : 404 });
  }
  const params = url.searchParams;
  const overview = url.pathname === '/api/overview';
  const target = params.get('target')?.trim();
  const compiler = params.get('compiler_version')?.trim();
  const experiment = params.get('experiment');
  const failureStage = params.get('failure_stage');
  const experimentRecord = (job: JobEvidence['job']) => job.specification.experiment as { id?: string; name?: string } | undefined;
  const options = {
    targets: [...new Set(all.map((item) => item.job.target))].sort(),
    compiler_versions: [...new Set(all.map((item) => item.job.metadata?.compiler_version).filter((value): value is string => !!value))].sort(),
    experiments: [...new Map(all.flatMap((item) => {
      const group = experimentRecord(item.job);
      return group?.id ? [[group.id, { id: group.id, name: group.name || group.id }] as const] : [];
    })).values()].sort((a, b) => a.id.localeCompare(b.id)),
  };
  if (overview && [...params.keys()].some((key) => !['submitted_from', 'submitted_to', 'target', 'compiler_version', 'experiment'].includes(key))) return Response.json({}, { status: 422 });
  const status = params.get('status');
  const from = params.get('submitted_from');
  const to = params.get('submitted_to');
  const page = Number(params.get('page') ?? 1);
  const pageSize = Number(params.get('page_size') ?? 25);
  // Check the date stays the same after parsing to catch days like 30 February
  const validDate = (value: string | null) => !value || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value);
  if ((target !== undefined && (!target || target.length > 120)) ||
      (compiler !== undefined && (!compiler || compiler.length > 80)) ||
      (experiment !== null && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(experiment)) ||
      (failureStage !== null && !['compilation', 'queueing', 'execution', 'unknown'].includes(failureStage)) ||
      (status && !['queued', 'running', 'cancel_requested', 'succeeded', 'failed', 'cancelled'].includes(status)) ||
      !validDate(from) || !validDate(to) || (from && to && from > to) ||
      !Number.isInteger(page) || page < 1 || page > 1000000 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    return Response.json({}, { status: 422 });
  }
  const q = params.get('q')?.trim().toLowerCase();
  const items = all.map((item) => item.job).filter((job) =>
    (!target || job.target === target) && (!compiler || job.metadata?.compiler_version === compiler) &&
    (!experiment || experimentRecord(job)?.id === experiment) &&
    (!failureStage || (job.status === 'failed' && (job.error_stage || 'unknown') === failureStage)) &&
    (!q || job.id.toLowerCase() === q || job.external_reference?.toLowerCase() === q) &&
    (!status || job.status === status) && (!params.get('provider') || job.provider === params.get('provider')) &&
    (!from || job.created_at.slice(0, 10) >= from) && (!to || job.created_at.slice(0, 10) <= to)
  ).sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
  if (overview) return Response.json({ ...calculateOverview(items), ...options });
  const body: JobPage = { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length,
    page, page_size: pageSize, total_pages: Math.ceil(items.length / pageSize), providers, ...options };
  return Response.json(body);
}
