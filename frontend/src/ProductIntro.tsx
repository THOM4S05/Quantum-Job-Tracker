import { guideHref, homeHref, isDemo } from './environment';
import { exampleHref } from './example';

export function ProductIntro({ onOverview = false }: { onOverview?: boolean }) {
  return <section className="product-intro" aria-label="About Quantum Job Tracker">
    <div className="intro-purpose">
      <span className="synthetic-label">Synthetic demo · jobs and results are simulated</span>
      <h2>Explore a quantum run</h2>
      <p>Compare compiler versions, check results, or open a job to see what happened.</p>
      <div className="intro-actions">
        <a className="intro-primary" href={exampleHref}>Open example comparison<span aria-hidden="true"> →</span></a>
        <a className="intro-secondary" href={onOverview ? homeHref : '#job-results'}>Browse jobs</a>
        {!onOverview && <a className="intro-secondary" href={`${homeHref}?view=overview`}>Open Overview</a>}
      </div>
    </div>
    <details className="intro-source">
      <summary>About this demo</summary>
      <p>A job is one recorded run of a quantum program. All runs are simulated; no compiler or quantum hardware is used.</p>
      <p className="source-note">{isDemo ? 'Browser demo: jobs and comparisons use sample records included with the app. Runs you create in the playground stay in your browser.' : 'Local application: browsing, overview, comparison and timelines read from FastAPI and PostgreSQL. Load the compiler-comparison-v1 dataset to try the example. The run-creation playground is only available in the browser demo.'} This is an independent project with no connection to Horizon Quantum systems.</p>
      <div className="intro-help-links"><a href={guideHref}>Read the demo guide</a><a href={`${homeHref}?view=implementation`}>How it works</a></div>
    </details>
  </section>;
}
