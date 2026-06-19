"use strict";

/**
 * Minimal `@sentry/react-native` shim for vitest.
 *
 * The real package ships ESM (`dist/js/...`) that loads native spec
 * modules at import time and isn't transformed by vitest's node loader —
 * importing it throws `Cannot use import statement outside a module`.
 *
 * Unit tests never want real Sentry side effects, so every export here is
 * a no-op. This keeps any module that imports `./errorTracking` (which
 * imports `@sentry/react-native`) — e.g. `verifyRecipe.ts`,
 * `weeklyRecapPush.ts` — loadable without a per-test `vi.mock`.
 *
 * Wired into `tests/setup.ts`'s `_resolveFilename` redirect map (ENG-717).
 */

const noop = () => {};

module.exports = {
  init: noop,
  captureException: noop,
  captureMessage: noop,
  setUser: noop,
  addBreadcrumb: noop,
  setTag: noop,
  setContext: noop,
  withScope: (cb) => {
    if (typeof cb === "function") cb({ setTag: noop, setContext: noop, setExtra: noop });
  },
  // `Sentry.wrap(App)` returns the component unchanged.
  wrap: (component) => component,
  // `Sentry.ReactNativeTracing` / integrations are referenced but never
  // exercised under test.
  ReactNativeTracing: function ReactNativeTracing() {},
  reactNavigationIntegration: () => ({}),
};
