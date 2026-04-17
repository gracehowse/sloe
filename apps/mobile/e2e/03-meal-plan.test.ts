import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Meal plan', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Plan')).tap();
  });

  it('shows Meal Plan header', async () => {
    await expect(element(by.text('Meal Plan'))).toBeVisible();
  });

  it('shows generate or regenerate button', async () => {
    try {
      await expect(element(by.text('Generate Plan'))).toBeVisible();
    } catch {
      await expect(element(by.text('Regenerate'))).toBeVisible();
    }
  });

  it('generates a plan with meal slots', async () => {
    try {
      await element(by.text('Generate Plan')).tap();
    } catch {
      await element(by.text('Regenerate')).tap();
    }

    await waitFor(element(by.text('kcal')))
      .toBeVisible()
      .withTimeout(15000);
  });

  it('shows Shopping List button', async () => {
    await expect(element(by.text('Shopping List'))).toBeVisible();
  });
});
