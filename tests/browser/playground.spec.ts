import { expect, test, type Page } from '@playwright/test';

const replica = (page: Page, id: string) =>
  page.getByRole('region', { name: `Replica ${id}`, exact: true });
const state = (page: Page, id: string) =>
  replica(page, id).locator('.key-list');
const status = (page: Page) =>
  page.getByRole('region', { name: 'Simulation status' });
const saved = (page: Page) =>
  expect(page.getByRole('region', { name: 'Browser storage' })).toContainText(
    'Saved to this browser',
  );

async function write(page: Page, id: string, value: string) {
  await page
    .getByRole('textbox', { name: `Value for replica ${id}` })
    .fill(value);
  await page
    .getByRole('button', { name: `Save on ${id}`, exact: true })
    .click();
  await expect(state(page, id)).toContainText(value);
  await saved(page);
}

async function advance(page: Page) {
  // Drive the real deterministic scheduler, not wall-clock sleeps or mocked timers.
  for (let step = 0; step < 10; step++) {
    await page.getByRole('button', { name: '+100 ms', exact: true }).click();
  }
}

test.beforeEach(async ({ page }) => {
  // Playwright supplies a fresh context (including IndexedDB) for every test.
  await page.goto('./');
  await expect(status(page)).toContainText('Replicas converged');
  await saved(page);
});

test('offline edits stay local even while simulated time advances', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Disconnect replica C' }).click();
  await write(page, 'C', 'Offline draft');
  await advance(page);
  await expect(status(page)).toContainText('Replicas diverged');
  await expect(state(page, 'C')).toContainText('Offline draft');
  for (const id of ['A', 'B']) {
    await expect(state(page, id)).toContainText('A shared starting point');
    await expect(state(page, id)).not.toContainText('Offline draft');
  }
});

test('reload restores offline state, history and counters before the next write', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Disconnect replica C' }).click();
  await write(page, 'C', 'Durable draft');
  const metrics = await replica(page, 'C')
    .locator('.replica-metrics strong')
    .allTextContents();
  await page.reload();
  await saved(page);
  await expect(
    page.getByRole('button', { name: 'Reconnect replica C' }),
  ).toBeVisible();
  await expect(state(page, 'C')).toContainText('Durable draft');
  await expect(
    replica(page, 'C').locator('.replica-metrics strong'),
  ).toHaveText(metrics);
  await expect(status(page)).toContainText('Replicas diverged');
  await expect(state(page, 'A')).toContainText('A shared starting point');
  await write(page, 'C', 'After reload');
  await replica(page, 'C')
    .getByText('Operation history', { exact: false })
    .click();
  const history = replica(page, 'C').locator('.history');
  await expect(history).toContainText('Durable draft');
  await expect(history).toContainText('After reload');
  await expect(history).toContainText('(4, c)');
  await expect(history).toContainText('sequence 2');
});

test('reconnection reconciles the offline operation to every replica', async ({
  page,
}) => {
  await page.getByRole('button', { name: 'Disconnect replica C' }).click();
  await write(page, 'C', 'Recovered draft');
  await expect(status(page)).toContainText('Replicas diverged');
  await page.getByRole('button', { name: 'Reconnect replica C' }).click();
  await advance(page);
  await expect(status(page)).toContainText('Replicas converged');
  for (const id of ['A', 'B', 'C']) {
    await expect(state(page, id)).toContainText('Recovered draft');
    await replica(page, id)
      .getByText('Operation history', { exact: false })
      .click();
    await expect(replica(page, id).locator('.history')).toContainText('(3, c)');
  }
});

test('conflict inspection explains the losing operation and keeps its history', async ({
  page,
}) => {
  await page
    .getByRole('combobox', { name: 'Scenario', exact: true })
    .selectOption({ label: 'Concurrent conflicting edits' });
  await page.getByRole('button', { name: 'Run scenario', exact: true }).click();
  await expect(status(page)).toContainText('Replicas converged');
  for (const id of ['A', 'B', 'C'])
    await expect(state(page, id)).toContainText('Draft C');
  await page
    .getByRole('combobox', { name: 'Event filter' })
    .selectOption({ label: 'Superseded writes' });
  await page
    .getByRole('region', { name: 'Matching events' })
    .getByRole('button')
    .first()
    .click();
  const inspector = page.getByRole('complementary', { name: 'Event details' });
  await expect(inspector).toContainText('superseded');
  await expect(inspector).toContainText('(1, b)');
  await expect(inspector).toContainText('(1, c)');
  await expect(inspector).toContainText('["b",1]');
  await expect(inspector).toContainText('Replica B');
  await expect(inspector).toContainText('Draft B');
  await replica(page, 'C')
    .getByText('Operation history', { exact: false })
    .click();
  await expect(replica(page, 'C').locator('.history')).toContainText('Draft B');
  await expect(replica(page, 'C').locator('.history')).toContainText(
    'superseded',
  );
});
