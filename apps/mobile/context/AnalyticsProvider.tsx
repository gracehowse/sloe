import { PostHogProvider } from "posthog-react-native";
import { useEffect, type ReactNode } from "react";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { getPostHogClient, track } from "../lib/analytics";
import { AnalyticsEvents } from "../../../src/lib/analytics/events";

/**
 * Mobile analytics provider. Initialises posthog-react-native via
 * `getPostHogClient()` (which reads the key from `app.json` `extra`
 * → `EXPO_PUBLIC_POSTHOG_KEY` env). Fires a single
 * `posthog_health_check` event on mount so PostHog ingestion can be
 * verified end-to-end within seconds of a fresh app launch.
 *
 * Context: PostHog reporting went dead 2026-04-21 → 2026-05-11 because
 * the mobile key was empty everywhere (`.env.local` blank, `app.json`
 * `extra.posthogKey` missing). Once the key is wired, this sentinel
 * lights up PostHog before the user does anything else.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const client = getPostHogClient();

  useEffect(() => {
    if (!client) return;
    // Fire once per process lifetime. React Strict Mode's
    // double-render is a non-issue here — a duplicate health check is
    // harmless data. Identify is intentionally NOT called here: we
    // want the event to land even for anonymous users so a broken
    // pre-auth boot is still visible in PostHog.
    track(AnalyticsEvents.posthog_health_check, {
      platform: Platform.OS,
      buildVersion: Constants.expoConfig?.version ?? null,
      buildNumber:
        (Platform.OS === "ios"
          ? Constants.expoConfig?.ios?.buildNumber
          : Constants.expoConfig?.android?.versionCode?.toString()) ?? null,
    });
  }, [client]);

  if (!client) return <>{children}</>;
  return <PostHogProvider client={client}>{children}</PostHogProvider>;
}
