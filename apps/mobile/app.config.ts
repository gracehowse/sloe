import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Extends app.json. When EXPO_IOS_PERSONAL_TEAM=1, drops Sign in with Apple, Push,
 * and HealthKit entitlements so Xcode can provision with a free Personal Team.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins = [...(config.plugins ?? [])];
  if (process.env.EXPO_IOS_PERSONAL_TEAM === "1") {
    plugins.push("./plugins/withPersonalTeamDevIOS");
  }
  plugins.push("./plugins/withXcodeNodeBinary.js");
  plugins.push("./plugins/withIosXcodeAutomaticSigning.js");
  plugins.push("./plugins/withSentryDisableUploadLocalXcode");
  return {
    ...config,
    plugins,
  } as ExpoConfig;
};
