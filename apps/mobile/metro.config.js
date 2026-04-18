const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

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
