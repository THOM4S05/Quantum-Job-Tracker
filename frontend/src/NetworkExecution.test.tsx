import { render, screen, within } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import snapshot from './data/networkSnapshot.json';
import { NetworkExecution } from './NetworkExecution';
import { JobDetails, type JobEvidence } from './JobDetails';
import { demoRequest, resetDemo } from './demo';

const fixtures = snapshot.jobs as JobEvidence[];
afterEach(() => { vi.unstubAllGlobals(); resetDemo(); });
it('shows successful pair consumption, concurrent execution time and attempt denominator', () => {
  render(<NetworkExecution evidence={fixtures[0]} />);
  const section = screen.getByRole('region', { name: 'Network execution' });
  expect(section).toHaveTextContent('Pair consumed');
  expect(section).toHaveTextContent('11 s');
  expect(section).toHaveTextContent('4 s');
  expect(section).toHaveTextContent('1 / 2');
  expect(section).toHaveTextContent('2 s');
  expect(within(section).getAllByRole('article')).toHaveLength(2);
  expect(screen.getByRole('group')).toHaveAccessibleName(/Two synthetic machines connected/);
});
it('labels timeout wait and stopped parts without a fabricated remote duration', () => {
  render(<NetworkExecution evidence={fixtures[1]} />);
  const section = screen.getByRole('region', { name: 'Network execution' });
  expect(section).toHaveTextContent('Elapsed entanglement wait (timeout)12 s');
  expect(section).toHaveTextContent('Remote-operation durationNot available');
  expect(section).toHaveTextContent('0 / 2');
  expect(section).toHaveTextContent('Coordination failure: entanglement timeout');
  expect(within(section).getAllByText(/no device fault recorded/)).toHaveLength(3);
  const link = screen.getByRole('link', { name: /View recorded deadline event/ });
  expect(link).toHaveAttribute('href', '#event-14');
});
it('shows missing and inconsistent evidence without presenting derived metrics as trustworthy', () => {
  const item = structuredClone(fixtures[0]);
  item.networking!.issues = ['Missing remote completion.'];
  render(<NetworkExecution evidence={item} />);
  expect(screen.getByRole('status')).toHaveTextContent('incomplete or inconsistent');
  expect(screen.getByText('Missing remote completion.')).toBeInTheDocument();
  expect(screen.getAllByText('Not available')).toHaveLength(4);
  expect(screen.queryByText('11 s')).not.toBeInTheDocument();
});
it('shows an unavailable extension explicitly', () => {
  render(<NetworkExecution evidence={{ ...fixtures[0], networking: null }} />);
  expect(screen.getByText(/distributed specification has no networking records/)).toBeInTheDocument();
});
it('keeps authoritative combined timeline, sequence ties, failure event and result semantics', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(fixtures[1])));
  render(<JobDetails jobId={fixtures[1].job.id} backHref="/?status=failed" />);
  await screen.findByRole('region', { name: 'Network execution' });
  const rows = within(screen.getByRole('list', { name: 'Lifecycle timeline' })).getAllByRole('listitem');
  expect(rows).toHaveLength(fixtures[1].events.length);
  expect(rows.map((r) => r.getAttribute('data-sequence'))).toEqual(fixtures[1].events.map((e) => String(e.sequence)));
  expect(screen.getByText(/Synthetic recorded order/)).toBeInTheDocument();
  expect(screen.queryByText('Recorded result (synthetic observed output)')).not.toBeInTheDocument();
});
it('browser adapter preserves IDs, timings and all 256 existing bundled records', async () => {
  const page = await (await demoRequest('/api/jobs')).json();
  expect(page.total).toBe(258);
  for (const fixture of fixtures) {
    const item = await (await demoRequest(`/api/jobs/${fixture.job.id}`)).json();
    expect(item).toEqual(fixture);
    const listed = await (await demoRequest(`/api/jobs?q=${fixture.job.external_reference}`)).json();
    expect(listed.total).toBe(1);
    expect(listed.items[0].execution_method).toBe('entanglement_network');
  }
  const overview = await (await demoRequest('/api/overview')).json();
  expect(overview.network_outcomes).toEqual([{ key: 'succeeded', count: 1 }, { key: 'entanglement_timeout', count: 1 }, { key: 'other_or_pending', count: 0 }]);
});
