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
export default ({ config }: ConfigContext): ExpoConfig => {
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
