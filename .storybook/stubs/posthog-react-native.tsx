/**
 * Storybook stub — posthog-react-native is mobile-only (not in root
 * node_modules). CI Storybook runs `npm ci` at repo root only, so alias
 * here. Mirrors apps/mobile/tests/shims/posthog-react-native.tsx.
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
    return "storybook-distinct-id";
  }
  reset(): void {}
  optIn(): void {}
  optOut(): void {}
  flush(): Promise<void> {
    return Promise.resolve();
  }
}

export { PostHog };

export function PostHogMaskView({
  children,
}: {
  children?: React.ReactNode;
}): React.ReactElement {
  return React.createElement(React.Fragment, null, children);
}

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
