/**
 * EAS Update wiring pin (decision: 2026-04-30-eas-update-ota.md).
 *
 * OTA depends on three pieces of static config staying in lockstep:
 *   1. `expo-updates` installed at the SDK-aligned version.
 *   2. `app.json` declaring `runtimeVersion.policy: "appVersion"` and
 *      `updates.url` pointing at the EAS Update endpoint for this
 *      project's `extra.eas.projectId`.
 *   3. `eas.json` declaring a `channel` for every build profile so
 *      published updates route to the right binaries.
 *
 * If any of these silently drift (e.g. a careless edit removes
 * `runtimeVersion`), users on the affected binaries silently stop
 * receiving OTA updates — and we wouldn't know until someone tried to
 * publish. These tests fail fast at CI time so the regression never
 * ships.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const APP_JSON_PATH = resolve(__dirname, "../../app.json");
const EAS_JSON_PATH = resolve(__dirname, "../../eas.json");
const PACKAGE_JSON_PATH = resolve(__dirname, "../../package.json");

type AppJson = {
  expo: {
    version: string;
    runtimeVersion?: { policy: string } | string;
    updates?: {
      url?: string;
      fallbackToCacheTimeout?: number;
      checkAutomatically?: string;
    };
    extra?: {
      eas?: {
        projectId?: string;
      };
    };
  };
};

type EasJson = {
  build: {
    [profile: string]: {
      channel?: string;
      [key: string]: unknown;
    };
  };
};

type PackageJson = {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

const appJson: AppJson = JSON.parse(readFileSync(APP_JSON_PATH, "utf8"));
const easJson: EasJson = JSON.parse(readFileSync(EAS_JSON_PATH, "utf8"));
const packageJson: PackageJson = JSON.parse(
  readFileSync(PACKAGE_JSON_PATH, "utf8"),
);

describe("expo-updates package", () => {
  it("is installed as a runtime dependency", () => {
    // Must be a runtime dep — expo-updates ships native code that
    // expo-cli wires into the iOS/Android build at prebuild time.
    expect(packageJson.dependencies?.["expo-updates"]).toBeDefined();
  });
});

describe("app.json — runtimeVersion", () => {
  it("uses the appVersion policy", () => {
    // appVersion is the safe default: an OTA update only ships to a
    // binary whose `expo.version` matches the `runtimeVersion` at the
    // time of publish. Bumping native code → bump expo.version → old
    // binaries automatically refuse stale-incompatible updates.
    expect(appJson.expo.runtimeVersion).toEqual({ policy: "appVersion" });
  });
});

describe("app.json — updates block", () => {
  it("declares an updates.url that targets the project's EAS Update endpoint", () => {
    const projectId = appJson.expo.extra?.eas?.projectId;
    expect(projectId).toBeTruthy();
    expect(appJson.expo.updates?.url).toBe(
      `https://u.expo.dev/${projectId}`,
    );
  });

  it("sets fallbackToCacheTimeout to 0 (never block cold start on network)", () => {
    // Anything > 0 makes the splash hang while EAS is reachable but
    // slow. Cached bundle should serve immediately; new bundle applies
    // on next launch.
    expect(appJson.expo.updates?.fallbackToCacheTimeout).toBe(0);
  });

  it("sets checkAutomatically to ON_LOAD", () => {
    // Default, but explicit. Every cold launch checks for an update.
    expect(appJson.expo.updates?.checkAutomatically).toBe("ON_LOAD");
  });
});

describe("eas.json — channel routing", () => {
  it("declares a channel on every build profile", () => {
    // Channels are how EAS Update routes a publish to the right binary.
    // A profile without `channel` cannot receive OTA updates at all.
    const profiles = Object.keys(easJson.build);
    expect(profiles.length).toBeGreaterThan(0);
    for (const name of profiles) {
      expect(
        easJson.build[name]?.channel,
        `eas.json build.${name}.channel is missing`,
      ).toBeTruthy();
    }
  });

  it("uses the canonical channel names: development, preview, production", () => {
    // Channel names are public — `eas update --branch <name>` must
    // match. Renaming requires coordinating with operations docs at
    // docs/operations/eas-update-workflow.md.
    expect(easJson.build.development?.channel).toBe("development");
    expect(easJson.build.preview?.channel).toBe("preview");
    expect(easJson.build.production?.channel).toBe("production");
  });
});
