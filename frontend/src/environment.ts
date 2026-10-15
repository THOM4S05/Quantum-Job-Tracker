/// <reference types="vite/client" />
export const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';
export const homeHref = import.meta.env.BASE_URL;
export function jobHref(id: string, query = '') {
  if (!isDemo) return `/jobs/${encodeURIComponent(id)}${query ? `?${query}` : ''}`;
  const params = new URLSearchParams(query);
  params.set('job', id);
  return `${homeHref}?${params}`;
}
