"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect, useState, type ReactNode } from "react";
import { getConsentChoice } from "./CookieConsent";
import { AnalyticsEvents } from "../../lib/analytics/events";
import {
  DEFAULT_SESSION_REPLAY_SAMPLE_RATE,
  SAMPLE_RATE_CACHE_KEY,
  SESSION_REPLAY_SAMPLE_RATE_FLAG,
  parseSampleRate,
  resolveSampleRate,
} from "../../lib/analytics/sessionReplaySampleRate";

/** Read the session-replay sample rate cached from a previous session's
 *  PostHog flag fetch. Falls back to the default 1.0 when the cache is
 *  unset (first visit) or unreadable (private mode / storage denied).
 *  See `sessionReplaySampleRate.ts` for the full pattern. */
function readCachedSampleRate(): number {
  if (typeof window === "undefined") return DEFAULT_SESSION_REPLAY_SAMPLE_RATE;
  try {
    return resolveSampleRate(window.localStorage.getItem(SAMPLE_RATE_CACHE_KEY));
  } catch {
    return DEFAULT_SESSION_REPLAY_SAMPLE_RATE;
  }
}

/** After flags load, persist the `session-replay-sample-rate` flag
 *  payload to localStorage so the next session boots with the latest
 *  rate. PostHog session-replay sampling is decided at recording-start
 *  time, so this lags by one session — acceptable for a slow-moving
 *  config knob. Silent on failure (storage denied / SDK shape drift).
 *
 *  Typed as `unknown` instead of the SDK's `PostHogInterface` (which
 *  differs from the default-imported `posthog` instance type) — we
 *  only need `getFeatureFlagPayload`, so we narrow with a feature
 *  check rather than a structural type assertion. */
function persistSampleRateFromFlag(ph: unknown): void {
  try {
    const reader = ph as {
      getFeatureFlagPayload?: (flag: string) => unknown;
    };
    const payload = reader.getFeatureFlagPayload?.(
      SESSION_REPLAY_SAMPLE_RATE_FLAG,
    );
    const rate = parseSampleRate(payload);
    if (rate === null) return;
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SAMPLE_RATE_CACHE_KEY, String(rate));
    }
  } catch {
    /* non-fatal */
  }
}

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
    if (!key) {
      setReady(true);
      return;
    }
    const consent = getConsentChoice();
    const sampleRate = readCachedSampleRate();
    posthog.init(key, {
      // 2026-05-14 — point at the Next.js reverse-proxy
      // (`next.config.ts` rewrites). `ui_host` keeps PostHog
      // dashboard deep-links working since the proxy host is not
      // app.posthog.com.
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "/ingest",
      ui_host: "https://us.posthog.com",
      person_profiles: "identified_only",
      // Start opted out if no consent yet or explicitly declined
      opt_out_capturing_by_default: consent !== "accepted",
      // 2026-05-13 (D-2026-05-13-session-replay): web session replay
      // enabled to mirror the mobile setup shipped 2026-05-11. Phase A
      // posture — pre-launch with one tester (Grace), capturing every
      // session is both affordable and high-leverage: every TF / web
      // bug report becomes a replayable session rather than a
      // screenshot + memory.
      //
      // Consent-gated: the existing `opt_out_capturing_by_default`
      // gate already covers replay (PostHog's session-recording layer
      // honours the same opt-out flag as event capture).
      //
      // P0 security review (mirror of mobile commit 2026-05-11):
      //   - `enable_recording_console_log: false` — Suppr's web
      //     console emits Supabase RLS errors, vendor API error
      //     bodies, and unredacted recipe / food-search payloads.
      //     None of that is masked by the SDK; default capture would
      //     embed those strings in the replay segment.
      //   - `mask_all_inputs: true` (SDK default — kept explicit) so
      //     auth, payment, weight, body-stats inputs never leave
      //     the browser as cleartext.
      //   - `mask_text_selector: ".ph-mask"` lets surfaces opt extra
      //     elements into masking via the `ph-mask` className — use
      //     this on weight numbers, journal text, recipe titles when
      //     they leave the dashboard for any audience beyond Grace.
      //
      // sampleRate driven by the `session-replay-sample-rate` PostHog
      // feature flag (ENG-516, 2026-05-16). Default 1.0 = capture every
      // session — matches the pre-flag pre-launch posture. Flip to 0.1
      // (or lower) in the PostHog dashboard post-launch as traffic
      // grows. The value is read from the previous session's cached
      // flag value (sampling is decided at recording-start, so a
      // dashboard change takes effect on the user's next session — fine
      // for a slow-moving knob).
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: ".ph-mask",
        sampleRate,
      },
      enable_recording_console_log: false,
      // `disable_session_recording: false` is the default and matches
      // the dashboard-level enable — both must be on for replay to
      // capture (project-level toggle is owned by Grace).
      //
      // `loaded` callback fires once flags have been fetched and the
      // SDK is ready. We use it to persist the current sample-rate
      // flag value for the NEXT session's `posthog.init` call above.
      loaded: persistSampleRateFromFlag,
    });
    // If user already accepted, opt back in (handles returning visitors)
    if (consent === "accepted") {
      posthog.opt_in_capturing();
      // Analytics health sentinel (2026-05-11) — confirms PostHog
      // ingestion is alive on every consent-accepted session. Fires
      // pre-route-change so a dead deploy is visible within seconds
      // even if the user immediately closes the tab.
      try {
        posthog.capture(AnalyticsEvents.posthog_health_check, {
          platform: "web",
        });
      } catch {
        /* SDK not yet ready — non-fatal */
      }
    }
    setReady(true);
  }, []);

  // Re-check consent when it changes (user interacts with banner in the same tab)
  useEffect(() => {
    if (!ready) return;
    function onConsent(e: Event) {
      const detail = (e as CustomEvent<string>).detail;
      if (detail === "accepted" && posthog.has_opted_out_capturing?.()) {
        posthog.opt_in_capturing();
        // Fire the health sentinel on first-accept too so the very
        // first session after a user clicks the banner is visible
        // in PostHog without waiting for a subsequent page load.
        try {
          posthog.capture(AnalyticsEvents.posthog_health_check, {
            platform: "web",
          });
        } catch {
          /* SDK not yet ready — non-fatal */
        }
      } else if (detail === "declined" && !posthog.has_opted_out_capturing?.()) {
        posthog.opt_out_capturing();
      }
    }
    window.addEventListener("suppr-consent", onConsent);
    return () => window.removeEventListener("suppr-consent", onConsent);
  }, [ready]);

  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()) {
    return children;
  }
  if (!ready) {
    return children;
  }
  return <PostHogProvider client={posthog}>{children}</PostHogProvider>;
}
