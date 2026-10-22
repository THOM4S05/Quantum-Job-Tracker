import { useEffect, useState } from 'react';
import { request } from './api';
import { example, exampleHref, exampleQuery } from './example';
import { guideHref, homeHref, isDemo, jobHref } from './environment';
import type { ComparisonData } from './Comparison';
import type { JobEvidence } from './JobDetails';

type ExampleState = { status: 'loading' | 'ready' | 'empty' | 'error'; job: { id: string; name: string } | null; note: string | null };

export function Guide() {
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<ExampleState>({ status: 'loading', job: null, note: null });
  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    const timeout = setTimeout(() => controller.abort(), 8000);
    setState({ status: 'loading', job: null, note: null });
    async function checkExample() {
      try {
        const params = new URLSearchParams(exampleQuery);
        params.delete('view');
        const response = await request(`/api/comparisons?${params}`, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error('Example records could not be checked.');
        const data = await response.json() as ComparisonData;
        if (!Array.isArray(data.rows)) throw new Error('Unexpected example response.');
        if (!data.rows.some((row) => row.status === 'matched')) {
          if (!stopped) setState({ status: 'empty', job: null, note: null });
          return;
        }
        const group = data.rows.find((row) => row.workload === 'compile-regression' && row.status === 'matched' && row.candidate.compilation.failed > 0);
        const candidate = group?.candidate.jobs.find((job) => job.status === 'failed');
        let job: ExampleState['job'] = null;
        if (candidate) {
          try {
            const details = await request(`/api/jobs/${encodeURIComponent(candidate.id)}`, { signal: controller.signal, cache: 'no-store' });
            if (details.ok) {
              const evidence = await details.json() as JobEvidence;
              const experiment = evidence.job.specification.experiment as { id?: string } | null;
              if (evidence.job.id === candidate.id && evidence.job.status === 'failed' && evidence.job.error_stage === 'compilation' &&
                  evidence.job.metadata?.compiler_version === example.candidate && experiment?.id === example.id) job = { id: candidate.id, name: evidence.job.name };
            }
          } catch { /* Keep the comparison available when its supporting record cannot be loaded. */ }
        }
        if (!stopped) setState({ status: 'ready', job, note: job ? null : 'The comparison is available, but a supporting compilation-failure job could not be verified. Open the comparison to inspect the available runs, or check again.' });
      } catch {
        if (!stopped) setState({ status: 'error', job: null, note: null });
      } finally { clearTimeout(timeout); }
    }
    void checkExample();
    return () => { stopped = true; clearTimeout(timeout); controller.abort(); };
  }, [refresh]);
  const supportingHref = state.job ? jobHref(state.job.id, exampleQuery) : null;
  const glossary = [
    ['Job and workload', 'A workload is a program with its input configuration. A job is one recorded run of that workload under a particular compiler and target configuration.'],
    ['Experiment', 'A named group of related runs used to investigate a question. The featured example compares compiler versions; experiments are not limited to that question.'],
    ['Compilation and execution', 'Compilation translates a program into a form suitable for its target. Execution is the later attempt to run it. Here, both stages and their outcomes are synthetic records.'],
    ['Compiler version', 'The recorded release of the software translating the program. The example holds other relevant settings fixed while changing this version.'],
    ['Target', 'The recorded destination or simulator configuration for a run. Targets in this app are fictional, not connected hardware.'],
    ['Shots', 'The requested number of repeated samples for a run. A requested shot count does not mean those samples were actually produced.'],
    ['Estimated qubits, circuit depth and gate count', 'Logical qubits estimate the circuit’s quantum working space. Depth estimates the number of sequential operation layers. Gate count estimates the number of circuit operations. These are compiler estimates, not measured hardware use.'],
    ['Queue time and runtime', 'Queue time describes waiting before execution starts. Runtime is execution start to finish. Durations need both recorded endpoints; queue time can also reflect operational conditions.'],
    ['Baseline and candidate', 'Baseline is the reference compiler version; candidate is the version being compared with it. Changes are candidate minus baseline. Swapping them reverses the comparison.'],
    ['Success rate, median and n', 'A success rate uses completed eligible attempts. A median is the middle timing or estimate among contributing observations. The displayed n is the sample count; it may be smaller than the number of jobs.'],
    ['Correlation ID', 'A recorded identifier that helps connect an event with its diagnostic context. It does not establish a root cause.'],
  ];
  return <div className="app-shell">
    <aside className="sidebar" aria-label="Workspace navigation"><header><span className="mark" aria-hidden="true">Q</span><span className="brand-name">Quantum Job Tracker</span></header>
      <p className="workspace-label">WORKSPACE</p><a className="nav-item" href={homeHref}>▦ Jobs</a><a className="nav-item" href={`${homeHref}?view=overview`}>◷ Overview</a><a className="nav-item" href={`${homeHref}?view=comparison`}>⇄ Experiment comparison</a><a className="nav-item active" aria-current="page" href={guideHref}>Demo &amp; Guide</a><a className="nav-item" href={`${homeHref}?view=implementation`}>How it works</a>
    </aside>
    <div className="workspace"><div className="topbar"><span>Workspace / <strong>Demo &amp; Guide</strong></span><span className="environment-badge">Synthetic data</span></div>
      <main className="demo-guide">
        <div className="page-heading"><div><h1>Demo &amp; Guide</h1><p>A practical tour. No quantum-computing background required.</p></div></div>
        <nav className="guide-contents" aria-label="Guide sections"><a href="#guide-purpose">Purpose</a><a href="#guide-start">Quick start</a><a href="#guide-sections">Page guide</a><a href="#guide-glossary">Glossary</a><a href="#guide-interpretation">Interpreting results</a></nav>
        <section className="detail-panel" id="guide-purpose" aria-labelledby="guide-purpose-title"><span className="synthetic-label">Independent portfolio project · synthetic jobs and results</span><h2 id="guide-purpose-title">What this app is for</h2>
          <p>Quantum Job Tracker helps developers, operators and anyone reviewing an engineering workflow inspect quantum-job compilation and execution, compare experiments, and investigate failures or changes using recorded job evidence.</p>
          <p><strong>For example:</strong> You want to see whether a different compiler version changes a workload’s resource estimates, runtime, or likelihood of completing successfully.</p>
          <p>This demonstration uses synthetic data. It is an independent portfolio project, with no connection to Horizon Quantum systems, real compiler services or quantum hardware.</p>
          <p>{isDemo ? 'This browser demo reads bundled synthetic records and a read-only export of the seeded experiment. Browsing, comparison and evidence links work without a live API.' : 'This local application reads jobs through FastAPI and PostgreSQL. The featured example requires the existing compiler-comparison-v1 seed; browser snapshots are not substituted for missing database records.'}</p>
        </section>
        <section className="detail-panel" id="guide-start" aria-labelledby="guide-start-title"><h2 id="guide-start-title">Quick start: follow one example</h2>
          <p>The featured direction is {example.baseline} → {example.candidate}. The steps below use the existing synthetic experiment and its recorded runs.</p>
          <div className="guide-example-status" aria-live="polite">
            {state.status === 'loading' && <p role="status">Checking example links… The rest of this guide is ready to read.</p>}
            {state.status === 'empty' && <p>The featured example is not available in this data source. You can still use Overview and Jobs. In the local application, load the example using the README’s seed instructions, then check again.</p>}
            {state.status === 'error' && <p role="alert">Example records could not be checked. The guide and general page links remain available. Retry to resolve the example links.</p>}
            {state.note && <p>{state.note}</p>}
            {(state.status === 'empty' || state.status === 'error' || state.note) && <button onClick={() => setRefresh((value) => value + 1)}>Check example again</button>}
          </div>
          <ul className="guide-steps">
            <li><h3>Open the operational overview</h3><p>Start with the selected jobs’ completion rates and timing samples. Check the counts before interpreting a percentage.</p><a className="guide-action" href={`${homeHref}?view=overview`}>Open operational overview</a></li>
            <li><h3>Explore an experiment comparison</h3><p>The example action selects the named experiment and its baseline/candidate compiler versions for you.</p>{state.status === 'ready' ? <a className="guide-action guide-action-primary" href={exampleHref}>Open example comparison</a> : <button disabled>Open example comparison</button>}</li>
            <li><h3>Find an improvement and a change worth investigating</h3><p>In the featured seed, resource-gain has lower estimated depth and gate count. Compile-regression has candidate compilation failures. Read the values, completed attempts and sample counts; these are constructed observations, not real benchmarks.</p><a className="guide-action" href={`${homeHref}?view=comparison`}>Open Experiment comparison</a></li>
            <li><h3>Open a supporting job</h3><p>On the comparison, expand <strong>Supporting jobs for Compilation failures observed</strong> and choose a candidate run. Or use this verified record from the available example.</p>{supportingHref ? <a className="guide-action" href={supportingHref}>Open supporting compilation-failure job</a> : <p className="evidence-note">A supporting-job link appears here only after its recorded compilation failure is verified.</p>}</li>
            <li><h3>Read metadata, timings and the event timeline</h3><p>Inspect the program/compiler and target settings, then timings. Use <strong>Jump to timeline and failure evidence</strong> to read the failure stage, explanation, correlation ID and ordered events. <strong>Back to comparison</strong> restores the same selections.</p>{supportingHref && <a className="guide-action" href={`${supportingHref}#lifecycle-evidence`}>Open the supporting timeline and failure evidence</a>}</li>
          </ul>
        </section>
        <section id="guide-sections" aria-labelledby="guide-sections-title" className="guide-page-sections"><h2 id="guide-sections-title">A guide to each section</h2><div className="guide-card-grid">
          <article className="guide-card"><h3>Overview</h3><ul className="guide-card-points"><li><strong>Shows:</strong> compilation/execution success rates, queue/runtime medians, failures by stage and jobs by target.</li><li><strong>Use it to:</strong> understand a group of runs before opening individual records.</li><li><strong>Controls:</strong> choose submission dates (UTC), target, compiler version or experiment, then <strong>Apply filters</strong>. <strong>Clear filters</strong> resets the cohort. Dates select jobs by submission time, even when later events happen outside that range.</li><li><strong>Look for:</strong> completed-attempt denominators, excluded attempts and timing n. Select a failure-stage or target chart row to open matching Jobs.</li></ul><a href={`${homeHref}?view=overview`}>Open Overview</a></article>
          <article className="guide-card"><h3>Jobs</h3><ul className="guide-card-points"><li><strong>Shows:</strong> the job explorer: recorded runs, providers/targets, statuses, submission times and requester identifiers.</li><li><strong>Use it to:</strong> locate a particular run or narrow the evidence set.</li><li><strong>Controls:</strong> search an exact job ID or external reference; references ignore case. Combine status, provider, dates, target, compiler version and experiment, then <strong>Apply filters</strong>. Use <strong>Rows per page</strong>, <strong>Previous</strong> and <strong>Next</strong>.</li><li><strong>Look for:</strong> the desired configuration and status. Select a job name to open details. Applied filters stay in the URL and return link.</li></ul><a href={homeHref}>Open Jobs</a></article>
          <article className="guide-card"><h3>Job details</h3><ul className="guide-card-points"><li><strong>Shows:</strong> Program and compiler; Target and configuration; Estimated resources; Timings; Lifecycle and failure evidence.</li><li><strong>Use it to:</strong> verify what a single run actually records.</li><li><strong>Controls:</strong> expand <strong>Submission specification</strong>, optimisation settings or event <strong>Structured diagnostics</strong>. Use the timeline jump and the context-aware back link.</li><li><strong>Look for:</strong> matching revisions/settings, available phase timestamps, the explicit failure stage and event sequence. <strong>Back to filtered jobs</strong> retains list filters; <strong>Back to comparison</strong> retains its experiment and versions.</li></ul>{supportingHref ? <a href={supportingHref}>Inspect the example job details</a> : <a href={homeHref}>Choose a job from Jobs</a>}</article>
          <article className="guide-card"><h3>Experiment comparison</h3><ul className="guide-card-points"><li><strong>Shows:</strong> baseline/candidate run counts, outcomes, timing/resource medians and changes for compatible workload configurations.</li><li><strong>Use it to:</strong> ask what changed between two compiler versions in one experiment. This is the featured comparison workflow, not a requirement for all experiments.</li><li><strong>Controls:</strong> choose an <strong>Experiment</strong>, <strong>Baseline compiler version</strong> and different <strong>Candidate compiler version</strong>, then <strong>Compare versions</strong>. <strong>Clear choices</strong> resets them.</li><li><strong>Look for:</strong> matched versus unmatched/unverifiable groups. Expand <strong>Matching configuration</strong> and either side’s jobs. Swapping versions reverses the direction; the URL and return links preserve choices.</li></ul><a href={`${homeHref}?view=comparison`}>Open Experiment comparison choices</a></article>
          <article className="guide-card"><h3>Changes to investigate</h3><ul className="guide-card-points"><li><strong>Shows:</strong> descriptive increases and improvements inside matched comparison groups, such as compilation failures, lower success or different runtimes/estimates.</li><li><strong>Use it to:</strong> choose evidence to investigate, not accept an automatic verdict.</li><li><strong>Controls:</strong> expand <strong>Supporting jobs for …</strong> or <strong>Runs contributing to timing medians</strong>, then follow a job link.</li><li><strong>Look for:</strong> absolute changes, rate differences in percentage points, eligible sample counts and missing-data messages. Supporting timing links identify all observations used for the median.</li></ul><a href={`${homeHref}?view=comparison`}>Find change highlighting in Experiment comparison</a></article>
          <article className="guide-card"><h3>Browser-only playground</h3><ul className="guide-card-points"><li><strong>Shows:</strong> an optional collapsed form on Jobs in browser-demo mode.</li><li><strong>Use it to:</strong> explore an immediately generated personal synthetic outcome.</li><li><strong>Controls:</strong> expand the playground, enter a <strong>Run name</strong>, choose a <strong>Simulated outcome</strong>, then <strong>Create simulated run</strong>. <strong>Reset demo</strong> removes personal runs, keeping bundled samples.</li><li><strong>Look for:</strong> the generated timeline. Personal runs are saved only in that browser, up to 100; they are not backend submissions or new backend experiments. This control is absent in API mode.</li></ul><a href={homeHref}>Open Jobs to find the browser-only playground</a></article>
          <article className="guide-card"><h3>How it works</h3><ul className="guide-card-points"><li><strong>Shows:</strong> implementation notes, data sources, request handling, persistence and existing build/publication setup.</li><li><strong>Use it to:</strong> review the engineering behind the interface.</li><li><strong>Controls:</strong> follow the code/document links for technical detail.</li><li><strong>Look for:</strong> the distinction between browser snapshots and local database reads, and explicit notes about components that are not implemented. The guide you are reading explains usage; <strong>How it works</strong> explains implementation.</li></ul><a href={`${homeHref}?view=implementation`}>Open How it works</a></article>
        </div></section>
        <section className="detail-panel" id="guide-glossary" aria-labelledby="guide-glossary-title"><h2 id="guide-glossary-title">A small glossary</h2><ul className="guide-glossary">{glossary.map(([term, meaning]) => <li key={term}><strong>{term}</strong><p>{meaning}</p></li>)}</ul></section>
        <section className="detail-panel" id="guide-interpretation" aria-labelledby="guide-interpretation-title"><h2 id="guide-interpretation-title">How to interpret the results</h2><ul className="guide-interpretation">
          <li><strong>Estimates and results are different.</strong> Estimated resources describe a compiled circuit. Recorded output counts describe synthetic execution samples; neither is a hardware measurement here.</li>
          <li><strong>Missing does not mean zero.</strong> “Not available,” “Not enough data” and “Insufficient data to compare” mean the necessary record or sample is absent. A real recorded zero remains zero.</li>
          <li><strong>Counts matter.</strong> Rates use completed eligible attempts; pending/cancelled attempts are excluded. Medians depend on the runs with valid timestamps or estimates. Compare n and exclusions, not just headline values.</li>
          <li><strong>Match configurations.</strong> Program revision, inputs, target/provider, shots and relevant settings must agree for this workflow to compare them. Unknown identity and other differences are flagged.</li>
          <li><strong>Changes need investigation.</strong> Highlighted differences are observations, not proof of a regression or its cause. Queue time may reflect operational conditions. Rate changes use percentage points; a zero baseline or missing values do not produce a relative percentage.</li>
          <li><strong>This is a synthetic portfolio demonstration.</strong> No result establishes real compiler or quantum-hardware performance. It does not run a real compiler, submit work to hardware or establish an AI root-cause conclusion.</li>
        </ul></section>
      </main>
    </div>
  </div>;
}
