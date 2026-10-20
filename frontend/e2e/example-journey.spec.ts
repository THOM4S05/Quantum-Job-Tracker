import { test } from '@playwright/test';
import { exploreExample } from './exampleJourney';
test('first visit: overview, example comparison, supporting failure and return', async ({ page }) => {
  await exploreExample(page);
});
