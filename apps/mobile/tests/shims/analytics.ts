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

export default { track, identifyUser, resetAnalytics, bootstrapAnalytics };
