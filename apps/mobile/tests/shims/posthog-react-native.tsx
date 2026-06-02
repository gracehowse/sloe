/**
 * Test shim for `posthog-react-native` (wired via the vitest.config alias).
 *
 * The real SDK's storage layer dereferences `window` in an async path. Under
 * vitest's `node` environment there is no `window`, so any test that builds a
 * real PostHog client leaks an "Unhandled Rejection: window is not defined"
 * that fails the run (surfaced on CI, where `EXPO_PUBLIC_POSTHOG_KEY` is set so
 * `getPostHogClient` proceeds past its `!POSTHOG_KEY` guard; locally the key is
 * "" so the real client was never built — that is the local↔CI divergence that
 * greened `npm run ci` locally but failed the CI `mobile` job, 2026-06-01).
 *
 * The existing `@/lib/analytics` alias shims the analytics WRAPPER, but a
 * component that imports the real analytics module via a relative/extensioned
 * path (or the analytics-self test that imports `../../lib/analytics`) bypasses
 * that alias and loads the real `posthog-react-native`. Shimming the SDK itself
 * closes every path: no test can instantiate the native client.
 *
 * Mirrors the `FakePostHog` in `tests/unit/isFeatureDisabled.test.ts` (which
 * keeps its own `vi.mock` so it can drive `isFeatureEnabled` return values).
 */
import * as React from "react";

export default class PostHog {
  constructor(_apiKey?: string, _options?: unknown) {}
  isFeatureEnabled(_flag: string): boolean | undefined {
    return undefined;
  }
  getFeatureFlag(_flag: string): boolean | string | undefined {
    return undefined;
  }
  reloadFeatureFlagsAsync(): Promise<void> {
    return Promise.resolve();
  }
  capture(): void {}
  identify(): void {}
  screen(): void {}
  register(): void {}
  getDistinctId(): string {
    return "test-distinct-id";
  }
  reset(): void {}
  optIn(): void {}
  optOut(): void {}
  flush(): Promise<void> {
    return Promise.resolve();
  }
}

export { PostHog };

/** Masking wrapper — renders children verbatim so RNTL can walk the tree. */
export function PostHogMaskView({
  children,
}: {
  children?: React.ReactNode;
}): React.ReactElement {
  return React.createElement(React.Fragment, null, children);
}

/** Provider no-op — passes children through. */
export function PostHogProvider({
  children,
}: {
  children?: React.ReactNode;
}): React.ReactElement {
  return React.createElement(React.Fragment, null, children);
}

export function usePostHog(): null {
  return null;
}
