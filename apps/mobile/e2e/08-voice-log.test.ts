import { element, by, expect, waitFor } from 'detox';
import { loginTestAccount } from './helpers/login';

describe('Voice log', () => {
  beforeAll(async () => {
    await loginTestAccount();
    await element(by.text('Today')).tap();
  });

  it('opens voice log text input', async () => {
    await element(by.text('Voice')).tap();
    await waitFor(element(by.text('Describe what you ate')))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('can type food and cancel', async () => {
    await element(by.text('Type what you ate...')).tap();
    await element(by.text('Type what you ate...')).typeText('2 scrambled eggs and toast');
    await element(by.text('Cancel')).tap();
  });
});
