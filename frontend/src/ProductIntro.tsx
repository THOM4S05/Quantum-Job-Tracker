import { guideHref, homeHref, isDemo } from './environment';
import { exampleHref } from './example';

export function ProductIntro() {
  return <section className="workspace-intro" aria-label="About Quantum Job Tracker">
    <div><h2>New to the workspace?</h2><p>Start with the recorded outcomes below, then open a group of jobs to investigate.</p></div>
    <a href={exampleHref}>Open example comparison <span aria-hidden="true">↗</span></a>
    <details>
      <summary>About this demo</summary>
      <p>A job is one recorded run of a quantum program. All runs are simulated; no compiler or quantum hardware is used.</p>
      <p>Job investigation and outcome monitoring are available. Job cancellation, retry controls, engineering ticket integration and infrastructure alerts are not implemented yet.</p>
      <p className="source-note">{isDemo ? 'Browser demo: jobs and comparisons use sample records included with the app. Runs you create in the playground stay in your browser.' : 'Local application: browsing, overview, comparison and timelines read from FastAPI and PostgreSQL. Load the compiler-comparison-v1 dataset to try the example. The run-creation playground is only available in the browser demo.'} This is an independent project with no connection to Horizon Quantum systems.</p>
      <div className="intro-help-links"><a href={guideHref}>Read the demo guide</a><a href={`${homeHref}?view=implementation`}>How it works</a></div>
    </details>
  </section>;
}
