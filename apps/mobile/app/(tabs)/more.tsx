import { Redirect } from "expo-router";

/**
 * Group G IA Batch D (2026-04-30): `/(tabs)/more` is now a redirect
 * to `/(tabs)/settings`. The screen body lives entirely in
 * `apps/mobile/components/settings/SettingsBundleContent.tsx`, which
 * Settings already mounts. The route stays alive for one release as a
 * redirect grace period so push-notification deep links, bookmarks,
 * and any external system that still points at `suppr:///more`
 * continues to land in the right place. Batch E deletes this file
 * after the grace period.
 *
 * Decision doc: `docs/decisions/2026-04-28-group-g-ia-collapse.md`.
 */
export default function MoreRedirect() {
  return <Redirect href="/(tabs)/settings" />;
}
