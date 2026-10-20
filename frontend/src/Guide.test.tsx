import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { App } from './App';
import { demoRequest } from './demo';
import { example, exampleHref } from './example';

beforeEach(() => {
  window.history.replaceState(null, '', '/?view=guide');
  vi.stubGlobal('fetch', vi.fn().mockImplementation((path) => demoRequest(String(path))));
});
afterEach(() => vi.unstubAllGlobals());

it('directly loads the guide with visible purpose, actual page controls, glossary and interpretation', async () => {
  render(<App />);
  expect(screen.getByRole('heading', { level: 1, name: 'Demo & Guide' })).toBeInTheDocument();
  expect(screen.getByText(/Independent portfolio project/)).toHaveTextContent('synthetic jobs and results');
  expect(screen.getByText(/You want to see whether a different compiler version/)).toBeInTheDocument();
  expect(screen.getByRole('navigation', { name: 'Guide sections' })).toBeInTheDocument();
  expect(screen.getByRole('heading', { name: 'How to interpret the results' })).toBeVisible();
  expect(screen.getByRole('heading', { name: 'A small glossary' })).toBeVisible();
  const steps = screen.getByRole('heading', { name: 'Quick start: follow one example' }).closest('section')!;
  expect(within(steps).getAllByRole('listitem')).toHaveLength(5);
  for (const title of ['Overview', 'Jobs', 'Job details', 'Experiment comparison', 'Changes to investigate', 'Browser-only playground', 'How it works']) {
    expect(screen.getByRole('heading', { level: 3, name: title })).toBeInTheDocument();
  }
  expect(await screen.findByRole('link', { name: 'Explore example comparison' })).toHaveAttribute('href', exampleHref);
});

it('resolves supporting evidence from available data and preserves the comparison return query', async () => {
  render(<App />);
  const link = await screen.findByRole('link', { name: 'Open supporting compilation-failure job' });
  const url = new URL(link.getAttribute('href')!, window.location.origin);
  expect(url.searchParams.get('view')).toBe('comparison');
  expect(url.searchParams.get('experiment')).toBe(example.id);
  expect(url.searchParams.get('baseline')).toBe(example.baseline);
  expect(url.searchParams.get('candidate')).toBe(example.candidate);
  const id = url.pathname.split('/').at(-1)!;
  const evidence = await (await demoRequest(`/api/jobs/${id}`)).json();
  expect(evidence.job.error_stage).toBe('compilation');
  expect(screen.getByRole('link', { name: 'Open the supporting timeline and failure evidence' })).toHaveAttribute('href', `${link.getAttribute('href')}#lifecycle-evidence`);
});

it('leaves the guide readable while checking example records', () => {
  vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
  render(<App />);
  expect(screen.getByRole('status')).toHaveTextContent('Checking example links');
  expect(screen.getByRole('heading', { name: 'What this app is for' })).toBeVisible();
  expect(screen.getByRole('button', { name: 'Explore example comparison' })).toBeDisabled();
  expect(screen.getByRole('link', { name: 'Open operational overview' })).toBeVisible();
});

it('handles an unavailable experiment without inventing records', async () => {
  vi.mocked(fetch).mockResolvedValue(Response.json({ rows: [] }));
  render(<App />);
  expect(await screen.findByText(/featured example is not available/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Explore example comparison' })).toBeDisabled();
  expect(screen.queryByRole('link', { name: 'Open supporting compilation-failure job' })).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Open Jobs' })).toBeVisible();
});

it('can retry a failed example check while general navigation stays available', async () => {
  vi.mocked(fetch).mockRejectedValueOnce(new Error('offline'));
  render(<App />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Example records could not be checked');
  fireEvent.click(screen.getByRole('button', { name: 'Check example again' }));
  expect(await screen.findByRole('link', { name: 'Explore example comparison' })).toBeVisible();
});

it.each(['missing', 'wrong-stage'])('does not link to an unverified supporting job: %s', async (problem) => {
  vi.mocked(fetch).mockImplementation(async (path) => {
    const response = await demoRequest(String(path));
    if (!String(path).startsWith('/api/jobs/')) return response;
    if (problem === 'missing') return new Response('{}', { status: 404 });
    const evidence = await response.json();
    evidence.job.error_stage = 'execution';
    return Response.json(evidence);
  });
  render(<App />);
  await waitFor(() => expect(screen.getByText(/supporting compilation-failure job could not be verified/)).toBeInTheDocument());
  expect(screen.getByRole('link', { name: 'Explore example comparison' })).toBeVisible();
  expect(screen.queryByRole('link', { name: 'Open supporting compilation-failure job' })).not.toBeInTheDocument();
});
