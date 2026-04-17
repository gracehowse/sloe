import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Recipe detail', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Discover')).tap();
  });

  it('opens a recipe from the discover feed', async () => {
    // Tap the first recipe card
    await waitFor(element(by.text('Recipes that fit your macros')))
      .toBeVisible()
      .withTimeout(10000);

    // Tap the first visible recipe (index 0)
    const recipeCards = element(by.text('kcal')).atIndex(0);
    await recipeCards.tap();
  });

  it('shows ingredients and nutrition', async () => {
    await waitFor(element(by.text('Ingredients')))
      .toBeVisible()
      .withTimeout(10000);
    await expect(element(by.text('kcal'))).toBeVisible();
  });

  it('shows Start Cooking button', async () => {
    await expect(element(by.text('Start Cooking'))).toBeVisible();
  });

  it('can scroll to Log to journal', async () => {
    await waitFor(element(by.text('Log to journal')))
      .toBeVisible()
      .whileElement(by.id('recipe-detail-scroll'))
      .scroll(200, 'down');
    await expect(element(by.text('Log to journal'))).toBeVisible();
  });

  it('shows portion buttons', async () => {
    await expect(element(by.text('1×'))).toBeVisible();
  });
});
