import { expect, test } from '@playwright/test';
import { exploreExample } from '../e2e/exampleJourney';

test('complete example works at the GitHub Pages repository base path without an API', async ({ page, baseURL }) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => { if (new URL(request.url()).pathname.includes('/api/')) apiRequests.push(request.url()); });
  await exploreExample(page, new URL(baseURL!).pathname, true);
  expect(apiRequests).toEqual([]);
  await page.screenshot({ path: '/tmp/quantum-example-hosting.png', fullPage: false });
});
