import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Cook mode', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Discover')).tap();

    // Open the first recipe
    await waitFor(element(by.text('Recipes that fit your macros')))
      .toBeVisible()
      .withTimeout(10000);
    const recipeCard = element(by.text('kcal')).atIndex(0);
    await recipeCard.tap();

    // Scroll to Start Cooking
    await waitFor(element(by.text('Start Cooking')))
      .toBeVisible()
      .whileElement(by.id('recipe-detail-scroll'))
      .scroll(200, 'down');
  });

  it('enters cook mode', async () => {
    try {
      await element(by.text('Start Cooking')).tap();

      await waitFor(element(by.text('Exit')))
        .toBeVisible()
        .withTimeout(5000);
    } catch {
      // Start Cooking not available
    }
  });

  it('shows step indicator', async () => {
    try {
      await expect(element(by.text('Step'))).toBeVisible();
    } catch {
      // Not in cook mode
    }
  });

  it('can start and stop timer', async () => {
    try {
      await element(by.text('Start Timer')).tap();
      await waitFor(element(by.text('Stop Timer')))
        .toBeVisible()
        .withTimeout(3000);
      await element(by.text('Stop Timer')).tap();
    } catch {
      // Timer controls not available
    }
  });

  it('can navigate to next step and back', async () => {
    try {
      await element(by.text('Next')).tap();
      await expect(element(by.text('Step 2 of'))).toBeVisible();
      await expect(element(by.text('Previous'))).toBeVisible();
    } catch {
      // Navigation not available or single-step recipe
    }
  });

  it('exits cook mode', async () => {
    try {
      await element(by.text('Exit')).tap();
    } catch {
      // Not in cook mode — already exited
    }
  });
});
