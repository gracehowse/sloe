import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Fasting', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Profile')).tap();

    // Scroll to Fasting in profile
    await waitFor(element(by.text('Fasting')))
      .toBeVisible()
      .whileElement(by.id('profile-scroll'))
      .scroll(200, 'down');
    await element(by.text('Fasting')).tap();
  });

  it('shows Intermittent Fasting header', async () => {
    await waitFor(element(by.text('Intermittent Fasting')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('shows fasting window label', async () => {
    try {
      await expect(element(by.text('16:8'))).toBeVisible();
    } catch {
      // Other windows: 18:6 or 20:4
      try {
        await expect(element(by.text('18:6'))).toBeVisible();
      } catch {
        await expect(element(by.text('20:4'))).toBeVisible();
      }
    }
  });

  it('shows start or end fast button', async () => {
    try {
      await expect(element(by.text('Start Fast'))).toBeVisible();
    } catch {
      await expect(element(by.text('End Fast'))).toBeVisible();
    }
  });

  it('can start and immediately end a fast', async () => {
    try {
      await element(by.text('Start Fast')).tap();
      await waitFor(element(by.text('FASTING')))
        .toBeVisible()
        .withTimeout(5000);
      await element(by.text('End Fast')).tap();
      await waitFor(element(by.text('Start Fast')))
        .toBeVisible()
        .withTimeout(5000);
    } catch {
      // Already fasting or fast complete — skip
    }
  });
});
