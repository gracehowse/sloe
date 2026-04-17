import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Library', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Discover')).tap();
    await element(by.text('My Library')).tap();
  });

  it('shows Library header', async () => {
    await waitFor(element(by.text('Library')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('shows sort controls', async () => {
    try {
      await expect(element(by.text('Recent'))).toBeVisible();
    } catch {
      try {
        await expect(element(by.text('Calories'))).toBeVisible();
      } catch {
        await expect(element(by.text('Protein'))).toBeVisible();
      }
    }
  });

  it('shows search input', async () => {
    await expect(element(by.text('Search your recipes'))).toBeVisible();
  });

  it('shows saved recipes or empty state', async () => {
    try {
      await expect(element(by.text('kcal'))).toBeVisible();
    } catch {
      await expect(element(by.text('No saved recipes'))).toBeVisible();
      await expect(element(by.text('Go to Discover'))).toBeVisible();
      await expect(element(by.text('Import a recipe'))).toBeVisible();
    }
  });

  it('can cycle sort option', async () => {
    try {
      await element(by.text('Recent')).tap();
    } catch {
      try {
        await element(by.text('Calories')).tap();
      } catch {
        await element(by.text('Protein')).tap();
      }
    }
  });
});
