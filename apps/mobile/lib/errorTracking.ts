import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";

const DSN =
  Constants.expoConfig?.extra?.sentryDsn ??
  process.env.EXPO_PUBLIC_SENTRY_DSN ??
  "";

let initialized = false;

export function initErrorTracking(): void {
  if (initialized || !DSN) return;
  Sentry.init({
    dsn: DSN,
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
    enabled: !__DEV__,
  });
  initialized = true;
}

export function captureException(error: unknown): void {
  if (!DSN) return;
  Sentry.captureException(error);
}

export function setUser(userId: string): void {
  if (!DSN) return;
  Sentry.setUser({ id: userId });
}

export function clearUser(): void {
  if (!DSN) return;
  Sentry.setUser(null);
}
