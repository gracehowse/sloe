/** Storybook stub — mobile analytics / PostHog no-ops; flags default ON. */
export function isFeatureEnabled(_flag: string): boolean {
  return true;
}

export function isFeatureDisabled(_flag: string): boolean {
  return false;
}

export function track(_event: string, _props?: Record<string, unknown>): void {}

export function identify(_distinctId: string, _props?: Record<string, unknown>): void {}

export function reset(): void {}

export function getFeatureFlagPayload(_flag: string): unknown {
  return {};
}

export function captureException(_err: unknown, _props?: Record<string, unknown>): void {}

export default {
  isFeatureEnabled,
  isFeatureDisabled,
  track,
  identify,
  reset,
  getFeatureFlagPayload,
  captureException,
};
