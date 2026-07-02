import { PostHogProvider } from "posthog-react-native";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
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
import {
  onAnalyticsConsentChange,
  primeAnalyticsConsent,
} from "../lib/analyticsConsent";
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
 *
 * ENG-1286 (2026-07-01) — analytics + replay are consent-gated.
 * `primeAnalyticsConsent()` hydrates the stored choice BEFORE the first
 * `getPostHogClient()` call; with no "accepted" consent the client is
 * null and this provider renders children bare (no SDK, no capture, no
 * replay). When the user accepts — consent prompt or Settings toggle —
 * the consent listener below adopts the freshly-constructed client and
 * fires the health sentinel, mirroring web's `suppr-consent` event
 * handler (opt-in + sentinel on accept without a reload).
 */
export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [client, setClient] = useState<PostHog | null>(null);
  // Guards the one-per-process health sentinel + flag-listener wiring
  // when the consent listener re-runs adoption (e.g. decline→accept
  // toggling in Settings keeps the same client instance).
  const bootstrappedRef = useRef<PostHog | null>(null);

  const adoptClient = useCallback(() => {
    const c = getPostHogClient();
    setClient(c);
    if (!c || bootstrappedRef.current === c) return;
    bootstrappedRef.current = c;

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
  }, []);

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
      // ENG-1286 — hydrate the stored consent choice BEFORE the first
      // client construction so an accepted user boots straight into
      // capture and everyone else stays gated off.
      await primeAnalyticsConsent();
      if (!active) return;
      adoptClient();
    })();
    // ENG-1286 — consent flipped mid-session (prompt accept / Settings
    // toggle). The analytics module has already applied optIn/optOut;
    // here we adopt the (possibly newly-constructed) client into React
    // state so `<PostHogProvider>` mounts without a restart.
    const unsubscribe = onAnalyticsConsentChange((choice) => {
      if (!active) return;
      if (choice === "accepted") adoptClient();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [adoptClient]);

  if (!client) return <>{children}</>;
  return <PostHogProvider client={client}>{children}</PostHogProvider>;
}
