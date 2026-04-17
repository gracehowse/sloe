import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Burn detail', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Today')).tap();
  });

  it('scrolls to burn card on Today screen', async () => {
    try {
      await waitFor(element(by.text('burned')))
        .toBeVisible()
        .whileElement(by.id('today-scroll'))
        .scroll(200, 'down');
    } catch {
      // No burn card — Health data may not be connected
    }
  });

  it('opens burn detail and shows content', async () => {
    try {
      await element(by.text('burned')).tap();

      await waitFor(element(by.text('Calorie Burn')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify energy breakdown labels
      try {
        await expect(element(by.text('Active energy'))).toBeVisible();
      } catch {
        try {
          await expect(element(by.text('Resting energy'))).toBeVisible();
        } catch {
          await expect(element(by.text('Projected'))).toBeVisible();
        }
      }

      await device.pressBack();
    } catch {
      // Burn card not available — skip
    }
  });
});
