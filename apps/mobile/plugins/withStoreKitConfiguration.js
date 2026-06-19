/**
 * ENG-1179 — wire the local StoreKit configuration file into the iOS
 * Xcode project so subscription lifecycle can be exercised in Simulator
 * without App Store Connect products being live.
 */
const path = require("node:path");
const fs = require("node:fs");
const { withDangerousMod, withXcodeProject } = require("expo/config-plugins");

const STOREKIT_FILE = "Suppr.storekit";
const STOREKIT_SOURCE_DIR = "storekit";

function patchSchemeFile(schemePath) {
  if (!fs.existsSync(schemePath)) return;
  let xml = fs.readFileSync(schemePath, "utf8");
  if (xml.includes("StoreKitConfigurationFileReference")) {
    xml = xml.replace(
      /<StoreKitConfigurationFileReference[\s\S]*?\/>/,
      '<StoreKitConfigurationFileReference identifier="../../Suppr.storekit" />',
    );
  } else {
    xml = xml.replace(
      /(<LaunchAction\b[^>]*>)/,
      '$1\n      <StoreKitConfigurationFileReference identifier="../../Suppr.storekit" />',
    );
  }
  fs.writeFileSync(schemePath, xml);
}

function patchStoreKitScheme(projectRoot) {
  const schemeDir = path.join(
    projectRoot,
    "ios",
    "Suppr.xcodeproj",
    "xcshareddata",
    "xcschemes",
  );
  fs.mkdirSync(schemeDir, { recursive: true });
  const schemePath = path.join(schemeDir, "Suppr.xcscheme");
  if (!fs.existsSync(schemePath)) {
    fs.writeFileSync(
      schemePath,
      `<?xml version="1.0" encoding="UTF-8"?>\n<Scheme LastUpgradeVersion="1600" version="1.7">\n  <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.DebuggerFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" debugServiceExtension="internal" allowLocationSimulation="YES">\n    <StoreKitConfigurationFileReference identifier="../../Suppr.storekit" />\n  </LaunchAction>\n</Scheme>\n`,
    );
    return;
  }
  patchSchemeFile(schemePath);
}

function withStoreKitConfiguration(config) {
  config = withDangerousMod(config, [
    "ios",
    async (cfg) => {
      const projectRoot = cfg.modRequest.projectRoot;
      const src = path.join(projectRoot, STOREKIT_SOURCE_DIR, STOREKIT_FILE);
      const destDir = path.join(projectRoot, "ios");
      const dest = path.join(destDir, STOREKIT_FILE);
      if (fs.existsSync(src)) {
        fs.mkdirSync(destDir, { recursive: true });
        fs.copyFileSync(src, dest);
      }
      patchStoreKitScheme(projectRoot);
      return cfg;
    },
  ]);

  return withXcodeProject(config, (cfg) => {
    const project = cfg.modResults;
    if (!project.hasFile(STOREKIT_FILE)) {
      project.addResourceFile(STOREKIT_FILE, { target: project.getFirstTarget().uuid });
    }
    return cfg;
  });
}

module.exports = withStoreKitConfiguration;
