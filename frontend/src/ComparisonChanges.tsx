import type { ComparisonData, Metric } from './Comparison';
import { formatChange, formatNumber } from './comparisonFormatting';
import { jobHref } from './environment';

type Row = ComparisonData['rows'][number];
type Highlight = { title: string; direction: 'higher' | 'lower' | 'insufficient'; metric: Metric; newCompilationFailures?: boolean };
const timingKeys = ['compilation_duration', 'queue_time', 'execution_duration'];

// A small presentation of existing matched metrics, with no new thresholds or scores.
export function changesToInvestigate(row: Row): Highlight[] {
  if (row.status !== 'matched') return [];
  const highlights: Highlight[] = [];
  const metrics = new Map(row.metrics.map((metric) => [metric.key, metric]));
  const baseline = row.baseline.compilation, candidate = row.candidate.compilation;
  const compilation = metrics.get('compilation_success');
  if (compilation && baseline.succeeded > 0 && baseline.failed === 0 && candidate.failed > 0) {
    highlights.push({ title: 'Compilation failures observed', direction: 'higher', metric: compilation, newCompilationFailures: true });
  }
  const descriptions = [
    ['compilation_success', 'Higher observed compilation success rate', 'Lower observed compilation success rate'],
    ['execution_success', 'Higher observed execution success rate', 'Lower observed execution success rate'],
    ['compilation_duration', 'Higher observed compilation duration', 'Lower observed compilation duration'],
    ['execution_duration', 'Higher observed runtime', 'Lower observed runtime'],
    ['estimated_circuit_depth', 'Higher estimated circuit depth', 'Lower estimated circuit depth'],
    ['estimated_gate_count', 'Higher estimated gate count', 'Lower estimated gate count'],
  ];
  for (const [key, higher, lower] of descriptions) {
    const metric = metrics.get(key);
    if (!metric) continue;
    if (metric.baseline.value === null || metric.candidate.value === null || !metric.baseline.samples || !metric.candidate.samples) {
      if (timingKeys.includes(key)) highlights.push({ title: metric.label, direction: 'insufficient', metric });
      continue;
    }
    const difference = metric.absolute_change;
    if (difference === null || difference === 0) continue;
    // New failures are the compilation concern; also show improved compilation success.
    if (key === 'compilation_success' && difference < 0) continue;
    const direction = difference > 0 ? 'higher' : 'lower';
    highlights.push({ title: difference > 0 ? higher : lower, direction, metric });
  }
  return highlights;
}

function Contributors({ row, metric, returnQuery }: { row: Row; metric: Metric; returnQuery: string }) {
  return <div className="comparison-outcomes">{(['baseline', 'candidate'] as const).map((side) => {
    const ids = metric[side].job_ids;
    const jobs = row[side].jobs.filter((job) => ids?.includes(job.id));
    return <div key={side}><h5>{side === 'baseline' ? 'Baseline' : 'Candidate'} — {timingKeys.includes(metric.key) ? 'median contributors' : 'supporting observations'} (n={metric[side].samples})</h5>
      {!metric[side].samples ? <p>No eligible observations.</p> : !ids ? <p>Contributing job IDs are not available in this response.</p> : <ul>{jobs.map((job) => <li key={job.id}><a href={jobHref(job.id, returnQuery)}>{job.name}</a> · {job.status.replaceAll('_', ' ')}</li>)}</ul>}
    </div>;
  })}</div>;
}

export function TimingEvidence({ row, returnQuery }: { row: Row; returnQuery: string }) {
  const metrics = row.metrics.filter((metric) => timingKeys.includes(metric.key));
  return <details className="diagnostics timing-contributors"><summary>Runs contributing to timing medians</summary>
    <p>These are all eligible observations used to calculate each median, including eligible failed attempts. Other runs are excluded by the existing timing rules.</p>
    {metrics.map((metric) => <div key={metric.key}><h4>{metric.label}</h4><Contributors row={row} metric={metric} returnQuery={returnQuery} /></div>)}
  </details>;
}

export function ComparisonChanges({ row, returnQuery }: { row: Row; returnQuery: string }) {
  if (row.status !== 'matched') return null;
  const highlights = changesToInvestigate(row);
  const value = (metric: Metric, side: 'baseline' | 'candidate') => metric[side].value === null ? 'Not available' : `${formatNumber(metric[side].value)} ${metric.unit}`;
  return <section className="comparison-changes" aria-label={`Changes to investigate: ${row.workload}`}>
    <h3>Changes to investigate</h3><p className="highlight-context">{row.workload} · Target: {String(row.configuration.target ?? 'Not available')}</p>
    {highlights.length === 0 ? <p>No highlighted differences in these observations.</p> : <ul className="change-list">{highlights.map((highlight) => {
      const metric = highlight.metric;
      return <li key={`${metric.key}:${highlight.title}`} className={`observed-change observed-${highlight.direction}`}>
        <h4>{highlight.title}</h4>
        {highlight.newCompilationFailures && <p>Compilation failures: baseline {row.baseline.compilation.failed} / {row.baseline.compilation.completed} completed attempts → candidate {row.candidate.compilation.failed} / {row.candidate.compilation.completed}. Absolute change: +{row.candidate.compilation.failed} failed attempts. Relative change not calculated: baseline failure count is zero.</p>}
        <p>{metric.label}: baseline {value(metric, 'baseline')} (n={metric.baseline.samples}) → candidate {value(metric, 'candidate')} (n={metric.candidate.samples}).</p>
        <p>Runs: {row.baseline.runs} baseline · {row.candidate.runs} candidate.</p>
        {highlight.direction === 'insufficient' ? <p><strong>Insufficient data to compare.</strong> Either side has no eligible timing observations; no change is calculated.</p> : <p>Absolute change: {formatChange(metric.absolute_change, metric.delta_unit)}.{metric.unit === '%' ? ' Success-rate differences use percentage points; no relative percentage is calculated.' : metric.baseline.value === 0 ? ' Relative change not calculated: baseline is zero.' : metric.percentage_change === null ? ' Relative change unavailable.' : ` Relative change: ${formatChange(metric.percentage_change, '%')}.`}</p>}
        <details className="highlight-support"><summary>Supporting jobs for {highlight.title}</summary><Contributors row={row} metric={metric} returnQuery={returnQuery} /></details>
      </li>;
    })}</ul>}
  </section>;
}
