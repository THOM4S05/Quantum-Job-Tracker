import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, Job, JobPage } from './App';

const job: Job = {
  id: '00000000-0000-0000-0000-000000000005', name: 'Synthetic experiment 005',
  provider: 'Synthetic Aurora Labs', target: 'simulator-8q', external_reference: 'SYN-0005',
  status: 'failed', created_at: '2026-10-01T09:00:00Z', requested_by: 'demo.operator', retry_of: null,
};
const page: JobPage = { items: [job], total: 26, page: 1, page_size: 25, total_pages: 2, providers: ['Synthetic Aurora Labs', 'Synthetic Nebula Works'] };
const response = (body: JobPage, status = 200) => new Response(JSON.stringify(body), { status });

beforeEach(() => {
  window.history.replaceState(null, '', '/');
  vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response(page))));
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('jobs page', () => {
  it('shows loading before a response arrives', () => {
    vi.mocked(fetch).mockImplementation(() => new Promise(() => {}));
    render(<App />);
    expect(screen.getByRole('status')).toHaveTextContent('Loading jobs');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('renders real response fields, status text, and pagination boundaries', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(response({ ...page, total: 1, total_pages: 1 }));
    render(<App />);
    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.getByText('SYN-0005')).toBeInTheDocument();
    expect(screen.getByText(job.id)).toBeInTheDocument();
    expect(screen.getByText('Failed', { selector: '.status-badge' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: job.name })).toHaveAttribute('href', `/jobs/${job.id}`);
    expect(screen.getByRole('button', { name: 'Previous' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
  });

  it('shows an empty state and allows clearing filters', async () => {
    window.history.replaceState(null, '', '/?q=missing');
    vi.mocked(fetch).mockResolvedValueOnce(response({ ...page, items: [], total: 0, total_pages: 0 }));
    render(<App />);
    expect(await screen.findByText('No jobs found')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await userEvent.click(screen.getAllByRole('button', { name: 'Clear filters' })[0]);
    await screen.findByText('SYN-0005');
    expect(window.location.search).toBe('');
  });

  it('handles network failure and retries successfully', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Network failure'));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Unable to show jobs');
    expect(screen.queryByText('No jobs found')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('SYN-0005')).toBeInTheDocument();
  });

  it('explains invalid queries restored from the URL', async () => {
    window.history.replaceState(null, '', '/?status=invalid&page=abc');
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 422 }));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Some filters are invalid');
    expect(fetch).toHaveBeenCalledWith('/api/jobs?status=invalid&page=abc', expect.anything());
  });

  it('restores filters from the URL, combines filters, and resets the page on apply', async () => {
    window.history.replaceState(null, '', '/?status=failed&page=2&page_size=10');
    render(<App />);
    await screen.findByRole('table');
    expect(screen.getByLabelText('Status')).toHaveValue('failed');
    expect(screen.getByLabelText('Rows per page')).toHaveValue('10');
    await userEvent.type(screen.getByLabelText('Job ID or external reference'), 'SYN-0005');
    await userEvent.selectOptions(screen.getByLabelText('Provider'), 'Synthetic Aurora Labs');
    fireEvent.change(screen.getByLabelText('Submitted from (UTC)'), { target: { value: '2026-10-01' } });
    fireEvent.change(screen.getByLabelText('Submitted through (UTC)'), { target: { value: '2026-10-02' } });
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    const params = new URLSearchParams(window.location.search);
    expect(params.get('page')).toBeNull();
    expect(params.get('status')).toBe('failed');
    expect(params.get('provider')).toBe('Synthetic Aurora Labs');
    expect(params.get('q')).toBe('SYN-0005');
    expect(params.get('submitted_from')).toBe('2026-10-01');
    expect(params.get('submitted_to')).toBe('2026-10-02');
    expect(params.get('page_size')).toBe('10');
  });

  it('preserves applied filters when changing page and handles browser navigation', async () => {
    window.history.replaceState(null, '', '/?status=failed');
    render(<App />);
    await screen.findByRole('table');
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(new URLSearchParams(window.location.search).get('status')).toBe('failed');
    expect(new URLSearchParams(window.location.search).get('page')).toBe('2');
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/jobs?status=failed&page=2', expect.anything()));
    act(() => { window.history.replaceState(null, '', '/?status=queued'); window.dispatchEvent(new PopStateEvent('popstate')); });
    expect(screen.getByLabelText('Status')).toHaveValue('queued');
    await waitFor(() => expect(fetch).toHaveBeenCalledWith('/api/jobs?status=queued', expect.anything()));
  });

  it('offers recovery when the requested page is out of range', async () => {
    window.history.replaceState(null, '', '/?page=99');
    vi.mocked(fetch).mockResolvedValueOnce(response({ ...page, items: [], page: 99 }));
    render(<App />);
    expect(await screen.findByText('This page has no jobs')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Go to first page' }));
    await screen.findByRole('table');
    expect(window.location.search).toBe('');
  });

  it('marks retained data as stale if polling fails', async () => {
    vi.useFakeTimers();
    vi.mocked(fetch).mockResolvedValueOnce(response(page)).mockRejectedValueOnce(new TypeError('Offline'));
    render(<App />);
    await act(async () => {});
    expect(screen.getByRole('table')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.getByRole('alert')).toHaveTextContent('Showing previously loaded results');
    expect(screen.getByText('SYN-0005')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('pauses recurring requests in hidden tabs and resumes when visible', async () => {
    vi.useFakeTimers();
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    render(<App />);
    await act(async () => {});
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(fetch).toHaveBeenCalledTimes(1);
    visibility.mockReturnValue('visible');
    await act(async () => { await vi.advanceTimersByTimeAsync(5000); });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('does not let an old response replace a newer filtered result', async () => {
    let resolveOld!: (value: Response) => void;
    vi.mocked(fetch).mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    render(<App />);
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'failed');
    await userEvent.click(screen.getByRole('button', { name: 'Apply filters' }));
    await screen.findByRole('table');
    await act(async () => { resolveOld(response({ ...page, items: [], total: 0 })); });
    expect(screen.getByText('SYN-0005')).toBeInTheDocument();
    expect(screen.queryByText('No jobs found')).not.toBeInTheDocument();
  });
});
