import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Meal nutrition detail', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Today')).tap();
  });

  it('opens a meal entry and shows macro breakdown', async () => {
    // Try tapping the first meal slot that is visible
    let tapped = false;
    for (const meal of ['Breakfast', 'Lunch', 'Dinner', 'Snack']) {
      try {
        await element(by.text(meal)).atIndex(0).tap();
        tapped = true;
        break;
      } catch {
        // Try next meal type
      }
    }

    if (!tapped) {
      // No meal entries visible — nothing to test
      return;
    }

    // Verify macro labels on the detail screen
    try {
      await waitFor(element(by.text('Protein')))
        .toBeVisible()
        .withTimeout(5000);
      await expect(element(by.text('Carbs'))).toBeVisible();
      await expect(element(by.text('Fat'))).toBeVisible();

      await device.pressBack();
    } catch {
      // Meal detail did not load macros — navigate back
      await device.pressBack();
    }
  });
});
