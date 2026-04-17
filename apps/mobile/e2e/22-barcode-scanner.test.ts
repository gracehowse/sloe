import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Barcode Scanner', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Today')).tap();
  });

  it('opens scanner from Scan button', async () => {
    await element(by.text('Scan')).tap();

    // Should show either permission prompt or scanner UI
    try {
      await waitFor(element(by.text('Grant Permission')))
        .toBeVisible()
        .withTimeout(5000);
      await expect(element(by.text('Grant Permission'))).toBeVisible();
    } catch {
      await expect(element(by.text('Barcode Scanner'))).toBeVisible();
      await expect(element(by.text('Point at a product barcode'))).toBeVisible();
    }
  });

  it('navigates back to Today', async () => {
    await element(by.text('Today')).tap();
    await expect(element(by.text('Today'))).toBeVisible();
  });
});
