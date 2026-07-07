import * as Sentry from "@sentry/react-native";
import Constants from "expo-constants";
import { redactPII } from "@suppr/shared/observability/sentryRedaction";

const DSN =
  Constants.expoConfig?.extra?.sentryDsn ??
  process.env.EXPO_PUBLIC_SENTRY_DSN ??
  "";

let initialized = false;

export function initErrorTracking(): void {
  // Dev client: skip native SDK init entirely — Sentry.wrap is also disabled in
  // _layout.tsx. Together they avoid FramesTracker / ANR native SIGSEGVs while
  // Metro debugging (Suppr-2026-06-11-*.ips).
  if (__DEV__ || initialized || !DSN) return;
  Sentry.init({
    dsn: DSN,
    // ENG-1404 — explicit environment tag for parity with the web Sentry
    // configs. Init returns early under `__DEV__` (above), so any event that
    // actually reaches Sentry is from a release build (TestFlight / App
    // Store) — "production" is the correct, and only reachable, bucket.
    environment: "production",
    tracesSampleRate: 0.2,
    sendDefaultPii: false,
    enabled: !__DEV__,
    enableLogs: true,
    /**
     * Mobile has no cookie banner — TestFlight + App Store users
     * consent to operational telemetry as part of installing the
     * app (see privacy policy `app/privacy/page.tsx`). We still
     * pipe every event through `redactPII` as defence in depth:
     * mobile contexts can carry `device.deviceUniqueIdentifier`,
     * push tokens, FatSecret API tokens echoed in error bodies,
     * and Supabase JWTs from authedFetch failures. Stripping at
     * the SDK boundary keeps the privacy posture identical to web
     * server / edge runtime; see
     * `docs/decisions/2026-05-14-sentry-pre-consent-capture.md`.
     */
    beforeSend(event) {
      return redactPII(
        event as unknown as Record<string, unknown>,
      ) as unknown as typeof event;
    },
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
