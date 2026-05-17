/**
 * /onboarding-v2 — defensive redirect to the canonical /onboarding.
 *
 * The route was renamed 2026-04-30. Most internal callsites have been
 * updated, but bookmarks, push-notification deeplinks, and any cached
 * email links still in flight will hit this URL. Without this redirect
 * they fall through to Expo Router's `+not-found` and land on the
 * "We couldn't find that. The link may be stale or the recipe may have
 * been deleted" 404 — captured in the 2026-05-05 audit (finding A3) as
 * a P0 because the same path is referenced by `SettingsBundleContent`
 * via the `suppr.onboarding-v2.state` AsyncStorage key (storage key
 * is intentionally kept; only the route is forwarded).
 *
 * 2026-05-12 (premium-bar audit B9 #2 — analytics event): fires a
 * `onboarding_v2_redirect_followed` event so we can monitor stale-
 * link traffic. When the count drops to zero for a quarter, the
 * redirect itself can be removed. Until then, the event is the
 * decision signal for end-of-life.
 *
 * Keep this file alive indefinitely (until the analytics event count
 * is zero for a sustained window) — it's a one-line guarantee and
 * the cost of removing it prematurely is a 404 for any historical
 * link.
 */
import { useEffect } from "react";
import { Redirect } from "expo-router";
import { track } from "@/lib/analytics";
import { AnalyticsEvents } from "@suppr/shared/analytics/events";

export default function OnboardingV2RedirectScreen() {
  useEffect(() => {
    track(AnalyticsEvents.onboarding_v2_redirect_followed, {
      surface: "mobile",
    });
  }, []);
  return <Redirect href="/onboarding" />;
}
