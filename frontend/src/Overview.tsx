import { FormEvent, useEffect, useState } from 'react';
import { request } from './api';
import { homeHref, isDemo } from './environment';
import { CohortFields, cohortQuery, readCohort } from './CohortFields';
import type { Attempts, OverviewData, Timing } from './overviewMetrics';

function RateCard({ title, metric }: { title: string; metric: Attempts }) {
  return <article className="metric-card" aria-label={title}>
    <h2>{title}</h2><p className="metric-value">{metric.rate_percent === null ? 'Not enough data' : `${metric.rate_percent.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`}</p>
    <p>{metric.succeeded} successful / {metric.completed} completed attempts</p>
    <details><summary>Excluded from denominator</summary><p>{metric.pending} pending · {metric.cancelled} cancelled or cancelling · {metric.not_started} not started · {metric.unknown} unknown</p></details>
  </article>;
}
function TimingCard({ title, metric }: { title: string; metric: Timing }) {
  return <article className="metric-card" aria-label={title}><h2>{title}</h2>
    <p className="metric-value">{metric.median_seconds === null ? 'Not enough data' : `${metric.median_seconds.toLocaleString(undefined, { maximumFractionDigits: 6 })} s`}</p>
    <p>n={metric.samples} eligible observations · {metric.excluded} excluded jobs</p>
  </article>;
}

export function Overview() {
  const [query, setQuery] = useState(() => cohortQuery(readCohort(new URLSearchParams(window.location.search))).toString());
  const [draft, setDraft] = useState(() => readCohort(new URLSearchParams(window.location.search)));
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<{ query: string; data: OverviewData | null; error: string | null; checked: string | null }>({ query, data: null, error: null, checked: null });
  useEffect(() => {
    const back = () => { const cohort = readCohort(new URLSearchParams(window.location.search)); setDraft(cohort); setQuery(cohortQuery(cohort).toString()); };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    let data: OverviewData | null = null;
    let checked: string | null = null;
    setState({ query, data: null, error: null, checked: null });
    async function load(initial = false) {
      if (!initial && document.visibilityState === 'hidden') { timer = setTimeout(() => void load(), 5000); return; }
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await request(`/api/overview${query ? `?${query}` : ''}`, { signal: controller.signal, cache: 'no-store' });
        if (response.status === 422) throw new Error('Some filters are invalid. Check the dates and selected values, or clear filters.');
        if (!response.ok) throw new Error('Overview could not be loaded. Please try again.');
        const body = await response.json() as OverviewData;
        if (!Array.isArray(body.jobs_by_target) || !Number.isInteger(body.total_jobs)) throw new Error('Unexpected response');
        if (!stopped) { data = body; checked = new Date().toISOString(); setState({ query, data, checked, error: null }); }
      } catch (error) {
        if (!stopped) setState({ query, data, checked, error: error instanceof Error ? error.message : 'Overview could not be loaded.' });
      } finally { clearTimeout(timeout); if (!stopped) timer = setTimeout(() => void load(), 5000); }
    }
    void load(true);
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [query, refresh]);
  const visible = state.query === query ? state : { data: null, error: null, checked: null };
  const data = visible.data;
  function navigate(next = draft) {
    const value = cohortQuery(next).toString();
    window.history.pushState(null, '', `${homeHref}?view=overview${value ? `&${value}` : ''}`);
    setQuery(value); setDraft(next); setRefresh((count) => count + 1);
  }
  function apply(event: FormEvent) { event.preventDefault(); navigate(); }
  function drillDown(key?: string, value?: string) {
    const params = new URLSearchParams(query);
    if (key && value) params.set(key, value);
    if (key === 'failure_stage') params.set('status', 'failed');
    return `${homeHref}${params.size ? `?${params}` : ''}`;
  }
  function chart(title: string, rows: { key: string; count: number }[], filter: string) {
    const max = Math.max(1, ...rows.map((row) => row.count));
    return <section className="breakdown-panel" aria-label={title}><h2>{title}</h2><p>Jobs · select a row to inspect the cohort</p>
      <ul>{rows.map((row) => <li key={row.key}><a href={drillDown(filter, row.key)}><span>{filter === 'failure_stage' ? row.key.replace(/^./, (letter) => letter.toUpperCase()) : row.key}</span><strong>{row.count} {row.count === 1 ? 'job' : 'jobs'}</strong><span className="chart-track" aria-hidden="true"><span style={{ width: `${100 * row.count / max}%` }} /></span></a></li>)}</ul>
    </section>;
  }
  return <div className="app-shell">
    <aside className="sidebar" aria-label="Workspace navigation"><header><span className="mark" aria-hidden="true">Q</span><span className="brand-name">Quantum Job Tracker</span></header>
      <p className="workspace-label">WORKSPACE</p><a className="nav-item" href={drillDown()}>▦ Jobs</a><a className="nav-item active" aria-current="page" href={`${homeHref}?view=overview&${query}`}>◷ Overview</a>
      <div className="sidebar-note"><strong>Synthetic environment</strong><p>Recorded job evidence, never real hardware telemetry.</p></div>
    </aside>
    <div className="workspace"><div className="topbar"><span>Workspace / <strong>Overview</strong></span><span className="environment-badge">Synthetic data</span></div><main>
      <div className="page-heading"><div><h1>Operational overview</h1><p>Recorded outcomes and timings for synthetic jobs.</p></div></div>
      <p className="cohort-note">Dates select a cohort by <strong>job submission time (UTC)</strong>. Later lifecycle activity still contributes. {isDemo ? 'Source: browser demo records.' : 'Source: PostgreSQL job records.'}</p>
      <form className="job-filters overview-filters" aria-label="Overview filters" onSubmit={apply}><CohortFields value={draft} options={data} onChange={(key, value) => setDraft((previous) => ({ ...previous, [key]: value }))} />
        <div className="filter-actions"><button type="submit" className="primary">Apply filters</button><button type="button" onClick={() => navigate(readCohort(new URLSearchParams()))}>Clear filters</button></div>
      </form>
      {!data && !visible.error && <p role="status">Loading overview…</p>}
      {visible.error && <div className="error-state" role="alert"><div><strong>{data ? 'Showing stale overview' : 'Unable to show overview'}</strong><p>{visible.error}</p></div><button onClick={() => setRefresh((count) => count + 1)}>Try again</button></div>}
      {data && <>
        <div className="overview-summary"><p><strong>{data.total_jobs} jobs</strong> in cohort · {data.cancelled_jobs} cancelled · {data.cancelling_jobs} cancellation requested</p><a href={drillDown()}>Inspect cohort jobs →</a></div>
        {data.total_jobs === 0 && <p className="evidence-warning">No jobs match this submission cohort. Try widening the dates or clearing filters.</p>}
        <div className="metric-grid"><RateCard title="Compilation success rate" metric={data.compilation} /><RateCard title="Execution success rate" metric={data.execution} /><TimingCard title="Median queue time" metric={data.queue_time} /><TimingCard title="Median execution duration" metric={data.execution_duration} /></div>
        <details className="metric-definitions">
          <summary>Metric definitions and exclusions</summary>
          <ul>
            <li><strong>Compilation rate:</strong> recorded successful compilations / completed compilation attempts. A failed job is a compilation failure only when its recorded failure stage is compilation.</li>
            <li><strong>Execution rate:</strong> successful / completed execution attempts, including explicit execution failures.</li>
            <li><strong>Rate exclusions:</strong> pending and cancelled/cancelling jobs are excluded from both rate denominators; not-started and unknown outcomes are also excluded.</li>
            <li><strong>Queue time:</strong> queue entry to execution start for jobs with both timestamps, including running or subsequently cancelled jobs.</li>
            <li><strong>Execution duration:</strong> execution start to end for completed successful or failed execution attempts. Missing endpoints are excluded.</li>
            <li><strong>Units and missing data:</strong> all timing units are seconds. No eligible observations means “Not enough data”.</li>
          </ul>
        </details>
        <div className="breakdown-grid">{chart('Failures by stage', data.failures_by_stage, 'failure_stage')}{chart('Jobs by target', data.jobs_by_target, 'target')}</div>
      </>}
      {visible.checked && <p className="detail-refresh">Updated {new Date(visible.checked).toLocaleTimeString()} · Polls every 5s while visible</p>}
      <footer><a href={`${homeHref}?view=implementation`}>How it works</a> · All jobs, compiler data, providers and timings are synthetic. No connection to Horizon Quantum or real quantum hardware.</footer>
    </main></div>
  </div>;
}
