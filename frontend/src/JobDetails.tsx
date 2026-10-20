import { emptyMetadata } from './metadata';
import { useEffect, useState } from 'react';
import type { Job } from './App';
import { request } from './api';
import { guideHref, homeHref, isDemo, jobHref } from './environment';

export type RecordedEvent = {
  id: string; job_id: string; sequence: number; occurred_at: string;
  stage: string | null; from_status: string | null; to_status: string;
  message: string | null; details: Record<string, unknown> | null;
  correlation_id: string | null; actor: string | null;
};
export type JobEvidence = {
  job: Job & {
    updated_at: string; started_at: string | null; finished_at: string | null;
    version: number; specification: Record<string, unknown>; scenario: string;
    seed: number; simulation_version: string; result: Record<string, unknown> | null;
    error_code: string | null; error_message: string | null; error_stage: string | null;
    original_job_id: string | null;
  };
  events: RecordedEvent[];
  history_complete: boolean;
};

const recorded = (value: string | null | undefined) => value?.trim() ? value : 'Not available';
const label = (value: string | null) => value ? value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase()) : 'Not available';
const timestamp = (value: string | null) => value ? `${new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'medium', timeStyle: 'medium', timeZone: 'UTC',
}).format(new Date(value))} UTC` : 'Not available';

type EvidenceState = {
  jobId: string; data: JobEvidence | null; loading: boolean;
  problem: 'not-found' | 'invalid' | 'unavailable' | null; checked: string | null;
};

export function JobDetails({ jobId, backHref, backLabel = "← Back to filtered jobs" }: { jobId: string; backHref: string; backLabel?: string }) {
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<EvidenceState>({ jobId, data: null, loading: true, problem: null, checked: null });
  useEffect(() => {
    let stopped = false;
    let permanent = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    let data: JobEvidence | null = null;
    let checked: string | null = null;
    setState({ jobId, data, loading: true, problem: null, checked });
    async function load(initial = false) {
      if (document.visibilityState === 'hidden' && !initial) {
        timer = setTimeout(() => void load(), 5000);
        return;
      }
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await request(`/api/jobs/${encodeURIComponent(jobId)}`, { signal: controller.signal, cache: 'no-store' });
        if (response.status === 404 || response.status === 422) {
          // Stop checking missing or bad IDs until the page loads again
          permanent = true;
          if (!stopped) setState({ jobId, data: null, loading: false, problem: response.status === 404 ? 'not-found' : 'invalid', checked: null });
          return;
        }
        if (!response.ok) throw new Error('Evidence unavailable');
        const body = await response.json() as JobEvidence;
        if (!body.job || !Array.isArray(body.events) || typeof body.history_complete !== 'boolean') throw new Error('Unexpected response');
        if (!stopped) {
          data = body;
          checked = new Date().toISOString();
          setState({ jobId, data, loading: false, problem: null, checked });
        }
      } catch {
        // Keep the last good job data on screen if an update fails
        if (!stopped) setState({ jobId, data, loading: false, problem: 'unavailable', checked });
      } finally {
        clearTimeout(timeout);
        if (!stopped && !permanent) timer = setTimeout(() => void load(), 5000);
      }
    }
    void load(true);
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [jobId, refresh]);

  // Hide the old job while the new one loads
  const current = state.jobId === jobId ? state : { jobId, data: null, loading: true, problem: null, checked: null };
  const evidence = current.data;
  const job = evidence?.job;
  const metadata = { ...emptyMetadata(), ...job?.metadata };
  const available = (value: string | number | null | undefined) => value == null || value === '' ? 'Not available' : typeof value === 'number' ? value.toLocaleString('en-GB', { maximumFractionDigits: 6 }) : value;
  const phaseTime = (value: string | null) => value ? timestamp(value) : 'Not available';
  const seconds = (value: number | null | undefined) => value == null ? 'Not available' : `${available(value)} s`;
  // Find the last failure event and keep the timeline in order
  const failure = evidence?.events.slice().reverse().find((event) => event.to_status === 'failed' && event.from_status !== 'failed');
  const returnContext = backLabel === "← Back to comparison" ? "Comparison" : "Jobs";
  const lineageHref = (id: string) => jobHref(id, backHref.split('?')[1] ?? '');

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Workspace navigation">
        <header><span className="mark" aria-hidden="true">Q</span><span className="brand-name">Quantum Job Tracker</span></header>
        <p className="workspace-label">WORKSPACE</p>
        <a className="nav-item active" href={backHref}><span aria-hidden="true">▦</span> {returnContext}</a>
        <a className="nav-item" href={guideHref}>Demo &amp; Guide</a>
      <div className="sidebar-note"><span className="sidebar-note-icon" aria-hidden="true">◇</span><strong>Synthetic environment</strong><p>Investigate recorded evidence from fictional runs.</p></div>
        <div className="sidebar-bottom"><span className="brand-footer">Quantum Job Tracker</span><span>{isDemo ? 'Browser demo' : 'Local workspace'}</span></div>
      </aside>
      <div className="workspace">
        <div className="topbar"><span>Workspace <span className="breadcrumb-divider">/</span><a href={backHref}>{returnContext}</a><span className="breadcrumb-divider">/</span><strong>Details</strong></span><span className="environment-badge">Synthetic environment</span></div>
        <main>
          <a className="back-link" href={backHref}>{backLabel}</a>
          <div className="page-heading"><div><h1>{job?.name ?? 'Job details'}</h1><p className="job-id">{jobId}</p></div>{job && <span className={`status-badge status-${job.status}`}>{label(job.status)}</span>}</div>
          {job && <p className="evidence-jump"><a href="#lifecycle-evidence">Jump to timeline and failure evidence ↓</a></p>}
          {current.loading && <div className="result-state" role="status">Loading job evidence…</div>}
          {current.problem === 'not-found' && <section className="detail-panel" role="alert"><h2>Job not found</h2><p>No job with this ID was found in the current workspace.</p></section>}
          {current.problem === 'invalid' && <section className="detail-panel" role="alert"><h2>Invalid job ID</h2><p>This address does not contain a valid job ID. Return to the list to select a job.</p></section>}
          {current.problem === 'unavailable' && <div className="error-state" role="alert"><div><strong>{job ? 'Showing previously loaded evidence' : 'Unable to load job evidence'}</strong><p>The API could not return the recorded data. Please try again.</p></div><button onClick={() => setRefresh((value) => value + 1)}>Try again</button></div>}
          {job && evidence && <>
            <p className="detail-refresh">Last successful refresh: {timestamp(current.checked)} · Refreshes every 5s</p>
            <section className="detail-panel" aria-labelledby="program-compiler">
              <h2 id="program-compiler">Program and compiler</h2>
              <dl className="metadata-grid">
                <div><dt>Program / workload</dt><dd>{available(metadata.program_name)}</dd></div>
                <div><dt>Program revision / hash</dt><dd>{available(metadata.program_revision)}</dd></div>
                <div><dt>Source language</dt><dd>{available(metadata.source_language)}</dd></div>
                <div><dt>Compiler name</dt><dd>{available(metadata.compiler_name)}</dd></div>
                <div><dt>Compiler version</dt><dd>{available(metadata.compiler_version)}</dd></div>
                <div><dt>Simulation version / seed</dt><dd>{job.simulation_version} / {job.seed}</dd></div>
              </dl>
            </section>
            <section className="detail-panel" aria-labelledby="target-configuration">
              <h2 id="target-configuration">Target and configuration</h2>
              <dl className="metadata-grid">
                <div><dt>Current status</dt><dd>{label(job.status)}</dd></div>
                <div><dt>Provider</dt><dd>{job.provider}</dd></div>
                <div><dt>Target</dt><dd>{job.target}</dd></div>
                <div><dt>External reference</dt><dd>{available(job.external_reference)}</dd></div>
                <div><dt>Requested by</dt><dd>{job.requested_by}</dd></div>
                <div><dt>Requested shots (count)</dt><dd>{available(metadata.requested_shots)}</dd></div>
                {job.retry_of && <div><dt>Retry of</dt><dd><a href={lineageHref(job.retry_of)}>{job.retry_of}</a></dd></div>}
                {job.original_job_id && <div><dt>Original job</dt><dd><a href={lineageHref(job.original_job_id)}>{job.original_job_id}</a></dd></div>}
              </dl>
              <details className="diagnostics"><summary>Optimisation settings</summary>{metadata.optimisation_settings === null ? <p>Not available</p> : <pre>{JSON.stringify(metadata.optimisation_settings, null, 2)}</pre>}</details>
              <details className="diagnostics"><summary>Submission specification</summary><pre>{JSON.stringify(job.specification, null, 2)}</pre></details>
            </section>
            <section className="detail-panel" aria-labelledby="estimated-resources">
              <h2 id="estimated-resources">Estimated resources</h2><p className="evidence-note">Estimates describe the compiled circuit: logical qubits, sequential circuit depth and gate count. They are not observed hardware usage or proof of execution quality.</p>
              <p>Compiler estimates for a synthetic workload. These are not observed results or measurements from quantum hardware.</p>
              <dl className="metadata-grid">
                <div><dt>Estimated logical qubits (count)</dt><dd>{available(metadata.estimated_logical_qubits)}</dd></div>
                <div><dt>Estimated circuit depth (layers)</dt><dd>{available(metadata.estimated_circuit_depth)}</dd></div>
                <div><dt>Estimated gate count (gates)</dt><dd>{available(metadata.estimated_gate_count)}</dd></div>
              </dl>
            </section>
            <section className="detail-panel" aria-labelledby="job-timings">
              <h2 id="job-timings">Timings</h2>
              <p>Recorded UTC timestamps. Durations require both phase endpoints; an unfinished or unknown phase has no duration.</p>
              <dl className="metadata-grid">
                <div><dt>Submitted</dt><dd>{phaseTime(job.created_at)}</dd></div>
                <div><dt>Updated</dt><dd>{phaseTime(job.updated_at)}</dd></div>
                <div><dt>Job started</dt><dd>{phaseTime(job.started_at)}</dd></div>
                <div><dt>Job finished</dt><dd>{phaseTime(job.finished_at)}</dd></div>
                <div><dt>Compilation started</dt><dd>{phaseTime(metadata.compilation_started_at)}</dd></div>
                <div><dt>Compilation finished</dt><dd>{phaseTime(metadata.compilation_finished_at)}</dd></div>
                <div><dt>Compile duration (seconds)</dt><dd>{seconds(job.durations?.compilation_seconds)}</dd></div>
                <div><dt>Queue entered</dt><dd>{phaseTime(metadata.queue_entered_at)}</dd></div>
                <div><dt>Queue left</dt><dd>{phaseTime(metadata.queue_left_at)}</dd></div>
                <div><dt>Queue duration (seconds)</dt><dd>{seconds(job.durations?.queue_seconds)}</dd></div>
                <div><dt>Execution started</dt><dd>{phaseTime(metadata.execution_started_at)}</dd></div>
                <div><dt>Execution finished</dt><dd>{phaseTime(metadata.execution_finished_at)}</dd></div>
                <div><dt>Execution duration (seconds)</dt><dd>{seconds(job.durations?.execution_seconds)}</dd></div>
              </dl>
            </section>
            <div role="region" aria-labelledby="lifecycle-evidence">
            <h2 id="lifecycle-evidence" className="investigation-heading">Lifecycle and failure evidence</h2>
            {job.status === 'succeeded' && <details className="diagnostics observed-result"><summary>Recorded result (synthetic observed output)</summary>{job.result ? <pre>{JSON.stringify(job.result, null, 2)}</pre> : <p>No result was recorded.</p>}</details>}
            {job.status === 'failed' && <section className="detail-panel failure-panel" aria-labelledby="failure-title">
              <p className="eyebrow">FAILURE INVESTIGATION</p><h2 id="failure-title">Recorded failure evidence</h2>
              <dl className="metadata-grid">
                <div><dt>Failure stage</dt><dd>{label(job.error_stage)}</dd></div>
                <div><dt>Error code</dt><dd><code>{recorded(job.error_code)}</code></dd></div>
                <div className="wide"><dt>Recorded explanation</dt><dd>{job.error_message?.trim() ? job.error_message : 'No explanation was recorded.'}</dd></div>
                <div className="wide"><dt>Failure correlation ID</dt><dd><code>{recorded(failure?.correlation_id)}</code></dd></div>
              </dl>
              {failure ? <p><a href={`#event-${failure.sequence}`}>View failure event #{failure.sequence} and its recorded diagnostics</a></p> : <p className="evidence-warning">No failure transition event was recorded in this history. Event diagnostics and its correlation ID are unavailable.</p>}
              <p className="evidence-note">This view presents recorded evidence. It does not establish a root cause. A correlation ID identifies an event context, not a proven cause.</p>
            </section>}

            <section className="detail-panel" aria-labelledby="timeline-title">
              <div className="timeline-heading"><h2 id="timeline-title">Lifecycle timeline</h2><span>{evidence.events.length} recorded events · Sequence order</span></div>
              {!evidence.history_complete && <p className="evidence-warning" role="status">The recorded history is incomplete or does not agree with the current job record. Missing events have not been reconstructed.</p>}
              {evidence.events.length === 0 ? <p>No lifecycle events were recorded. The timeline is unavailable.</p> : <ol className="timeline" aria-label="Lifecycle timeline">
                {evidence.events.map((event) => <li key={event.id} id={`event-${event.sequence}`} data-sequence={event.sequence}>
                  <div className="event-marker" aria-hidden="true">{event.sequence}</div>
                  <div className="event-body"><div className="event-heading"><h3>{label(event.stage)}</h3><time dateTime={event.occurred_at}>{timestamp(event.occurred_at)}</time></div>
                    <p className="event-transition">{event.from_status ? label(event.from_status) : 'Initial state'} → {label(event.to_status)}</p>
                    <p>{event.message?.trim() ? event.message : 'No event message was recorded.'}</p>
                    <dl className="event-metadata"><div><dt>Actor</dt><dd>{recorded(event.actor)}</dd></div><div><dt>Correlation ID</dt><dd><code>{recorded(event.correlation_id)}</code></dd></div></dl>
                    {event.details && Object.keys(event.details).length > 0 ? <details className="diagnostics"><summary>Structured diagnostics for event {event.sequence}</summary><pre>{JSON.stringify(event.details, null, 2)}</pre></details> : <p className="missing-diagnostics">No structured diagnostic details were recorded for this event.</p>}
                  </div>
                </li>)}
              </ol>}
            </section>
            </div>
          </>}
          <footer><a href={`${homeHref}?view=implementation`}>How it works</a> · All jobs and providers are simulated. No connection to Horizon Quantum systems or real quantum hardware.</footer>
        </main>
      </div>
    </div>
  );
}
