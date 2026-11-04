import { expect, type Page } from '@playwright/test';

export async function exploreNetwork(page: Page, basePath = '/') {
  await page.goto(`${basePath}?status=failed`);
  await page.getByRole('heading', { name: /jobs$/ }).waitFor();
  const filteredURL = page.url();
  await page.getByText('Explore network examples', { exact: true }).click();
  await page.getByRole('link', { name: 'Open network success example', exact: true }).click();
  const successURL = page.url();
  const network = page.getByRole('region', { name: 'Network execution', exact: true });
  await expect(network).toContainText('Pair consumed');
  await expect(network).toContainText('1 / 2');
  await expect(network.getByRole('article')).toHaveCount(2);
  await expect(page.getByRole('list', { name: 'Lifecycle timeline' }).getByRole('listitem')).toHaveCount(19);
  await page.reload();
  await expect(network).toContainText('11 s');
  await network.screenshot({ path: '/tmp/quantum-network-desktop.png' });
  await page.getByRole('link', { name: 'Open entanglement-timeout example', exact: true }).click();
  const timeoutURL = page.url();
  await expect(network).toContainText('Coordination failure: entanglement timeout');
  await expect(network).toContainText('Elapsed entanglement wait (timeout)12 s');
  await expect(network).toContainText('Remote-operation durationNot available');
  await expect(page.getByRole('region', { name: 'Recorded failure evidence' })).toContainText('ENTANGLEMENT_TIMEOUT');
  await expect(page.getByText('Recorded result (synthetic observed output)', { exact: true })).toHaveCount(0);
  await page.getByRole('link', { name: 'View recorded deadline event #14' }).click();
  await expect(page.locator('#event-14')).toContainText('Entanglement timeout');
  await page.goto(timeoutURL);
  await page.reload();
  await expect(network).toContainText('0 / 2');
  await page.goBack(); // Direct navigation/reload keeps the evidence address stable.
  await page.goto(successURL);
  await page.getByRole('link', { name: '← Back to filtered jobs', exact: true }).click();
  await expect(page.getByRole('heading', { name: /jobs$/ })).toBeVisible();
  await page.goto(filteredURL);
  const job = page.getByRole('table').getByRole('link', { name: 'Synthetic network timeout', exact: true });
  await expect(job).toBeVisible();
  await job.click();
  await expect(network).toContainText('timeout');
  await page.getByRole('link', { name: '← Back to filtered jobs', exact: true }).click();
  await expect(page).toHaveURL(filteredURL);
  await page.goBack();
  await expect(network).toBeVisible();
  await page.goForward();
  await expect(page).toHaveURL(filteredURL);
}
