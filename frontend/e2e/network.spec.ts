import { test } from '@playwright/test';
import { exploreNetwork } from './networkJourney';
test('network success and timeout retain evidence and return navigation with the live API', async ({ page }) => {
  await exploreNetwork(page);
});
