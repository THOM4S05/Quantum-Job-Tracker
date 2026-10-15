import { isDemo } from './environment';
export async function request(path: string, options?: RequestInit): Promise<Response> {
  if (isDemo) return (await import('./demo')).demoRequest(path);
  return fetch(path, options);
}
