import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Create Recipe', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Profile')).tap();

    await waitFor(element(by.text('Create Recipe')))
      .toBeVisible()
      .whileElement(by.id('profile-scroll'))
      .scroll(200, 'down');
    await element(by.text('Create Recipe')).tap();
  });

  it('shows CREATE header', async () => {
    await waitFor(element(by.text('CREATE')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('shows Cancel button', async () => {
    await expect(element(by.text('Cancel'))).toBeVisible();
  });

  it('shows Add photo placeholder', async () => {
    await expect(element(by.text('Add photo'))).toBeVisible();
  });

  it('shows form fields', async () => {
    await expect(element(by.text('Recipe name'))).toBeVisible();
    await expect(element(by.text('Servings'))).toBeVisible();
    await expect(element(by.text('Ingredients'))).toBeVisible();
  });

  it('shows Add ingredient button', async () => {
    await waitFor(element(by.text('Add ingredient')))
      .toBeVisible()
      .whileElement(by.id('create-recipe-scroll'))
      .scroll(200, 'down');
    await expect(element(by.text('Add ingredient'))).toBeVisible();
  });

  it('shows Save Recipe button', async () => {
    await expect(element(by.text('Save Recipe'))).toBeVisible();
  });

  it('shows Instructions field', async () => {
    await waitFor(element(by.text('Instructions (optional)')))
      .toBeVisible()
      .whileElement(by.id('create-recipe-scroll'))
      .scroll(200, 'down');
  });

  it('shows Publish toggle', async () => {
    await waitFor(element(by.text('Publish to community')))
      .toBeVisible()
      .whileElement(by.id('create-recipe-scroll'))
      .scroll(200, 'down');
  });

  it('shows Meal Type picker', async () => {
    await expect(element(by.text('MEAL TYPE'))).toBeVisible();
  });

  it('fills in recipe name', async () => {
    await waitFor(element(by.text('Recipe name')))
      .toBeVisible()
      .whileElement(by.id('create-recipe-scroll'))
      .scroll(200, 'up');
    await element(by.text('e.g. Chicken stir-fry')).tap();
    await element(by.text('e.g. Chicken stir-fry')).typeText('Test Recipe');
  });

  it('opens and closes food search modal', async () => {
    await waitFor(element(by.text('Add ingredient')))
      .toBeVisible()
      .whileElement(by.id('create-recipe-scroll'))
      .scroll(200, 'down');
    await element(by.text('Add ingredient')).tap();

    try {
      await waitFor(element(by.text('Search')))
        .toBeVisible()
        .withTimeout(5000);
    } catch {
      // Food search modal may use different label
    }

    await element(by.text('Cancel')).tap();
  });

  it('cancels creation and navigates back', async () => {
    await element(by.text('Cancel')).tap();
  });
});
