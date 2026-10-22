import { expect, test } from '@playwright/test';
import { followGuide } from '../e2e/guideJourney';

test('guide deep loading and example links preserve the hosting base path', async ({ page, baseURL }) => {
  const requests: string[] = [];
  page.on('request', (request) => { if (new URL(request.url()).pathname.includes('/api/')) requests.push(request.url()); });
  await followGuide(page, new URL(baseURL!).pathname, true);
  expect(requests).toEqual([]);
});

test('guide stays readable on a narrow screen and its example action works by keyboard', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseURL}?view=guide`);
  const example = page.getByRole('link', { name: 'Open example comparison', exact: true });
  await expect(example).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/quantum-guide-mobile.png', fullPage: false });
  let reached = false;
  for (let index = 0; index < 25; index++) {
    await page.keyboard.press('Tab');
    if (await example.evaluate((element) => element === document.activeElement)) { reached = true; break; }
  }
  expect(reached).toBe(true);
  await expect(example).toBeFocused();
  await expect(example).toHaveCSS('outline-style', 'solid');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { name: 'Experiment comparison', exact: true })).toBeVisible();
  expect(new URL(page.url()).pathname).toBe(new URL(baseURL!).pathname);
});


test('content lists use bullets and adapt from columns to a mobile stack', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${baseURL}?view=guide`);
  for (const selector of ['.guide-steps', '.guide-card-points', '.guide-glossary', '.guide-interpretation']) {
    await expect(page.locator(selector).first()).toHaveCSS('list-style-type', 'disc');
  }
  const steps = page.locator('.guide-steps > li');
  const first = await steps.nth(0).boundingBox();
  const second = await steps.nth(1).boundingBox();
  expect(second!.x).toBeGreaterThan(first!.x);
  expect(Math.abs(second!.y - first!.y)).toBeLessThan(2);
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileFirst = await steps.nth(0).boundingBox();
  const mobileSecond = await steps.nth(1).boundingBox();
  expect(mobileSecond!.y).toBeGreaterThan(mobileFirst!.y + mobileFirst!.height);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto(`${baseURL}?view=implementation`);
  await expect(page.locator('.implementation-list')).toHaveCSS('list-style-type', 'disc');
});
