import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Today screen', () => {
  beforeAll(async () => {
    await loginTestAccount();
  });

  it('shows calorie ring with LOGGED text', async () => {
    await element(by.text('Today')).tap();
    await expect(element(by.text('LOGGED'))).toBeVisible();
  });

  it('shows macro cards', async () => {
    await expect(element(by.text('Protein'))).toBeVisible();
  });

  it('shows quick-log buttons', async () => {
    await expect(element(by.text('Photo'))).toBeVisible();
    await expect(element(by.text('Voice'))).toBeVisible();
    await expect(element(by.text('Search'))).toBeVisible();
    await expect(element(by.text('Scan'))).toBeVisible();
  });

  it('scrolls down and back without crash', async () => {
    await element(by.id('today-scroll')).swipe('up', 'slow', 0.3);
    await element(by.id('today-scroll')).swipe('down', 'slow', 0.3);
  });

  it('Voice quick-log opens and can be cancelled', async () => {
    await element(by.text('Voice')).tap();
    await waitFor(element(by.text('Cancel')))
      .toBeVisible()
      .withTimeout(5000);
    await element(by.text('Cancel')).tap();
  });

  it('Search quick-log opens food search', async () => {
    await element(by.text('Search')).tap();
    await waitFor(element(by.text('Food search')))
      .toBeVisible()
      .withTimeout(5000);
    await device.pressBack();
  });
});
