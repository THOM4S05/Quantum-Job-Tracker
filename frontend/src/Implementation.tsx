import { guideHref, homeHref } from './environment';

const repository = 'https://github.com/THOM4S05/Quantum-Job-Tracker';
const source = (path: string) => `${repository}/blob/main/${path}`;

export function Implementation() {
  return <div className="app-shell">
    <aside className="sidebar" aria-label="Workspace navigation">
      <header><span className="mark" aria-hidden="true">Q</span><span className="brand-name">Quantum Job Tracker</span></header>
      <p className="workspace-label">WORKSPACE</p>
      <a className="nav-item" href={homeHref}>▦ Jobs</a>
      <a className="nav-item" href={`${homeHref}?view=overview`}>◷ Overview</a>
      <a className="nav-item" href={`${homeHref}?view=comparison`}>⇄ Experiment comparison</a>
      <a className="nav-item" href={guideHref}>Demo &amp; Guide</a>
      <a className="nav-item active" aria-current="page" href={`${homeHref}?view=implementation`}>How it works</a>
    </aside>
    <div className="workspace"><div className="topbar"><span>Workspace / <strong>How it works</strong></span></div>
      <main className="implementation-notes">
        <div className="page-heading"><div><h1>How it works</h1><p>Data sources, request handling, persistence, and deployment.</p></div></div>
        <section className="detail-panel"><h2>Browser demo and local application</h2>
          <p>This GitHub Pages site runs React in the browser. It includes 200 generated historical samples and a read-only export of the 56-run synthetic experiment; personal runs use browser storage. It does not call a hosted Python API or PostgreSQL database.</p>
          <p>The local application uses React → HTTP/JSON → FastAPI → PostgreSQL. Start it with Docker Compose using the <a href={`${repository}#run-the-full-application-locally`}>setup instructions</a>. Its jobs, event histories and overview metrics come from database records.</p>
          <p>Open <a href={`${homeHref}?view=overview`}>Overview</a> to filter a submission cohort and inspect its rates and durations. Select a chart row to open matching jobs. Open a job to inspect its compiler metadata, failure evidence and ordered events.</p>
        </section>
        <section className="detail-panel"><h2>Implemented components</h2>
          <ul className="implementation-list">
            <li><h3>Python and FastAPI</h3><p>Pydantic models validate query filters and metadata. Synchronous route functions read database snapshots; domain functions write job state and an event in one transaction. <a href={source('backend/app/main.py')}>API entry point</a> · <a href={source('backend/app/transitions.py')}>State transitions</a></p></li>
            <li><h3>React and TypeScript</h3><p>Components render jobs, details and metrics. Applied filters are stored in the URL. Effects load data, pause polling in hidden tabs, cancel obsolete requests and retain previous results when refresh fails. <a href={source('frontend/src/App.tsx')}>Jobs and request lifecycle</a></p></li>
            <li><h3>PostgreSQL and SQL</h3><p>SQLAlchemy builds parameterised queries. Counts and rows share a repeatable-read transaction. Constraints and triggers protect state transitions and event history; JSONB stores metadata. Alembic applies schema migrations. The overview loads the selected cohort and calculates metrics in Python. <a href={source('backend/app/job_list.py')}>Queries</a> · <a href={source('backend/app/models.py')}>Schema</a></p></li>
            <li><h3>HTTP and REST API</h3><p>The local API provides read-only GET endpoints for jobs, job details, overview and health. Filters use query parameters; responses are JSON. Validation errors return 422, missing jobs 404 and database outages 503. Interactive API documentation is available at <code>http://localhost:8000/docs</code> when running locally. <a href={source('docs/architecture.md')}>Endpoint definitions</a></p></li>
            <li><h3>Async behaviour</h3><p>The browser uses async/await for requests and AbortController for cancellation. A new polling timer starts after each request finishes. FastAPI has an async application lifespan, while database routes and the SQLAlchemy/psycopg path are synchronous. There is no background job worker. <a href={source('frontend/src/api.ts')}>Request adapter</a> · <a href={source('backend/app/database.py')}>Database connection</a></p></li>
            <li><h3>Git and CI/CD</h3><p>Pushes to main and pull requests run frontend checks and Python tests against a temporary PostgreSQL service. Deployment waits for both jobs. Successful main builds publish the static demo to GitHub Pages; pull requests do not publish. Backend services run locally and are not deployed by this workflow. <a href={source('.github/workflows/pages.yml')}>Workflow</a> · <a href={`${repository}/actions`}>Run results</a></p></li>
          </ul>
        </section>
        <section className="detail-panel"><h2>Message brokers: not implemented</h2>
          <p>NATS and MQTT are not dependencies or running services in this project. Queued and running sample jobs are recorded fixtures, not messages waiting for a consumer.</p>
          <p>A broker-backed worker would require a submission endpoint, a persisted job ID, message publication, consumer processing and transactional event writes. Before implementation, define delivery and acknowledgement behaviour, idempotency for duplicate deliveries, retry limits, worker recovery and ordering. Broker delivery alone would not make database updates exactly once.</p>
          <p>See the <a href={source('docs/implementation.md')}>implementation notes</a> for code references, SQL examples and discussion questions.</p>
        </section>
      </main>
    </div>
  </div>;
}
