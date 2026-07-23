import type { Metrics } from "react-native-safe-area-context";

/**
 * Static safe-area metrics for Storybook / RN-web / Vitest.
 *
 * `SafeAreaProvider` without `initialMetrics` throws
 * "No safe area value available" when there is no native module
 * (browser + storybook test runner). iPhone-ish frame keeps sheet
 * inset math realistic for mobile stories.
 */
export const STORYBOOK_SAFE_AREA_METRICS: Metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};
