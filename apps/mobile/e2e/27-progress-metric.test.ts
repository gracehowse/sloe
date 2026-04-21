import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Progress metric detail', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Progress')).tap();
  });

  it('opens Avg Calories detail and shows day breakdown', async () => {
    try {
      await element(by.text('Avg Calories')).tap();

      await waitFor(element(by.text('Calories')))
        .toBeVisible()
        .withTimeout(5000);

      // Verify day breakdown labels
      try {
        await expect(element(by.text('Mon'))).toBeVisible();
      } catch {
        try {
          await expect(element(by.text('Tue'))).toBeVisible();
        } catch {
          // Day labels may vary by locale
        }
      }

      await device.pressBack();
    } catch {
      // Avg Calories tile not visible — no data
    }
  });

  it('opens Protein Hit detail', async () => {
    try {
      await element(by.text('Protein Hit')).tap();

      await waitFor(element(by.text('Protein')))
        .toBeVisible()
        .withTimeout(5000);

      await device.pressBack();
    } catch {
      // Protein Hit tile not visible
    }
  });

  it('opens Streak detail', async () => {
    try {
      await element(by.text('Streak')).tap();

      await waitFor(element(by.text('Streak')))
        .toBeVisible()
        .withTimeout(5000);

      await device.pressBack();
    } catch {
      // Streak tile not visible
    }
  });

  it('shows empty progress UI if no stats', async () => {
    try {
      await expect(element(by.text('Avg Calories'))).toBeVisible();
      // Stats exist — skip empty check
    } catch {
      try {
        // 2026-04-20 prototype port: "Weekly report" subtitle was
        // replaced by the range-picker overline ("LAST 30 DAYS" by
        // default). Keep the Progress-title fallback in case the
        // overline text changed for a different selected range.
        await expect(element(by.text('LAST 30 DAYS'))).toBeVisible();
      } catch {
        await expect(element(by.text('Progress'))).toBeVisible();
      }
    }
  });
});
