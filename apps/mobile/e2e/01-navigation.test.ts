import { element, by, expect } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Tab navigation', () => {
  beforeAll(async () => {
    await loginTestAccount();
  });

  it('Today tab loads with key content', async () => {
    await expect(element(by.text('Today'))).toBeVisible();
    await expect(element(by.text('LOGGED'))).toBeVisible();
  });

  it('Discover tab loads', async () => {
    await element(by.text('Discover')).tap();
    await expect(element(by.text('Recipes that fit your macros'))).toBeVisible();
  });

  it('Plan tab loads', async () => {
    await element(by.text('Plan')).tap();
    await expect(element(by.text('Meal Plan'))).toBeVisible();
  });

  it('Progress tab loads', async () => {
    // 2026-04-20 prototype port: Progress header overline replaces
    // the old "Weekly report" subtitle. "LAST 30 DAYS" is the
    // default-range overline rendered in both the skeleton and
    // the loaded state, so it's a stable "the screen mounted" signal.
    await element(by.text('Progress')).tap();
    await expect(element(by.text('LAST 30 DAYS'))).toBeVisible();
  });

  it('Profile tab loads', async () => {
    await element(by.text('Profile')).tap();
    await expect(element(by.text('Goals & Targets'))).toBeVisible();
  });

  it('returns to Today — round-trip complete', async () => {
    await element(by.text('Today')).tap();
    await expect(element(by.text('Today'))).toBeVisible();
  });

  it('rapid tab switching does not crash', async () => {
    await element(by.text('Discover')).tap();
    await element(by.text('Plan')).tap();
    await element(by.text('Progress')).tap();
    await element(by.text('Profile')).tap();
    await element(by.text('Today')).tap();
    await expect(element(by.text('Today'))).toBeVisible();
  });
});
