import { isDemo } from './environment';
export async function request(path: string, options?: RequestInit): Promise<Response> {
  // Load sample data only when the demo needs it
  if (isDemo) return (await import('./demo')).demoRequest(path);
  return fetch(path, options);
}
