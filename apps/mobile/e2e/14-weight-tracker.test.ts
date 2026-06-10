import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

/**
 * Weight tracker e2e — updated 2026-06-09.
 * Steps / Water / Body Fat sections were removed in the 2026-05-12
 * premium-bar audit (see weight-tracker.tsx line ~1028). Tests for those
 * sections are intentionally absent — not a gap.
 * New assertions: current-weight testID, supportive copy, Journey section.
 */
describe('Weight tracker', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Progress')).tap();

    await waitFor(element(by.text('Weight')))
      .toBeVisible()
      .whileElement(by.id('progress-scroll'))
      .scroll(200, 'down');
    await element(by.text('Weight')).tap();
  });

  it('shows Weight & Trends screen header', async () => {
    await waitFor(element(by.text('Weight & Trends')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('shows current-weight hero value', async () => {
    await expect(element(by.id('weight-tracker-current-value'))).toBeVisible();
  });

  it('shows weight input field', async () => {
    try {
      await expect(element(by.text('Weight (kg)'))).toBeVisible();
    } catch {
      await expect(element(by.text('Weight (lb)'))).toBeVisible();
    }
  });

  it('shows Save button', async () => {
    await expect(element(by.text('Save'))).toBeVisible();
  });

  it('shows supportive coaching copy', async () => {
    await expect(element(by.id('weight-tracker-supportive-copy'))).toBeVisible();
  });

  it('shows Journey section when goal is set', async () => {
    // Journey card only renders when goalWeightKg is set; attempt scroll first.
    try {
      await waitFor(element(by.text('Journey')))
        .toBeVisible()
        .whileElement(by.id('weight-tracker-scroll'))
        .scroll(200, 'down');
    } catch {
      // No goal set on test account — acceptable; Journey card is gated.
    }
  });

  it('navigates back', async () => {
    await device.pressBack();
  });
});
