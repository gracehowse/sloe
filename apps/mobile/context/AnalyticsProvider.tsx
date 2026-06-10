import { PostHogProvider } from "posthog-react-native";
import { useEffect, useState, type ReactNode } from "react";
import Constants from "expo-constants";
import { Platform } from "react-native";
import type PostHog from "posthog-react-native";
import {
  getPostHogClient,
  persistSessionReplaySampleRate,
  primeForcedFlags,
  primeSessionReplaySampleRate,
  track,
} from "../lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";

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
 *
 * ENG-516 (2026-05-16) — session-replay sample rate is wired through a
 * PostHog feature flag (`session-replay-sample-rate`). We prime the
 * cached rate from AsyncStorage BEFORE creating the PostHog client so
 * the value is applied at SDK init time. On first launch the cache
 * is empty and we use the default 1.0; on subsequent launches the
 * previous session's flag payload drives the rate.
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<PostHog | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      // Prime the sample-rate cache from AsyncStorage before creating
      // the PostHog client. On first launch this is a fast no-op (no
      // cache key set), on subsequent launches it overwrites the
      // module-level `initialSampleRate` with the previous session's
      // flag payload value.
      await primeSessionReplaySampleRate();
      // ENG-840 — hydrate the dev/QA forced-flag overrides from
      // AsyncStorage before the first flag read so a flag forced in a
      // previous session is honoured on first paint. No-op in release
      // builds (dropped by Hermes DCE).
      await primeForcedFlags();
      if (!active) return;
      const c = getPostHogClient();
      setClient(c);
      if (!c) return;

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

      // Wait for flags to load, then persist the latest sample-rate
      // payload for the next session. `onFeatureFlags` fires when the
      // SDK first loads flags AND whenever they change, so the cached
      // value always reflects the latest dashboard state.
      try {
        c.onFeatureFlags?.(() => {
          void persistSessionReplaySampleRate(c);
        });
      } catch {
        /* SDK shape drift — non-fatal, default 1.0 stays */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (!client) return <>{children}</>;
  return <PostHogProvider client={client}>{children}</PostHogProvider>;
}
