import { Redirect } from "expo-router";

/**
 * `/(tabs)/more` is a legacy deeplink target from the pre-2026-04-27
 * 6-tab structure (Today / Discover / Library / Plan / Progress /
 * More). After the 4-tab collapse (Today / Recipes / Plan / Progress),
 * Settings became reachable from the avatar on Today, and the More
 * tab no longer exists. The `_layout.tsx` header comment promised
 * legacy `suppr:///more` deeplinks would still resolve — without this
 * file they hit the global not-found.tsx 404 instead. Redirecting to
 * Settings keeps third-party deeplinks (push notification payloads,
 * shared screenshots, in-app code that still references `/more`) from
 * breaking until they're scrubbed.
 */
export default function MoreRedirect() {
  return <Redirect href="/(tabs)/settings" />;
}
