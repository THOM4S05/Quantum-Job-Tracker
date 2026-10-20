import { guideHref, homeHref, isDemo } from './environment';
import { exampleHref } from './example';

export function ProductIntro({ onOverview = false }: { onOverview?: boolean }) {
  return <section className="product-intro" aria-label="About Quantum Job Tracker">
    <div><span className="synthetic-label">Synthetic demo · jobs and results are simulated</span>
      <h2>From an observed change to the job evidence</h2>
      <p>For developers and operators investigating quantum workloads: inspect quantum-job compilation and execution, compare experiments, and investigate changes using the underlying job evidence.</p>
      <p>Experiments group related runs. Our featured example compares compiler versions; other experiments can investigate different questions.</p>
    </div>
    <div className="intro-example"><h3>One example, three minutes</h3><p>Notice lower estimated resources, then inspect candidate compilation failures. Follow a supporting job to its timeline and recorded failure evidence.</p>
      <div className="intro-actions">{!onOverview && <a className="intro-secondary" href={`${homeHref}?view=overview`}>Start with Overview</a>}<a className="intro-primary" href={exampleHref}>Explore example comparison</a><a className="intro-secondary" href={guideHref}>Demo &amp; Guide</a></div>
    </div>
    <p className="source-note">{isDemo ? 'Browser demo: browsing, overview, comparison and timeline investigation work with bundled synthetic records. Creating a personal run is a browser-only playground; it submits nothing to a backend.' : 'Local application: browsing, overview, comparison and timelines use the FastAPI API and PostgreSQL. Seed compiler-comparison-v1 to load the featured example; browser-only run creation is not a backend submission feature.'} No real compiler or hardware execution is performed.</p>
  </section>;
}
