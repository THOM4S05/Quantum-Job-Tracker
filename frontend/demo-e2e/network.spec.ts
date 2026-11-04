import { test, expect } from '@playwright/test';
import { exploreNetwork } from '../e2e/networkJourney';

test('network fixtures work through direct reload and return navigation at the hosting base path', async ({ page, baseURL }) => {
  const apiRequests: string[] = [];
  page.on('request', (request) => { if (new URL(request.url()).pathname.includes('/api/')) apiRequests.push(request.url()); });
  await exploreNetwork(page, new URL(baseURL!).pathname);
  expect(apiRequests).toEqual([]);
});
test('network details remain readable on mobile and evidence links work by keyboard', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseURL!);
  const success = page.getByRole('link', { name: 'Open network success example', exact: true });
  await success.focus();
  await page.keyboard.press('Enter');
  const network = page.getByRole('region', { name: 'Network execution', exact: true });
  await expect(network).toBeVisible();
  await network.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const first = await network.getByRole('article').nth(0).boundingBox();
  const second = await network.getByRole('article').nth(1).boundingBox();
  expect(second!.y).toBeGreaterThan(first!.y + first!.height);
  await network.screenshot({ path: '/tmp/quantum-network-mobile.png' });
  const timeout = page.getByRole('link', { name: 'Open entanglement-timeout example', exact: true });
  await timeout.focus(); await page.keyboard.press('Enter');
  await expect(network).toContainText('Coordination failure');
  await network.scrollIntoViewIfNeeded();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
