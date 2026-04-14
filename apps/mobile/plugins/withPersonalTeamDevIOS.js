/**
 * Strips entitlements that a free Personal Team cannot provision (or that mismatch
 * auto profiles), so Xcode can install a dev build on device.
 *
 * Set EXPO_IOS_PERSONAL_TEAM=1 before `expo prebuild` / `expo run:ios`.
 */
const { withEntitlementsPlist } = require("expo/config-plugins");

function withPersonalTeamDevIOS(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["com.apple.developer.applesignin"];
    delete cfg.modResults["aps-environment"];
    delete cfg.modResults["com.apple.developer.healthkit"];
    delete cfg.modResults["com.apple.developer.healthkit.background-delivery"];
    return cfg;
  });
}

module.exports = withPersonalTeamDevIOS;
