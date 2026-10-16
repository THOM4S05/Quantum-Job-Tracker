/// <reference types="vite/client" />
export const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
export const homeHref = import.meta.env.BASE_URL;
export function jobHref(id: string, query = '') {
  if (!isDemo) return `/jobs/${encodeURIComponent(id)}${query ? `?${query}` : ''}`;
  // Put the job ID in the link so the demo can open details without a server route
  const params = new URLSearchParams(query);
  params.set('job', id);
  return `${homeHref}?${params}`;
}
