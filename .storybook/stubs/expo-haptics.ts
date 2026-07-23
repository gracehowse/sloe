/**
 * Storybook stubs for mobile (react-native-web) stories.
 * Keep side-effect free — imported only via Vite alias from .storybook/main.ts.
 */

export const ImpactFeedbackStyle = {
  Light: "light",
  Medium: "medium",
  Heavy: "heavy",
} as const;

export const NotificationFeedbackType = {
  Success: "success",
  Warning: "warning",
  Error: "error",
} as const;

export async function impactAsync(_style?: string): Promise<void> {}
export async function notificationAsync(_type?: string): Promise<void> {}
export async function selectionAsync(): Promise<void> {}

export default {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  selectionAsync,
};
