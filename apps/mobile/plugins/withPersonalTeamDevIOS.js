/**
 * Strips entitlements that require a paid Apple Developer Program membership.
 * Use when provisioning with a personal (free) team for device installs.
 *
 * Set EXPO_IOS_PERSONAL_TEAM=1 before `expo prebuild` / `expo run:ios`.
 */
const { withEntitlementsPlist } = require("expo/config-plugins");

function withPersonalTeamDevIOS(config) {
  return withEntitlementsPlist(config, (cfg) => {
    delete cfg.modResults["com.apple.developer.applesignin"];
    delete cfg.modResults["aps-environment"];
    return cfg;
  });
}

module.exports = withPersonalTeamDevIOS;
