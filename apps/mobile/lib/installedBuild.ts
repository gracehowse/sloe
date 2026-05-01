/**
 * Live install version + build label, sourced from `expo-constants` so
 * the value can never drift from what's actually shipped to the device.
 *
 * 2026-04-30 (#12, audit `docs/audits/2026-04-30-full-sweep-audit.md`):
 * the "What's new" header was hardcoded against the curated changelog
 * entry, so when `apps/mobile/package.json` bumped to 1.0.7 but the
 * latest entry still said 1.0.0/Build 11, the header showed an older
 * version label than the user had installed. The screen now reads the
 * runtime constants and prefers them; the curated changelog content
 * remains the source of truth for *what* shipped, not *which version*.
 *
 * Returns `null` when running outside an Expo runtime (web bundler, unit
 * tests) so callers can gracefully fall back to the changelog metadata.
 */
import Constants from "expo-constants";

export type InstalledBuild = {
  /** Semver — typically matches `apps/mobile/app.json` `version`. */
  appVersion: string | null;
  /** Native build number string (iOS `CFBundleVersion`, Android `versionCode`). */
  buildNumber: string | null;
};

export function readInstalledBuild(): InstalledBuild {
  const cfg = Constants.expoConfig as
    | {
        version?: string | null;
        ios?: { buildNumber?: string | null } | null;
        android?: { versionCode?: number | null } | null;
      }
    | null
    | undefined;
  const appVersion = typeof cfg?.version === "string" ? cfg.version : null;
  const iosBuild = typeof cfg?.ios?.buildNumber === "string" ? cfg.ios.buildNumber : null;
  const androidBuild =
    typeof cfg?.android?.versionCode === "number" ? String(cfg.android.versionCode) : null;
  return {
    appVersion,
    buildNumber: iosBuild ?? androidBuild,
  };
}

/**
 * Format the live build for display in the "What's new" header.
 * Falls back to the changelog metadata when expo-constants returns null
 * (test environments, web bundler).
 */
export function formatInstalledBuildLabel(
  installed: InstalledBuild,
  fallback: { appVersion: string; buildNumber: number },
): string {
  const version = installed.appVersion ?? fallback.appVersion;
  const build = installed.buildNumber ?? String(fallback.buildNumber);
  return `Build ${build} (${version} #${build})`;
}
