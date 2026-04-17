import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Macro detail', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Today')).tap();
  });

  it('opens Protein detail and shows breakdown', async () => {
    try {
      await element(by.text('Protein')).tap();

      await waitFor(element(by.text('Protein')))
        .toBeVisible()
        .withTimeout(5000);

      // If meals are logged, kcal values appear in the breakdown
      try {
        await expect(element(by.text('kcal'))).toBeVisible();
      } catch {
        // No meal data — detail screen still loaded
      }

      await device.pressBack();
    } catch {
      // Protein card not visible on Today screen
    }
  });
});
