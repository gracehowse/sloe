/**
 * ENG-1179 — wire the local StoreKit configuration file into the iOS
 * Xcode project so subscription lifecycle can be exercised in Simulator
 * without App Store Connect products being live.
 */
const path = require("node:path");
const fs = require("node:fs");
const { withDangerousMod, withXcodeProject } = require("expo/config-plugins");

const STOREKIT_FILE = "SupprPro.storekit";

function withStoreKitConfiguration(config) {
  config = withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const src = path.join(projectRoot, "storekit", STOREKIT_FILE);
      const destDir = path.join(projectRoot, "ios");
      const dest = path.join(destDir, STOREKIT_FILE);
      if (fs.existsSync(src)) {
        fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(src, dest);
      }
      return cfg;
    },
  ]);

  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    const filePath = STOREKIT_FILE;
    if (!project.hasFile(filePath)) {
      project.addResourceFile(filePath, { target: project.getFirstTarget().uuid });
    }
    return cfg;
  });
}

module.exports = withStoreKitConfiguration;
