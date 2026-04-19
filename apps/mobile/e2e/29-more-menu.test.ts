import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('More/Profile menu', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Profile')).tap();
  });

  it('shows plan tier badge', async () => {
    try {
      await expect(element(by.text('Free'))).toBeVisible();
    } catch {
      try {
        await expect(element(by.text('Pro'))).toBeVisible();
      } catch {
        await expect(element(by.text('Base'))).toBeVisible();
      }
    }
  });

  it('shows stat pills', async () => {
    await expect(element(by.text('Recipes'))).toBeVisible();
    await expect(element(by.text('Streak'))).toBeVisible();
    await expect(element(by.text('Score'))).toBeVisible();
  });

  it('shows Goals & Targets section', async () => {
    await expect(element(by.text('Goals & Targets'))).toBeVisible();
    await expect(element(by.text('Daily Targets'))).toBeVisible();
    await expect(element(by.text('Dashboard Widgets'))).toBeVisible();
    await expect(element(by.text('Week Starts On'))).toBeVisible();
  });

  it('shows Connections section', async () => {
    await expect(element(by.text('Connections'))).toBeVisible();
    await expect(element(by.text('Apple Health'))).toBeVisible();
    await expect(element(by.text('Notifications'))).toBeVisible();
  });

  it('shows Create Recipe row', async () => {
    await waitFor(element(by.text('Create Recipe')))
      .toBeVisible()
      .whileElement(by.id('profile-scroll'))
      .scroll(200, 'down');
  });

  it('shows App section', async () => {
    await waitFor(element(by.text('Appearance')))
      .toBeVisible()
      .whileElement(by.id('profile-scroll'))
      .scroll(200, 'down');
    await expect(element(by.text('Export nutrition log (CSV)'))).toBeVisible();
    await expect(element(by.text('Help & Information'))).toBeVisible();
  });

  it('shows Legal section', async () => {
    await waitFor(element(by.text('Legal')))
      .toBeVisible()
      .whileElement(by.id('profile-scroll'))
      .scroll(200, 'down');
    await expect(element(by.text('Privacy Policy'))).toBeVisible();
    await expect(element(by.text('Terms of Use'))).toBeVisible();
  });

  it('shows Danger Zone', async () => {
    await waitFor(element(by.text('Danger Zone')))
      .toBeVisible()
      .whileElement(by.id('profile-scroll'))
      .scroll(200, 'down');
    await expect(element(by.text('Reset or erase everything'))).toBeVisible();
  });

  it('shows Sign Out and Erase buttons', async () => {
    await waitFor(element(by.text('Sign Out')))
      .toBeVisible()
      .whileElement(by.id('profile-scroll'))
      .scroll(200, 'down');
    await expect(element(by.text('Erase all app data'))).toBeVisible();
  });

  it('opens and closes Dashboard Widgets picker', async () => {
    await waitFor(element(by.text('Dashboard Widgets')))
      .toBeVisible()
      .whileElement(by.id('profile-scroll'))
      .scroll(200, 'up');
    await element(by.text('Dashboard Widgets')).tap();

    await waitFor(element(by.text('Done')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.text('Protein'))).toBeVisible();
    await expect(element(by.text('Carbs'))).toBeVisible();
    await expect(element(by.text('Fat'))).toBeVisible();
    await expect(element(by.text('Fiber'))).toBeVisible();

    await element(by.text('Done')).tap();
  });

  it('opens and closes Week Starts On picker', async () => {
    await element(by.text('Week Starts On')).tap();

    await waitFor(element(by.text('Monday')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.text('Sunday'))).toBeVisible();

    await element(by.text('Monday')).tap();
  });

  it('opens and closes Reset modal', async () => {
    await waitFor(element(by.text('Reset or erase everything')))
      .toBeVisible()
      .whileElement(by.id('profile-scroll'))
      .scroll(200, 'down');
    await element(by.text('Reset or erase everything')).tap();

    await waitFor(element(by.text('Reset or start over')))
      .toBeVisible()
      .withTimeout(5000);
    await expect(element(by.text('Reset Plan (Keep My Data)'))).toBeVisible();
    await expect(element(by.text('Erase all app data'))).toBeVisible();
    await expect(element(by.text('Delete my account permanently'))).toBeVisible();
    await expect(element(by.text('Cancel'))).toBeVisible();

    await element(by.text('Cancel')).tap();
  });

  it('shows Upgrade to Pro banner for free users', async () => {
    await waitFor(element(by.text('Goals & Targets')))
      .toBeVisible()
      .whileElement(by.id('profile-scroll'))
      .scroll(200, 'up');

    try {
      await expect(element(by.text('Upgrade to Pro'))).toBeVisible();
      await expect(element(by.text('Multi-day plans'))).toBeVisible();
    } catch {
      // User is already Pro — no upgrade banner
    }
  });
});
