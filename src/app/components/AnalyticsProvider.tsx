"use client";

import posthog from "posthog-js";
import { PostHogProvider } from "posthog-js/react";
import { useEffect, useState, type ReactNode } from "react";
import { getConsentChoice } from "./CookieConsent";
import { AnalyticsEvents } from "../../lib/analytics/events";

export function AnalyticsProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
    if (!key) {
      setReady(true);
      return;
    }
    const consent = getConsentChoice();
    posthog.init(key, {
      api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com",
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
      // sampleRate 1.0 = capture every session. Drop to 0.1 post-
      // launch as traffic grows; sampling at N=1 is noise.
      session_recording: {
        maskAllInputs: true,
        maskTextSelector: ".ph-mask",
      },
      enable_recording_console_log: false,
      // `disable_session_recording: false` is the default and matches
      // the dashboard-level enable — both must be on for replay to
      // capture (project-level toggle is owned by Grace).
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
