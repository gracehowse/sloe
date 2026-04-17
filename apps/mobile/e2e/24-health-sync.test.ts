import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Health Sync', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Profile')).tap();

    await waitFor(element(by.text('Apple Health')))
      .toBeVisible()
      .whileElement(by.id('profile-scroll'))
      .scroll(200, 'down');
    await element(by.text('Apple Health')).tap();
  });

  it('shows Health Sync header', async () => {
    await waitFor(element(by.text('Health Sync')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('shows Apple Health card', async () => {
    await expect(element(by.text('Apple Health'))).toBeVisible();
  });

  it('shows feature list items', async () => {
    await expect(element(by.text('Daily step count'))).toBeVisible();
    await expect(element(by.text('Weight measurements'))).toBeVisible();
    await expect(element(by.text('Active energy burned'))).toBeVisible();

    await waitFor(element(by.text('Resting energy burned')))
      .toBeVisible()
      .whileElement(by.id('health-sync-scroll'))
      .scroll(200, 'down');
    await expect(element(by.text('Workouts'))).toBeVisible();
  });

  it('shows Nutrition Sync card', async () => {
    await waitFor(element(by.text('Nutrition Sync')))
      .toBeVisible()
      .whileElement(by.id('health-sync-scroll'))
      .scroll(200, 'down');
    await expect(element(by.text('Import meals from Health'))).toBeVisible();
    await expect(element(by.text('Share meals to Health'))).toBeVisible();
  });

  it('shows Clear all imported data button', async () => {
    await waitFor(element(by.text('Clear all imported data')))
      .toBeVisible()
      .whileElement(by.id('health-sync-scroll'))
      .scroll(200, 'down');
  });

  it('shows Connect button or Expo Go warning', async () => {
    try {
      await expect(element(by.text('Connect Health Data'))).toBeVisible();
    } catch {
      await expect(element(by.text("Apple Health isn't available"))).toBeVisible();
    }
  });

  it('navigates back', async () => {
    await device.pressBack();
  });
});
