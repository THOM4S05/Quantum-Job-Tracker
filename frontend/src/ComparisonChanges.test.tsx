import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { changesToInvestigate, ComparisonChanges, TimingEvidence } from './ComparisonChanges';
import type { ComparisonData, Metric } from './Comparison';

type Row = ComparisonData['rows'][number];
const query = 'view=comparison&experiment=example&baseline=synthetic-1&candidate=synthetic-2';
const outcomes = { succeeded: 1, failed: 0, completed: 1, pending: 0, cancelled: 0, not_started: 0, unknown: 0, rate_percent: 100 };
function row(metrics: Metric[]): Row {
  return { workload: 'synthetic-workload', configuration: { target: 'synthetic-target' }, status: 'matched', differences: [], missing_fields: [], metrics,
    baseline: { runs: 2, compilation: { ...outcomes }, execution: { ...outcomes }, jobs: [{ id: 'baseline-eligible', name: 'Baseline eligible run', status: 'succeeded' }, { id: 'baseline-excluded', name: 'Baseline excluded run', status: 'succeeded' }] },
    candidate: { runs: 1, compilation: { ...outcomes }, execution: { ...outcomes }, jobs: [{ id: 'candidate-eligible', name: 'Candidate eligible run', status: 'failed' }] } };
}
function metric(key = 'execution_duration', overrides: Partial<Metric> = {}): Metric {
  return { key, label: key === 'compilation_duration' ? 'Median compilation duration' : 'Median execution duration', unit: 's', delta_unit: 's',
    baseline: { value: 10, samples: 1, job_ids: ['baseline-eligible'] }, candidate: { value: 18, samples: 1, job_ids: ['candidate-eligible'] },
    absolute_change: 8, percentage_change: 80, ...overrides };
}

it('highlights new compilation failures only with successful baseline compilations and no recorded failures', () => {
  const result = row([metric('compilation_success', { unit: '%', delta_unit: 'pp', absolute_change: -100, percentage_change: null })]);
  result.candidate.compilation = { ...outcomes, succeeded: 0, failed: 1, rate_percent: 0 };
  expect(changesToInvestigate(result).map((entry) => entry.title)).toEqual(['Compilation failures observed']);
  const oldFailures = structuredClone(result);
  oldFailures.baseline.compilation.failed = 1;
  expect(changesToInvestigate(oldFailures)).toHaveLength(0);
  result.baseline.compilation.succeeded = 0;
  expect(changesToInvestigate(result)).toHaveLength(0);
});

it('shows compilation failure counts, successful/completed sample values and percentage points', () => {
  const result = row([metric('compilation_success', { label: 'Compilation success rate', unit: '%', delta_unit: 'pp', absolute_change: -100, percentage_change: null,
    baseline: { value: 100, samples: 1, job_ids: ['baseline-eligible'] }, candidate: { value: 0, samples: 1, job_ids: ['candidate-eligible'] } })]);
  result.candidate.compilation = { ...outcomes, failed: 1, succeeded: 0, rate_percent: 0 };
  render(<ComparisonChanges row={result} returnQuery={query} />);
  expect(screen.getByText(/Compilation failures: baseline 0/)).toHaveTextContent('candidate 1 / 1');
  expect(screen.getByText(/Absolute change: -100 pp/)).toHaveTextContent('percentage points');
  expect(screen.getByText(/Compilation failures: baseline 0/)).toHaveTextContent('baseline failure count is zero');
});

it('includes observed increases and decreases together with workload, target and counts', () => {
  const result = row([metric(), metric('compilation_duration'), metric('estimated_circuit_depth', { label: 'Estimated depth', unit: 'layers', delta_unit: 'layers', absolute_change: -3, percentage_change: -30,
    baseline: { value: 10, samples: 1 }, candidate: { value: 7, samples: 1 } }), metric('estimated_gate_count', { absolute_change: 2 })]);
  render(<ComparisonChanges row={result} returnQuery={query} />);
  expect(screen.getByRole('heading', { name: 'Higher observed runtime' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Higher observed compilation duration' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Lower estimated circuit depth' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'Higher estimated gate count' })).toBeInTheDocument();
  expect(screen.getByText(/Target: synthetic-target/)).toHaveTextContent('synthetic-workload');
  expect(screen.getAllByText('Runs: 2 baseline · 1 candidate.')).toHaveLength(4);
});

it('uses lower/higher execution success rates and pp deltas without relative percentages', () => {
  const result = row([metric('execution_success', { label: 'Execution success rate', unit: '%', delta_unit: 'pp', absolute_change: -20, percentage_change: null,
    baseline: { value: 80, samples: 5 }, candidate: { value: 60, samples: 5 } })]);
  render(<ComparisonChanges row={result} returnQuery={query} />);
  expect(screen.getByRole('heading', { name: 'Lower observed execution success rate' })).toBeInTheDocument();
  expect(screen.getByText(/Absolute change: -20 pp/)).toHaveTextContent('no relative percentage');
  expect(changesToInvestigate(row([metric('execution_success', { absolute_change: 20 })]))[0].title).toBe('Higher observed execution success rate');
});

it('keeps a real zero baseline and explicitly withholds its relative percentage', () => {
  render(<ComparisonChanges row={row([metric('execution_duration', { baseline: { value: 0, samples: 1 }, absolute_change: 18, percentage_change: null })])} returnQuery={query} />);
  expect(screen.getByText(/baseline 0 s/)).toHaveTextContent('n=1');
  expect(screen.getByText(/Absolute change: \+18 s/)).toHaveTextContent('baseline is zero');
  expect(screen.queryByText(/Insufficient data/)).not.toBeInTheDocument();
});

describe('timing evidence', () => {
  it.each([null, 10])('shows insufficient data when an arm has zero observations (value=%s)', (value) => {
    render(<ComparisonChanges row={row([metric('execution_duration', { baseline: { value, samples: 0, job_ids: [] }, absolute_change: null, percentage_change: null })])} returnQuery={query} />);
    expect(screen.getByText('Insufficient data to compare.')).toBeInTheDocument();
    expect(screen.queryByText(/Absolute change:/)).not.toBeInTheDocument();
  });

  it('links only the runs contributing to the median, preserving comparison choices', () => {
    render(<ComparisonChanges row={row([metric()])} returnQuery={query} />);
    fireEvent.click(screen.getByText('Supporting jobs for Higher observed runtime'));
    expect(screen.getByRole('link', { name: 'Baseline eligible run' })).toHaveAttribute('href', `/jobs/baseline-eligible?${query}`);
    expect(screen.getByRole('link', { name: 'Candidate eligible run' })).toHaveAttribute('href', `/jobs/candidate-eligible?${query}`);
    expect(screen.queryByRole('link', { name: 'Baseline excluded run' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Baseline — median contributors (n=1)' })).toBeInTheDocument();
  });

  it('provides provenance for queue time as well as compilation/execution timing', () => {
    const result = row([metric('compilation_duration'), metric('queue_time', { label: 'Median queue time' }), metric()]);
    render(<TimingEvidence row={result} returnQuery={query} />);
    fireEvent.click(screen.getByText('Runs contributing to timing medians'));
    expect(screen.getByRole('heading', { name: 'Median queue time' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: 'Baseline eligible run' })).toHaveLength(3);
  });
});

it.each(['baseline_only', 'candidate_only', 'unverifiable'])('never highlights incompatible configuration status %s', (status) => {
  const result = { ...row([metric()]), status };
  expect(changesToInvestigate(result)).toEqual([]);
  const { container } = render(<ComparisonChanges row={result} returnQuery={query} />);
  expect(container).toBeEmptyDOMElement();
});

it('leaves unchanged observations unhighlighted', () => {
  render(<ComparisonChanges row={row([metric('execution_duration', { absolute_change: 0, percentage_change: 0 })])} returnQuery={query} />);
  expect(screen.getByText('No highlighted differences in these observations.')).toBeInTheDocument();
});
