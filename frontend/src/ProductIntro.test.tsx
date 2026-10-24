import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { demoRequest } from './demo';
import { example, exampleHref, exampleQuery } from './example';
import { calculateOverview } from './overviewMetrics';

beforeEach(() => { window.history.replaceState(null, '', '/?view=overview'); vi.stubGlobal('fetch', vi.fn()); });
afterEach(() => { vi.unstubAllGlobals(); });

it('keeps purpose, synthetic label, source and example action visible while loading', () => {
  vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
  render(<App />);
  expect(screen.getByRole('region', { name: 'About Quantum Job Tracker' })).toHaveTextContent('Compare compiler versions, check results, or open a job to see what happened.');
  expect(screen.getByText('Synthetic demo · jobs and results are simulated')).toBeVisible();
  expect(screen.getByRole('link', { name: 'Open example comparison' })).toHaveAttribute('href', exampleHref);
  expect(screen.getByRole('status')).toHaveTextContent('Loading overview');
  expect(screen.getByText(/Local application: browsing/)).toHaveTextContent('FastAPI and PostgreSQL');
});

it('keeps an empty overview honest and still provides the example entry point', async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ ...calculateOverview([]), targets: [], compiler_versions: [], experiments: [] }));
  render(<App />);
  expect(await screen.findAllByText('Not enough data')).toHaveLength(4);
  expect(screen.getByText(/No jobs match this submission cohort/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open example comparison' })).toHaveAttribute('href', exampleHref);
});

it('allows an overview error to retry without hiding the introduction', async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(Response.json({ ...calculateOverview([]), targets: [], compiler_versions: [], experiments: [] }));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Unable to show overview');
  expect(screen.getByRole('link', { name: 'Open example comparison' })).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText(/No jobs match this submission cohort/)).toBeInTheDocument();
});

it('never substitutes example results for unseeded comparison data', async () => {
  window.history.replaceState(null, '', `/?${exampleQuery}`);
  vi.mocked(fetch).mockResolvedValue(Response.json({ synthetic: true, selection_required: false, experiment_jobs: 0, selected_jobs: 0, excluded_version_jobs: 0, matched_groups: 0, experiments: [], compiler_versions: [], rows: [] }));
  render(<App />);
  expect(await screen.findByText(/No runs match these experiment/)).toBeInTheDocument();
  expect(screen.getByText(/No named experiments/)).toHaveTextContent('No example results are substituted');
  expect(screen.queryByRole('region', { name: 'What to notice in the example' })).not.toBeInTheDocument();
});


it('shows walkthrough notes only for the featured direction, not reversed selections', async () => {
  const params = new URLSearchParams(exampleQuery);
  params.delete('view');
  window.history.replaceState(null, '', `/?${exampleQuery}`);
  vi.mocked(fetch).mockResolvedValue(await demoRequest(`/api/comparisons?${params}`));
  const first = render(<App />);
  expect(await screen.findByRole('region', { name: 'What to notice in the example' })).toBeVisible();
  first.unmount();
  params.set('baseline', example.candidate);
  params.set('candidate', example.baseline);
  window.history.replaceState(null, '', `/?view=comparison&${params}`);
  vi.mocked(fetch).mockResolvedValue(await demoRequest(`/api/comparisons?${params}`));
  render(<App />);
  expect(await screen.findAllByRole('table')).toHaveLength(4);
  expect(screen.queryByRole('region', { name: 'What to notice in the example' })).not.toBeInTheDocument();
});
