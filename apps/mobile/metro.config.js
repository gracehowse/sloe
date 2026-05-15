const path = require("path");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

const projectRoot = __dirname;

// `getSentryExpoConfig` is a drop-in for `getDefaultConfig` that adds the
// Sentry serializer so source-maps + debug IDs are emitted on EAS builds.
// Without it, prod stack traces on TestFlight / App Store stay minified.
// See docs/decisions/2026-05-15-sentry-nextjs-sdk-alignment.md (mobile leg).
/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(projectRoot);

// Watch ../../src so the mobile app can import shared nutrition/analytics
// code via ../../../src/*. Deliberately NOT watching the whole monorepo root
// — its node_modules is excluded from EAS Build uploads (.easignore) and
// Metro's implicit root-node_modules check would fail with ENOENT. Keeping
// default hierarchical module resolution so Metro can find nested deps like
// react-native/node_modules/@react-native/virtualized-lists.
config.watchFolders = [
  ...(config.watchFolders ?? []),
  path.resolve(projectRoot, "../../src"),
];

module.exports = config;
