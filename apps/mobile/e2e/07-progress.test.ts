import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Progress screen', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Progress')).tap();
  });

  it('shows Progress header and Weekly report', async () => {
    await expect(element(by.text('Progress'))).toBeVisible();
    await expect(element(by.text('Weekly report'))).toBeVisible();
  });

  it('shows stats or empty state', async () => {
    try {
      await expect(element(by.text('Avg Calories'))).toBeVisible();

      // Data exists — check stat tiles
      await expect(element(by.text('Protein Hit'))).toBeVisible();
      await expect(element(by.text('Streak'))).toBeVisible();

      // Scroll to weight section
      await waitFor(element(by.text('Weight')))
        .toBeVisible()
        .whileElement(by.id('progress-scroll'))
        .scroll(200, 'down');
    } catch {
      // Empty state
      await expect(
        element(by.text('Your progress will appear here'))
      ).toBeVisible();
    }
  });
});
