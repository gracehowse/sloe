import { device, element, by, waitFor } from 'detox';

/**
 * Launch the app and sign in with the E2E test account.
 * If already signed in (Today screen visible), skips login.
 *
 * Env vars: E2E_EMAIL, E2E_PASSWORD (set in .env.local or CI secrets).
 */
export async function loginTestAccount() {
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;
  if (!email || !password) {
    throw new Error('E2E_EMAIL and E2E_PASSWORD must be set');
  }

  // React Native keeps the run loop busy with timers/animations, which
  // blocks Detox's synchronization indefinitely. Pass launchArgs to
  // disable sync from the start, then use explicit waitFor timeouts.
  await device.launchApp({
    newInstance: true,
    launchArgs: { detoxEnableSynchronization: 0 },
  });

  // Wait for either the login screen or the Today tab to appear
  try {
    await waitFor(element(by.id('login-email')))
      .toBeVisible()
      .withTimeout(15000);

    // On the login screen — fill in credentials
    await element(by.id('login-email')).tap();
    await element(by.id('login-email')).typeText(email);
    await element(by.id('login-password')).tap();
    await element(by.id('login-password')).typeText(password);

    // Dismiss keyboard and tap Sign In
    await element(by.id('login-submit')).tap();

    // Wait for the Today tab to appear (successful login)
    await waitFor(element(by.text('Today')))
      .toBeVisible()
      .withTimeout(30000);
  } catch {
    // Already logged in — Today tab should be visible
    await waitFor(element(by.text('Today')))
      .toBeVisible()
      .withTimeout(30000);
  }
}
