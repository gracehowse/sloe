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

// ENG-551 (2026-05-16) — `@suppr/shared/*` alias mirrors the
// tsconfig path mapping so Metro resolves the same way the TS
// compiler does. Before this, mobile files reached into the shared
// `src/lib` tree via long `../../../../src/lib/...` chains (375
// import statements across the mobile tree) — brittle on any move
// and inconsistent with the `@/` alias used everywhere else in
// mobile. Both resolvers (tsserver + Metro + vitest) must agree on
// the mapping or builds and editor jump-to-definition diverge.
config.resolver = {
  ...(config.resolver ?? {}),
  extraNodeModules: {
    ...((config.resolver && config.resolver.extraNodeModules) || {}),
    "@suppr/shared": path.resolve(projectRoot, "../../src/lib"),
  },
};

module.exports = config;
