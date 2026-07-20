import "./scripts/load-repo-env.cjs";

import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Extends app.json. When EXPO_IOS_PERSONAL_TEAM=1, drops Sign in with Apple, Push,
 * and HealthKit entitlements so Xcode can provision with a free Personal Team.
 *
 * 2026-05-15 — `SUPPR_API_URL_OVERRIDE` env var swaps the API base
 * at build time (Metro reads this when bundling). Use to point a dev
 * client at a Vercel preview without editing app.json. Example:
 *   SUPPR_API_URL_OVERRIDE=https://suppr-9wn75oeh5-gracehowses-projects.vercel.app \
 *     npx expo start --tunnel --clear
 */
/**
 * SEC-05/DI-05 (ENG-1389) — defence in depth for the E2E auto-login seam
 * in context/auth.tsx. That seam is already gated behind `__DEV__` at
 * runtime (dead-code-eliminated out of release bundles), but `EXPO_PUBLIC_*`
 * vars are inlined at build time, so a stray EXPO_PUBLIC_E2E_* in a release
 * EAS profile is still a misconfiguration we want to catch LOUDLY rather
 * than ship. app.config.ts is evaluated during every EAS build (and by
 * `expo start`), so it — not scripts/verify-production-env.ts, which runs
 * at web/Vercel deploy time and never sees the mobile build env — is the
 * correct place for this EAS-side assertion. Only fires for the
 * distribution profiles (`production`/`preview`); the `development`
 * profile + local `expo start` legitimately carry these vars.
 */
function assertNoE2ECredentialsInReleaseBuild(): void {
  const profile = process.env.EAS_BUILD_PROFILE;
  const isReleaseProfile = profile === "production" || profile === "preview";
  if (!isReleaseProfile) return;
  const leaked = [
    "EXPO_PUBLIC_E2E_AUTH_ENABLED",
    "EXPO_PUBLIC_E2E_EMAIL",
    "EXPO_PUBLIC_E2E_PASSWORD",
  ].filter((k) => (process.env[k] ?? "").trim().length > 0);
  if (leaked.length > 0) {
    throw new Error(
      `[app.config] Refusing to build the "${profile}" profile with E2E ` +
        `auto-login vars set (${leaked.join(", ")}). These bake a login ` +
        `credential into the shipped bundle. Unset them for release builds ` +
        `— the seam is dev-only (SEC-05/DI-05, ENG-1389).`,
    );
  }
}

export default ({ config }: ConfigContext): ExpoConfig => {
  assertNoE2ECredentialsInReleaseBuild();
  const plugins = [...(config.plugins ?? [])];
  if (process.env.EXPO_IOS_PERSONAL_TEAM === "1") {
    plugins.push("./plugins/withPersonalTeamDevIOS");
  }
  plugins.push("./plugins/withXcodeNodeBinary.js");
  plugins.push("./plugins/withIosMetroBundleUrlFallback.js");
  plugins.push("./plugins/withIosXcodeAutomaticSigning.js");
  plugins.push("./plugins/withSentryDisableUploadLocalXcode");
  plugins.push("./plugins/withStoreKitConfiguration.js");

  const apiOverride = process.env.SUPPR_API_URL_OVERRIDE?.trim();
  const extra = apiOverride
    ? { ...(config.extra ?? {}), supprApiUrl: apiOverride }
    : config.extra;

  return {
    ...config,
    plugins,
    extra,
  } as ExpoConfig;
};
