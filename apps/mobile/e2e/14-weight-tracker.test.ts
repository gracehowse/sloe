import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

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

  it('shows Weight screen header', async () => {
    await waitFor(element(by.text('Weight')))
      .toBeVisible()
      .withTimeout(5000);
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

  it('shows Journey section', async () => {
    await waitFor(element(by.text('Journey')))
      .toBeVisible()
      .whileElement(by.id('weight-tracker-scroll'))
      .scroll(200, 'down');
  });

  it('shows Steps section', async () => {
    await waitFor(element(by.text('Steps')))
      .toBeVisible()
      .whileElement(by.id('weight-tracker-scroll'))
      .scroll(200, 'down');
  });

  it('shows Water section', async () => {
    await waitFor(element(by.text('Water')))
      .toBeVisible()
      .whileElement(by.id('weight-tracker-scroll'))
      .scroll(200, 'down');
  });

  it('shows Body Fat section', async () => {
    await waitFor(element(by.text('Body Fat')))
      .toBeVisible()
      .whileElement(by.id('weight-tracker-scroll'))
      .scroll(200, 'down');
  });

  it('navigates back', async () => {
    await device.pressBack();
  });
});
