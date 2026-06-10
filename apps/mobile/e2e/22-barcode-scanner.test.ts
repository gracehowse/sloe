import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Barcode Scanner', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Today')).tap();
  });

  it('opens scanner from Scan button', async () => {
    await element(by.text('Scan')).tap();

    // Should show either permission prompt or scanner UI.
    // Gap #2 (2026-06-09): idle overlay title changed from "Barcode Scanner"
    // to "Scan a barcode" (serif editorial treatment).
    try {
      await waitFor(element(by.text('Grant Permission')))
        .toBeVisible()
        .withTimeout(5000);
      await expect(element(by.text('Grant Permission'))).toBeVisible();
    } catch {
      await expect(element(by.text('Scan a barcode'))).toBeVisible();
    }
  });

  it('navigates back to Today', async () => {
    await element(by.text('Today')).tap();
    await expect(element(by.text('Today'))).toBeVisible();
  });
});
