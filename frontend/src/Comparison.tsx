import { FormEvent, useEffect, useState } from 'react';
import { example, exampleHref } from './example';
import { request } from './api';
import { ComparisonChanges, TimingEvidence } from './ComparisonChanges';
import { formatNumber as number, formatChange as change } from './comparisonFormatting';
import { homeHref, isDemo, jobHref } from './environment';
import type { Attempts } from './overviewMetrics';

type Choice = { experiment: string; baseline: string; candidate: string };
type Observation = { value: number | null; samples: number; job_ids?: string[] };
export type Metric = { key: string; label: string; unit: string; delta_unit: string; baseline: Observation; candidate: Observation; absolute_change: number | null; percentage_change: number | null };
type Side = { runs: number; compilation: Attempts; execution: Attempts; jobs: { id: string; name: string; status: string }[] };
export type ComparisonData = { synthetic: boolean; selection_required: boolean; experiment_jobs: number; selected_jobs: number; excluded_version_jobs: number; matched_groups: number; experiments: { id: string; name: string }[]; compiler_versions: string[];
  rows: { workload: string; status: string; configuration: Record<string, unknown>; differences: string[]; missing_fields: string[]; baseline: Side; candidate: Side; metrics: Metric[] }[] };
const read = (): Choice => { const params = new URLSearchParams(window.location.search); return { experiment: params.get('experiment') ?? '', baseline: params.get('baseline') ?? '', candidate: params.get('candidate') ?? '' }; };
const encode = (choice: Choice) => new URLSearchParams(Object.entries(choice).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])).toString();

function Outcomes({ name, side }: { name: string; side: Side }) {
  return <div><h3>{name}: {side.runs} runs</h3>{(['compilation', 'execution'] as const).map((phase) => {
    const metric = side[phase];
    return <p key={phase}><strong>{phase === 'compilation' ? 'Compilation' : 'Execution'}:</strong> {metric.succeeded} succeeded, {metric.failed} failed / {metric.completed} completed.<br />Excluded: {metric.pending} pending, {metric.cancelled} cancelled or cancelling, {metric.not_started} not started, {metric.unknown} unknown.</p>;
  })}</div>;
}

export function Comparison() {
  const [choice, setChoice] = useState(read);
  const [draft, setDraft] = useState(read);
  const [refresh, setRefresh] = useState(0);
  const query = encode(choice);
  const [state, setState] = useState<{ query: string; data: ComparisonData | null; error: string | null; checked: string | null }>({ query, data: null, error: null, checked: null });
  useEffect(() => {
    const back = () => { setChoice(read()); setDraft(read()); };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    let data: ComparisonData | null = null;
    let checked: string | null = null;
    setState({ query, data, error: null, checked });
    async function load(initial = false) {
      if (!initial && document.visibilityState === 'hidden') { timer = setTimeout(() => void load(), 5000); return; }
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await request(`/api/comparisons${query ? `?${query}` : ''}`, { signal: controller.signal, cache: 'no-store' });
        if (response.status === 422) throw new Error('Choose an experiment and two different compiler versions. Check the comparison URL for invalid values.');
        if (!response.ok) throw new Error('Comparison could not be loaded. Please try again.');
        const body = await response.json() as ComparisonData;
        if (!Array.isArray(body.rows) || !Array.isArray(body.experiments) || !Array.isArray(body.compiler_versions)) throw new Error('Unexpected comparison response.');
        if (!stopped) { data = body; checked = new Date().toISOString(); setState({ query, data, checked, error: null }); }
      } catch (error) {
        if (!stopped) setState({ query, data, checked, error: error instanceof Error ? error.message : 'Comparison could not be loaded.' });
      } finally { clearTimeout(timeout); if (!stopped) timer = setTimeout(() => void load(), 5000); }
    }
    void load(true);
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [query, refresh]);
  const visible = state.query === query ? state : { data: null, error: null, checked: null };
  const data = visible.data;
  function navigate(next: Choice) { window.history.pushState(null, '', `${homeHref}?view=comparison${encode(next) ? `&${encode(next)}` : ''}`); setChoice(next); setDraft(next); if (encode(next) === query) setRefresh((value) => value + 1); }
  function apply(event: FormEvent) { event.preventDefault(); navigate(draft); }
  const versions = [...new Set([...(data?.compiler_versions ?? []), draft.baseline, draft.candidate].filter(Boolean))].sort();
  const returnQuery = `view=comparison&${query}`;
  return <div className="app-shell">
    <aside className="sidebar" aria-label="Workspace navigation"><header><span className="mark" aria-hidden="true">Q</span><span className="brand-name">Quantum Job Tracker</span></header>
      <p className="workspace-label">WORKSPACE</p><a className="nav-item" href={homeHref}>▦ Jobs</a><a className="nav-item" href={`${homeHref}?view=overview`}>◷ Overview</a><a className="nav-item active" aria-current="page" href={`${homeHref}?${returnQuery}`}>⇄ Experiment comparison</a>
      <div className="sidebar-note"><strong>Synthetic experiment evidence</strong><p>Descriptive comparisons of recorded runs.</p></div>
    </aside>
    <div className="workspace"><div className="topbar"><span>Workspace / <strong>Comparison</strong></span><span className="environment-badge">Synthetic data</span></div><main>
      <div className="page-heading"><div><h1>Experiment comparison</h1><p>Featured example: what changed for this workload under the candidate compiler?</p></div></div>
      <p className="cohort-note">Source: {isDemo ? 'bundled snapshot of the synthetic seed (not a live API)' : 'PostgreSQL experiment jobs'}. All results are synthetic. Queue time can be affected by operational conditions, scheduling and provider load. These comparisons do not establish real compiler performance. Highlights describe synthetic samples, not confirmed regressions or proof that a compiler change caused a difference.</p>
      <form className="job-filters comparison-filters" onSubmit={apply} aria-label="Comparison choices">
        <label>Experiment<select aria-label="Experiment" required value={draft.experiment} onChange={(e) => navigate({ experiment: e.target.value, baseline: '', candidate: '' })}><option value="">Choose an experiment</option>{data?.experiments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}{draft.experiment && !data?.experiments.some((item) => item.id === draft.experiment) && <option value={draft.experiment}>{draft.experiment}</option>}</select></label>
        {(['baseline', 'candidate'] as const).map((side) => <label key={side}>{side === 'baseline' ? 'Baseline compiler version' : 'Candidate compiler version'}<select aria-label={side === 'baseline' ? 'Baseline compiler version' : 'Candidate compiler version'} required value={draft[side]} disabled={!draft.experiment} onChange={(e) => setDraft((value) => ({ ...value, [side]: e.target.value }))}><option value="">Choose a version</option>{versions.map((version) => <option key={version}>{version}</option>)}</select></label>)}
        <div className="filter-actions"><button className="primary" type="submit" disabled={!draft.experiment}>Compare versions</button><button type="button" onClick={() => navigate({ experiment: '', baseline: '', candidate: '' })}>Clear choices</button></div>
      </form>
      {!data && !visible.error && <p role="status">Loading comparison…</p>}
      {visible.error && <div role="alert" className="error-state"><div><strong>{data ? 'Showing stale comparison' : 'Unable to compare'}</strong><p>{visible.error}</p></div><button onClick={() => setRefresh((value) => value + 1)}>Try again</button></div>}
      {data && data.experiments.length === 0 && <p className="evidence-warning">No named experiments are recorded in this data source. In the local application, run python -m app.seed --dataset compiler-comparison-v1 after migrations, then retry. No example results are substituted for missing data.</p>}
      {data?.selection_required && <p><a className="example-inline-link" href={exampleHref}>Explore example comparison</a> — compiler-version comparison is one way to investigate an experiment.</p>}
      {data && !data.selection_required && data.rows.length > 0 && choice.experiment === example.id && choice.baseline === example.baseline && choice.candidate === example.candidate && <section className="example-guide" aria-label="What to notice in the example"><h2>What to notice</h2><ol><li><strong>One improvement:</strong> in resource-gain, compare estimated depth and gate count. These describe the compiled circuit estimate, not measured hardware usage.</li><li><strong>One change to investigate:</strong> in compile-regression, the featured candidate has recorded compilation failures. Expand its supporting jobs to inspect a timeline, failure stage, explanation and correlation ID. Missing execution timings mean it never executed.</li><li>Use <strong>Back to comparison</strong> to return to these exact selections. Also inspect execution-slowdown to see timing observations. These constructed samples are not real compiler benchmarks or proof of causation.</li></ol><p>Baseline and candidate are the selections above; reversing them reverses the comparison direction. Success rates use completed attempts, and observations show their sample counts.</p></section>}
      {data?.selection_required && <p>Choose an experiment, then a baseline and a different candidate compiler version.</p>}
      {data && !data.selection_required && <>
        <p className="comparison-summary">{data.selected_jobs} selected runs · {data.matched_groups} matched configuration groups · {data.excluded_version_jobs} runs with other or missing compiler versions excluded.</p>
        {data.rows.length === 0 && <p>No runs match these experiment and compiler choices.</p>}
        <details className="metric-definitions"><summary>Matching, samples and delta rules</summary><ul><li>Groups require the same program revision, input configuration, target, provider, shots, compiler name and recorded settings. Other differences are flagged. Missing identity means no comparison.</li><li>Success-rate deltas are percentage points (pp). Other deltas are candidate minus baseline; relative change is unavailable for zero baselines, missing data and unmatched groups.</li><li>Timing samples are separate from outcome denominators. Compilation and execution medians include completed failures with recorded endpoints. Queue samples include any job that started execution. Pending and cancelled attempts are excluded from rates.</li><li>Resource medians describe available estimates across all runs, not observed results. Sample count n is shown for every value. Unequal samples are visible, not evidence of significance.</li></ul></details>
        {data.rows.map((row, index) => <section className="comparison-panel" key={`${row.workload}:${index}`} aria-label={`${row.workload} comparison ${index + 1}`}>
          <div className="comparison-heading"><h2>{row.workload}</h2><span className={`comparison-status ${row.status === 'matched' ? 'matched' : ''}`}>{row.status.replaceAll('_', ' ')}</span></div>
          {row.differences.length > 0 && <p className="evidence-warning">Other configurations differ in this workload: {row.differences.join(', ')}. Only exact subgroups are matched.</p>}
          {row.missing_fields.length > 0 && <p className="evidence-warning">Unverifiable fields: {row.missing_fields.join(', ')}. No deltas calculated.</p>}
          {row.status !== 'matched' && row.status !== 'unverifiable' && <p className="evidence-warning">Unmatched configuration: no {row.status === 'baseline_only' ? 'candidate' : 'baseline'} runs. No deltas calculated.</p>}
          <ComparisonChanges row={row} returnQuery={returnQuery} />
          <details className="diagnostics"><summary>Matching configuration</summary><pre>{JSON.stringify(row.configuration, null, 2)}</pre></details>
          <div className="comparison-outcomes"><Outcomes name="Baseline" side={row.baseline} /><Outcomes name="Candidate" side={row.candidate} /></div>
          <div className="table-scroll"><table><caption className="sr-only">{row.workload}: baseline, candidate and changes; observations n shown independently</caption><thead><tr><th>Metric</th><th>Baseline<br /><small>{choice.baseline}</small></th><th>Candidate<br /><small>{choice.candidate}</small></th><th>Absolute change</th><th>Relative change</th></tr></thead><tbody>{row.metrics.map((metric) => <tr key={metric.key}><th scope="row">{metric.label}</th>{(['baseline', 'candidate'] as const).map((side) => <td key={side}>{metric[side].value === null ? 'Not enough data' : `${number(metric[side].value)} ${metric.unit}`}<span className="cell-secondary">n={metric[side].samples}</span></td>)}<td>{row.status === 'matched' && ['compilation_duration', 'queue_time', 'execution_duration'].includes(metric.key) && (!metric.baseline.samples || !metric.candidate.samples || metric.baseline.value === null || metric.candidate.value === null) ? 'Insufficient data to compare' : change(metric.absolute_change, metric.delta_unit)}</td><td>{change(metric.percentage_change, '%')}</td></tr>)}</tbody></table></div>
          <TimingEvidence row={row} returnQuery={returnQuery} />
          <div className="comparison-outcomes">{(['baseline', 'candidate'] as const).map((side) => <details className="diagnostics" key={side}><summary>{side === 'baseline' ? 'Baseline' : 'Candidate'} jobs ({row[side].runs})</summary>{row[side].jobs.length === 0 ? <p>No runs recorded.</p> : <ul>{row[side].jobs.map((job) => <li key={job.id}><a href={jobHref(job.id, returnQuery)}>{job.name}</a> · {job.status.replaceAll('_', ' ')}</li>)}</ul>}</details>)}</div>
        </section>)}
      </>}
      {visible.checked && <p className="detail-refresh">Updated {new Date(visible.checked).toLocaleTimeString()} · Polls every 5s while visible</p>}
      <footer>All jobs, compiler data, providers and results are synthetic. No connection to Horizon Quantum systems or real hardware.</footer>
    </main></div>
  </div>;
}
