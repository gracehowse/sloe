import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Discover screen', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Discover')).tap();
  });

  it('shows header and subtitle', async () => {
    await expect(element(by.text('Discover'))).toBeVisible();
    await expect(element(by.text('Recipes that fit your macros'))).toBeVisible();
  });

  it('shows search bar', async () => {
    await expect(element(by.text('Search or paste a link...'))).toBeVisible();
  });

  it('shows filter pills', async () => {
    await expect(element(by.text('For You'))).toBeVisible();
    await expect(element(by.text('Popular'))).toBeVisible();
    await expect(element(by.text('High Protein'))).toBeVisible();
  });

  it('shows import and library CTAs', async () => {
    await expect(element(by.text('Import from TikTok, Instagram...'))).toBeVisible();
    await expect(element(by.text('My Library'))).toBeVisible();
  });

  it('filters by High Protein and back', async () => {
    await element(by.text('High Protein')).tap();
    await element(by.text('For You')).tap();
  });

  it('search for chicken shows results or empty state', async () => {
    await element(by.text('Search or paste a link...')).tap();
    await element(by.text('Search or paste a link...')).typeText('chicken');

    try {
      await waitFor(element(by.text('kcal')))
        .toBeVisible()
        .withTimeout(10000);
    } catch {
      await expect(element(by.text('No recipes found'))).toBeVisible();
    }

    await element(by.text('Search or paste a link...')).clearText();
  });

  it('import button navigates to import screen', async () => {
    await element(by.text('Import from TikTok, Instagram...')).tap();
    await waitFor(element(by.text('IMPORT')))
      .toBeVisible()
      .withTimeout(5000);
    await device.pressBack();
  });
});
