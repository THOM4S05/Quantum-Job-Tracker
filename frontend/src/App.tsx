import { FormEvent, useEffect, useState } from 'react';
import { JobDetails } from './JobDetails';
import { request } from './api';
import { homeHref, isDemo, jobHref } from './environment';
import { lazy, Suspense } from 'react';
const Playground = lazy(() => import('./Playground').then((module) => ({ default: module.Playground })));

const statuses = ['queued', 'running', 'cancel_requested', 'succeeded', 'failed', 'cancelled'] as const;
type Status = typeof statuses[number];
const statusLabel = (status: string) => status.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());

export type Job = {
  id: string; name: string; provider: string; target: string;
  external_reference: string | null; status: Status; created_at: string;
  requested_by: string; retry_of: string | null;
};
export type JobPage = {
  items: Job[]; total: number; page: number; page_size: number;
  total_pages: number; providers: string[];
};
type Filters = {
  q: string; status: string; provider: string; submitted_from: string;
  submitted_to: string; page: string; page_size: string;
};
type Result = { query: string; data: JobPage | null; loading: boolean; error: string | null; checked: string | null };

function readFilters(query: string): Filters {
  const params = new URLSearchParams(query);
  return { q: params.get('q') ?? '', status: params.get('status') ?? '',
    provider: params.get('provider') ?? '', submitted_from: params.get('submitted_from') ?? '',
    submitted_to: params.get('submitted_to') ?? '', page: params.get('page') ?? '1',
    page_size: params.get('page_size') ?? '25' };
}

function encodeFilters(filters: Filters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    const trimmed = value.trim();
    if (trimmed && !(key === 'page' && trimmed === '1') && !(key === 'page_size' && trimmed === '25')) params.set(key, trimmed);
  }
  return params.toString();
}

function useJobs(query: string, refresh: number) {
  const [result, setResult] = useState<Result>({ query, data: null, loading: true, error: null, checked: null });
  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    let data: JobPage | null = null;
    let checked: string | null = null;
    setResult({ query, data, loading: true, error: null, checked });
    async function load(initial = false) {
      if (document.visibilityState === 'hidden' && !initial) {
        timer = setTimeout(() => void load(), 5000);
        return;
      }
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await request(`/api/jobs${query ? `?${query}` : ''}`, { signal: controller.signal, cache: 'no-store' });
        if (response.status === 422) throw new Error('Some filters are invalid. Check your filters or clear them to start again.');
        if (!response.ok) throw new Error('Jobs could not be loaded. Please try again.');
        const body = await response.json() as JobPage;
        if (!Array.isArray(body.items) || !Array.isArray(body.providers) || !Number.isInteger(body.total)) throw new Error('Unexpected response');
        if (!stopped) {
          data = body;
          checked = new Date().toISOString();
          setResult({ query, data, loading: false, error: null, checked });
        }
      } catch (error) {
        if (!stopped) setResult({ query, data, loading: false,
          error: error instanceof Error && error.message.startsWith('Some filters') ? error.message : 'Jobs could not be loaded. Please try again.', checked });
      } finally {
        clearTimeout(timeout);
        if (!stopped) timer = setTimeout(() => void load(), 5000);
      }
    }
    void load(true);
    return () => { stopped = true; clearTimeout(timer); controller?.abort(); };
  }, [query, refresh]);
  return result.query === query ? result : { query, data: null, loading: true, error: null, checked: null };
}

function utcTime(value: string) {
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value));
}

function JobsList() {
  const [query, setQuery] = useState(() => window.location.search.slice(1));
  const [draft, setDraft] = useState(() => readFilters(query));
  const [refresh, setRefresh] = useState(0);
  const result = useJobs(query, refresh);
  const current = readFilters(query);
  const { data } = result;

  useEffect(() => {
    const onBack = () => { const next = window.location.search.slice(1); setQuery(next); setDraft(readFilters(next)); };
    window.addEventListener('popstate', onBack);
    return () => window.removeEventListener('popstate', onBack);
  }, []);

  function navigate(filters: Filters) {
    const next = encodeFilters(filters);
    if (next !== query) {
      window.history.pushState(null, '', `${window.location.pathname}${next ? `?${next}` : ''}${window.location.hash}`);
      setQuery(next);
    } else setRefresh((value) => value + 1);
    setDraft(readFilters(next));
  }
  function apply(event: FormEvent) { event.preventDefault(); navigate({ ...draft, page: '1' }); }
  function clear() { navigate({ q: '', status: '', provider: '', submitted_from: '', submitted_to: '', page: '1', page_size: '25' }); }
  function field(key: keyof Filters, value: string) { setDraft((previous) => ({ ...previous, [key]: value })); }

  const providers = [...new Set([...(data?.providers ?? []), ...(draft.provider ? [draft.provider] : [])])].sort();
  const first = data && data.items.length ? (data.page - 1) * data.page_size + 1 : 0;
  const last = data && data.items.length ? first + data.items.length - 1 : 0;

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Workspace navigation">
        <header><span className="mark" aria-hidden="true">Q</span><span className="brand-name">Quantum Job Tracker</span></header>
        <p className="workspace-label">WORKSPACE</p>
        <a className="nav-item active" href={homeHref} aria-current="page"><span aria-hidden="true">▦</span> Jobs</a>
        <div className="sidebar-note"><span className="sidebar-note-icon" aria-hidden="true">◇</span><strong>Synthetic environment</strong><p>Investigate fictional jobs and their outcomes.</p></div>
        <div className="sidebar-bottom"><span className="brand-footer">Quantum Job Tracker</span><span>{isDemo ? 'Browser playground' : 'Local workspace'}</span></div>
      </aside>
      <div className="workspace">
        <div className="topbar"><span>Workspace <span className="breadcrumb-divider">/</span> <strong>Jobs</strong></span><span className="environment-badge">Synthetic environment</span></div>
        <main>
          <div className="page-heading"><div><h1>Jobs</h1><p>Search and inspect your synthetic quantum runs.</p></div><span className="version-badge">{isDemo ? 'Interactive playground' : 'Read-only workspace'}</span></div>
          {isDemo && <Suspense fallback={<p>Loading playground…</p>}><Playground onReset={clear} /></Suspense>}
          <form className="job-filters" onSubmit={apply} aria-label="Job filters">
            <label className="search-field">Job ID or external reference<input type="search" value={draft.q} onChange={(e) => field('q', e.target.value)} maxLength={160} placeholder="e.g. SYN-0005" aria-describedby="search-help" /></label>
            <label>Status<select value={draft.status} onChange={(e) => field('status', e.target.value)}><option value="">All statuses</option>{statuses.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}{draft.status && !statuses.includes(draft.status as Status) && <option value={draft.status}>{draft.status} (invalid)</option>}</select></label>
            <label>Provider<select value={draft.provider} onChange={(e) => field('provider', e.target.value)}><option value="">All providers</option>{providers.map((provider) => <option key={provider}>{provider}</option>)}</select></label>
            <label>Submitted from (UTC)<input type="date" value={draft.submitted_from} onChange={(e) => field('submitted_from', e.target.value)} max={draft.submitted_to || '9999-12-30'} /></label>
            <label>Submitted through (UTC)<input type="date" value={draft.submitted_to} onChange={(e) => field('submitted_to', e.target.value)} min={draft.submitted_from} max="9999-12-30" /></label>
            <label>Rows per page<select value={draft.page_size} onChange={(e) => field('page_size', e.target.value)}>{[...new Set(['10', '25', '50', '100', draft.page_size])].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
            <div className="filter-actions"><button type="submit" className="primary">Apply filters</button><button type="button" onClick={clear}>Clear filters</button></div>
            <p id="search-help" className="filter-help">Exact ID or reference · References ignore case · Dates include the whole UTC day</p>
          </form>

          <section className="jobs-panel" aria-label="Job results" aria-busy={result.loading}>
            <div className="results-heading"><h2>{data ? `${data.total.toLocaleString()} ${data.total === 1 ? 'job' : 'jobs'}` : 'Job results'}</h2><span>{result.checked ? `Updated ${new Date(result.checked).toLocaleTimeString([], { timeZoneName: 'short' })} · Refreshes every 5s` : isDemo ? 'Browser demo data' : 'Live PostgreSQL data'}</span></div>
            {result.loading && <div className="result-state" role="status"><span className="spinner" aria-hidden="true" />Loading jobs…</div>}
            {result.error && <div className="error-state" role="alert"><div><strong>{data ? 'Showing previously loaded results' : 'Unable to show jobs'}</strong><p>{result.error}</p></div><button type="button" onClick={() => setRefresh((value) => value + 1)}>Try again</button></div>}
            {data && data.items.length === 0 && <div className="result-state"><h3>{data.total > 0 ? 'This page has no jobs' : 'No jobs found'}</h3><p>{data.total > 0 ? 'The requested page is beyond the available results.' : 'Try a different reference or a wider set of filters.'}</p>{data.total > 0 ? <button onClick={() => navigate({ ...current, page: '1' })}>Go to first page</button> : <button onClick={clear}>Clear filters</button>}</div>}
            {data && data.items.length > 0 && <div className="table-scroll"><table>
              <caption className="sr-only">Synthetic jobs, newest submissions first. All submission times are UTC.</caption>
              <thead><tr><th scope="col">Job</th><th scope="col">Provider / target</th><th scope="col">Status</th><th scope="col">Submitted (UTC)</th><th scope="col">Requested by</th></tr></thead>
              <tbody>{data.items.map((job) => <tr key={job.id}>
                <td><strong><a className="job-link" href={jobHref(job.id, query)}>{job.name}</a></strong><span className="external-ref">{job.external_reference ?? 'No external reference'}</span><code>{job.id}</code>{job.retry_of && <span className="external-ref">Retry of {job.retry_of}</span>}</td>
                <td>{job.provider}<span className="cell-secondary">{job.target}</span></td>
                <td><span className={`status-badge status-${job.status}`}>{statusLabel(job.status)}</span></td>
                <td className="nowrap"><time dateTime={job.created_at}>{utcTime(job.created_at)}</time></td>
                <td>{job.requested_by}</td>
              </tr>)}</tbody>
            </table></div>}
            {data && <nav className="pagination" aria-label="Job pages"><span>{first}–{last} of {data.total} jobs</span><div><button disabled={data.page <= 1} onClick={() => navigate({ ...current, page: String(data.page - 1) })}>Previous</button><span>Page {data.page} of {Math.max(1, data.total_pages)}</span><button disabled={data.page >= data.total_pages} onClick={() => navigate({ ...current, page: String(data.page + 1) })}>Next</button></div></nav>}
          </section>
          <footer>All jobs and providers are simulated. No connection to Horizon Quantum systems or real quantum hardware.</footer>
        </main>
      </div>
    </div>
  );
}

export function App() {
  if (isDemo) {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('job');
    params.delete('job');
    return id ? <JobDetails jobId={id} backHref={`${homeHref}?${params}`} /> : <JobsList />;
  }
  const detail = window.location.pathname.match(/^\/jobs\/([^/]+)\/?$/);
  return detail ? <JobDetails jobId={detail[1]} backHref={`/${window.location.search}`} /> : <JobsList />;
}
