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
    // Project/scheme name follows app.json `name` ("Sloe"); was "Suppr"
    // pre-rebrand. Bundle id + URL scheme stay "suppr".
    "Sloe.xcodeproj",
    "xcshareddata",
    "xcschemes",
  );
  fs.mkdirSync(schemeDir, { recursive: true });
  const schemePath = path.join(schemeDir, "Sloe.xcscheme");
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
    try {
      if (!project.hasFile(STOREKIT_FILE)) {
        project.addResourceFile(STOREKIT_FILE, { target: project.getFirstTarget().uuid });
      }
    } catch (err) {
      // `xcode`'s addResourceFile throws "Cannot read properties of null
      // (reading 'path')" on a freshly-generated project whose Resources build
      // phase group has no path (lib incompatibility, surfaced after the
      // Suppr→Sloe project rename + a clean prebuild). NON-FATAL: the StoreKit
      // config the Simulator actually uses is wired via the scheme's
      // <StoreKitConfigurationFileReference> in patchStoreKitScheme above; the
      // resource entry only affects Xcode-UI visibility. (Tracked: ENG-1225.)
      console.warn(
        `[withStoreKitConfiguration] skipped addResourceFile (scheme reference still applied): ${err.message}`,
      );
    }
    return cfg;
  });
}

module.exports = withStoreKitConfiguration;
