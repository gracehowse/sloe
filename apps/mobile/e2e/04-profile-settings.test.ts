import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Profile & settings', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Profile')).tap();
  });

  it('shows main section headers', async () => {
    await expect(element(by.text('Goals & Targets'))).toBeVisible();
    await expect(element(by.text('Connections'))).toBeVisible();
  });

  it('shows Daily Targets with kcal', async () => {
    await expect(element(by.text('Daily Targets'))).toBeVisible();
    await expect(element(by.text('kcal'))).toBeVisible();
  });

  it('shows Help & Information', async () => {
    await expect(element(by.text('Help & Information'))).toBeVisible();
  });

  it('shows Export nutrition log row', async () => {
    // G-6 (2026-04-19) — primary CSV export row. JSON row renders
    // just beneath ("Export all data").
    await expect(element(by.text('Export nutrition log (CSV)'))).toBeVisible();
  });

  it('scrolls to Legal section', async () => {
    await waitFor(element(by.text('Privacy Policy')))
      .toBeVisible()
      .whileElement(by.id('profile-scroll'))
      .scroll(200, 'down');
    await expect(element(by.text('Privacy Policy'))).toBeVisible();
    await expect(element(by.text('Terms of Use'))).toBeVisible();
  });
});
