import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Food search', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Search')).tap();
  });

  it('shows food search heading', async () => {
    await expect(element(by.text('Food search'))).toBeVisible();
    await expect(element(by.text('Search foods and log portions.'))).toBeVisible();
  });

  it('returns results or shows unavailable message', async () => {
    // Tap search to run default query
    await element(by.text('Search')).atIndex(1).tap();

    try {
      await waitFor(element(by.text('FDC')))
        .toBeVisible()
        .withTimeout(10000);
    } catch {
      await expect(element(by.text("Food search isn't available"))).toBeVisible();
    }
  });
});
