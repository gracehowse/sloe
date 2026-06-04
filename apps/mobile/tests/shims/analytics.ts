/**
 * Mobile `lib/analytics` shim for vitest.
 *
 * The real module pulls in `posthog-react-native`, which transitively
 * imports `react-native-svg`, which needs `_reactNative.Touchable` — an
 * API that's intentionally not in the vitest `react-native` shim (it's
 * a rarely-used legacy mixin; adding it would grow the shim surface
 * for no test benefit). Tests that need to assert an analytics fire
 * can `vi.mock("@/lib/analytics", ...)` and inspect `track`.
 */
import { vi } from "vitest";

export const track = vi.fn((_name: string, _payload?: Record<string, unknown>) => undefined);
export const identifyUser = vi.fn((_id?: string, _props?: Record<string, unknown>) => undefined);
export const resetAnalytics = vi.fn(() => undefined);
export const bootstrapAnalytics = vi.fn(() => undefined);

/** Mirrors `apps/mobile/lib/analytics.ts#isFeatureEnabled` — defaults
 *  to false in tests so flag-gated callsites take their off-branch
 *  unless a test explicitly mocks this to true. */
export const isFeatureEnabled = vi.fn((_flag: string) => false);

/** Mirrors `apps/mobile/lib/analytics.ts#isFeatureDisabled` — defaults
 *  to false ("not disabled") in tests so default-ON behaviour (e.g. the
 *  soft resting-card elevation in `useCardElevation`) takes its ON path
 *  unless a test explicitly mocks this to true to exercise a kill switch. */
export const isFeatureDisabled = vi.fn((_flag: string) => false);

export default {
  track,
  identifyUser,
  resetAnalytics,
  bootstrapAnalytics,
  isFeatureEnabled,
  isFeatureDisabled,
};
