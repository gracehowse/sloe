/**
 * Forces Automatic code signing on all signable iOS targets (app + extensions).
 *
 * If the Xcode project has manual provisioning / stale PROVISIONING_PROFILE entries,
 * `expo run:ios --device` skips `-allowProvisioningUpdates` (Expo treats the project as
 * "already configured") and xcodebuild fails with:
 *   "Automatic signing is disabled and unable to generate a profile"
 *
 * Run after other native plugins; then `npx expo prebuild --platform ios`.
 */
const { withXcodeProject } = require("@expo/config-plugins");
const { findSignableTargets } = require("@expo/config-plugins/build/ios/Target");
const {
  getBuildConfigurationsForListId,
  getProjectSection,
  isNotComment,
} = require("@expo/config-plugins/build/ios/utils/Xcodeproj");

function withIosXcodeAutomaticSigning(config) {
  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const targets = findSignableTargets(project);

    for (const [nativeTargetId, nativeTarget] of targets) {
      getBuildConfigurationsForListId(project, nativeTarget.buildConfigurationList)
        .filter(([, item]) => item.buildSettings?.PRODUCT_NAME)
        .forEach(([, item]) => {
          const bs = item.buildSettings;
          bs.CODE_SIGN_STYLE = "Automatic";
          delete bs.PROVISIONING_PROFILE;
          delete bs.PROVISIONING_PROFILE_SPECIFIER;
          if (!bs.CODE_SIGN_IDENTITY || bs.CODE_SIGN_IDENTITY === '""') {
            bs.CODE_SIGN_IDENTITY = '"Apple Development"';
          }
        });

      Object.entries(getProjectSection(project))
        .filter(isNotComment)
        .forEach(([, section]) => {
          const ta = section.attributes?.TargetAttributes?.[nativeTargetId];
          if (ta) {
            ta.ProvisioningStyle = "Automatic";
          }
        });
    }

    return cfg;
  });
}

module.exports = withIosXcodeAutomaticSigning;
