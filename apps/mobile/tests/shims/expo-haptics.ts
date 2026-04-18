/**
 * `expo-haptics` shim — no-op. Real haptics call the native bridge; tests
 * only need the functions to exist so component code that taps them
 * doesn't throw.
 */
export const ImpactFeedbackStyle = {
  Light: "light" as const,
  Medium: "medium" as const,
  Heavy: "heavy" as const,
  Soft: "soft" as const,
  Rigid: "rigid" as const,
};

export const NotificationFeedbackType = {
  Success: "success" as const,
  Warning: "warning" as const,
  Error: "error" as const,
};

export async function impactAsync(_style?: unknown): Promise<void> {}
export async function notificationAsync(_type?: unknown): Promise<void> {}
export async function selectionAsync(): Promise<void> {}

export default {
  ImpactFeedbackStyle,
  NotificationFeedbackType,
  impactAsync,
  notificationAsync,
  selectionAsync,
};
