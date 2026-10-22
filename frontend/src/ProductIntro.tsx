import { guideHref, homeHref, isDemo } from './environment';
import { exampleHref } from './example';

export function ProductIntro({ onOverview = false }: { onOverview?: boolean }) {
  return <section className="product-intro" aria-label="About Quantum Job Tracker">
    <div className="intro-purpose"><span className="synthetic-label">Synthetic demo · jobs and results are simulated</span>
      <h2>About this tracker</h2>
      <p>A job is one recorded run of a quantum program. This tracker shows its compiler and target settings, status, timings and event history.</p>
      <p className="intro-portfolio">Jobs lists individual runs. Overview summarises the selected runs. Experiment comparison groups runs with matching settings so you can compare compiler versions.</p>
      <div className="intro-actions"><div className="intro-start"><a className="intro-primary" href={exampleHref} aria-describedby="intro-example-time">Open example comparison</a><span className="intro-action-hint" id="intro-example-time">Opens the example with both compiler versions selected.</span></div><a className="intro-secondary" href={`${homeHref}?view=implementation`}>How it works</a></div>
    </div>
    <div className="intro-example"><h3>How to read the example</h3><p>The example compares the same programs under two compiler versions. Each group contains the runs for one program and configuration.</p>
      <ol className="intro-steps">
        <li><strong>Read the comparison</strong><span>Baseline is the reference version; candidate is the version being compared. Changes are candidate minus baseline.</span></li>
        <li><strong>Check the sample counts</strong><span>Each metric shows its sample count (n). Counts can differ because some runs have no recorded timing or resource estimate.</span></li>
        <li><strong>Inspect a failed job</strong><span>In compile-regression, expand the supporting jobs and open a failed candidate run. Its timeline shows where compilation stopped. Use “Back to comparison” to return.</span></li>
      </ol>
    </div>
    <div className="intro-footer"><p>All runs are simulated. This demo does not run a compiler or use quantum hardware.</p><div className="intro-help-links"><a href={guideHref}>Demo &amp; Guide</a>{!onOverview && <a href={`${homeHref}?view=overview`}>Open Overview</a>}</div>
      <details className="intro-source"><summary>About the demo data</summary><p className="source-note">{isDemo ? 'Browser demo: jobs and comparisons use sample records included with the app. Runs you create in the playground stay in your browser.' : 'Local application: browsing, overview, comparison and timelines read from FastAPI and PostgreSQL. Load the compiler-comparison-v1 dataset to try the example. The run-creation playground is only available in the browser demo.'} This is an independent project with no connection to Horizon Quantum systems.</p></details>
    </div>
  </section>;
}
