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
 * Keep this file alive indefinitely — it's a one-line guarantee and
 * the cost of removing it is a 404 for any historical link.
 */
import { Redirect } from "expo-router";

export default function OnboardingV2RedirectScreen() {
  return <Redirect href="/onboarding" />;
}
