import { test } from '@playwright/test';
import { followGuide } from './guideJourney';
test('Demo & Guide opens the example and verified supporting evidence', async ({ page }) => {
  await followGuide(page);
});
