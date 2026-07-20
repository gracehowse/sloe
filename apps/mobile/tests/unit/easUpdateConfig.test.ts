/**
 * EAS Update wiring pin (decision: 2026-04-30-eas-update-ota.md).
 *
 * OTA depends on three pieces of static config staying in lockstep:
 *   1. `expo-updates` installed at the SDK-aligned version.
 *   2. `app.json` declaring a `runtimeVersion` that matches `version`
 *      (so OTA updates only ship to binaries with the same native
 *      code), `updates.url` pointing at the EAS Update endpoint
 *      for this project's `extra.eas.projectId`, and launch-time
 *      update checks disabled so OTA cannot brick cold start.
 *   3. `eas.json` declaring a `channel` for every build profile so
 *      published updates route to the right binaries.
 *
 * 2026-05-06: previously the pin asserted
 * `runtimeVersion: { policy: "appVersion" }` — the
 * Expo-managed-workflow shape. EAS Build rejected that on this
 * project (bare workflow), so the value is now a literal string
 * matching `expo.version` (e.g. "1.0.7"). The pin asserts the
 * lockstep relationship instead so a careless `version` bump that
 * forgets to bump `runtimeVersion` still fails at CI.
 *
 * If any of these silently drift, users on the affected binaries
 * silently stop receiving OTA updates — and we wouldn't know until
 * someone tried to publish. These tests fail fast at CI time so the
 * regression never ships.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const APP_JSON_PATH = resolve(__dirname, "../../app.json");
const EAS_JSON_PATH = resolve(__dirname, "../../eas.json");
const PACKAGE_JSON_PATH = resolve(__dirname, "../../package.json");
const PACKAGE_LOCK_PATH = resolve(__dirname, "../../package-lock.json");

type AppJson = {
  expo: {
    version: string;
    runtimeVersion?: { policy: string } | string;
    updates?: {
      url?: string;
      fallbackToCacheTimeout?: number;
      checkAutomatically?: string;
      useEmbeddedUpdate?: boolean;
      disableAntiBrickingMeasures?: boolean;
    };
    plugins?: Array<
      | string
      | [
          string,
          {
            ios?: {
              buildReactNativeFromSource?: boolean;
            };
          },
        ]
    >;
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

type PackageLockJson = {
  packages?: Record<
    string,
    {
      version?: string;
      dependencies?: Record<string, string>;
    }
  >;
};

const appJson: AppJson = JSON.parse(readFileSync(APP_JSON_PATH, "utf8"));
const easJson: EasJson = JSON.parse(readFileSync(EAS_JSON_PATH, "utf8"));
const packageJson: PackageJson = JSON.parse(
  readFileSync(PACKAGE_JSON_PATH, "utf8"),
);
const packageLockJson: PackageLockJson = JSON.parse(
  readFileSync(PACKAGE_LOCK_PATH, "utf8"),
);

describe("expo-updates package", () => {
  it("is installed as a runtime dependency", () => {
    // Must be a runtime dep — expo-updates ships native code that
    // expo-cli wires into the iOS/Android build at prebuild time.
    expect(packageJson.dependencies?.["expo-updates"]).toBeDefined();
  });

  it("uses the SDK 54 bugfix tag that supersedes the 29.0.18 launch-crash build", () => {
    expect(packageJson.dependencies?.["expo-updates"]).toBe("~29.0.19");
    expect(
      packageLockJson.packages?.["node_modules/expo-updates"]?.version,
    ).toBe("29.0.19");
  });
});

describe("expo-build-properties package", () => {
  it("is installed so EAS prebuild can resolve the build-properties config plugin", () => {
    expect(packageJson.dependencies?.["expo-build-properties"]).toBe(
      "~1.0.10",
    );
    expect(
      packageLockJson.packages?.["node_modules/expo-build-properties"]
        ?.version,
    ).toBe("1.0.10");
  });
});

describe("Skia native dependency lockstep", () => {
  it("keeps @shopify/react-native-skia package.json and package-lock in exact version lockstep", () => {
    // Skia ships native code. A JS-only bump can crash the Today hero ring
    // on devices whose native binary still has an older Skia pod compiled in
    // (ENG-1206), so dependency bumps must be tied to a native rebuild and
    // committed with a lockfile that resolves the same exact version.
    const declaredVersion =
      packageJson.dependencies?.["@shopify/react-native-skia"];
    const lockRootVersion =
      packageLockJson.packages?.[""]?.dependencies?.[
        "@shopify/react-native-skia"
      ];
    const installedVersion =
      packageLockJson.packages?.["node_modules/@shopify/react-native-skia"]
        ?.version;

    expect(declaredVersion).toBeDefined();
    expect(declaredVersion).not.toMatch(/^[~^]/);
    expect(lockRootVersion).toBe(declaredVersion);
    expect(installedVersion).toBe(declaredVersion);
  });
});

describe("app.json — runtimeVersion", () => {
  it("is a literal string that matches expo.version (bare-workflow appVersion equivalent)", () => {
    // Bare-workflow EAS Build rejects `{ policy: "appVersion" }`, so
    // the value must be a literal string. We pin "string equal to
    // expo.version" to preserve the original intent of the
    // appVersion policy: an OTA update only ships to a binary whose
    // `expo.version` matches the `runtimeVersion` at the time of
    // publish. Bumping native code → bump expo.version → bump
    // runtimeVersion → old binaries automatically refuse stale-
    // incompatible updates.
    expect(typeof appJson.expo.runtimeVersion).toBe("string");
    expect(appJson.expo.runtimeVersion).toBe(appJson.expo.version);
  });
});

describe("app.json — updates block", () => {
  it("declares an updates.url that targets the project's EAS Update endpoint", () => {
    const projectId = appJson.expo.extra?.eas?.projectId;
    expect(projectId).toBeTruthy();
    expect(appJson.expo.updates?.url).toBe(`https://u.expo.dev/${projectId}`);
  });

  it("sets fallbackToCacheTimeout to 0 (never block cold start on network)", () => {
    // Anything > 0 makes the splash hang while EAS is reachable but
    // slow. Cached bundle should serve immediately; new bundle applies
    // on next launch.
    expect(appJson.expo.updates?.fallbackToCacheTimeout).toBe(0);
  });

  it("only auto-checks for updates during error recovery, never on cold launch", () => {
    // ENG-1564: ON_LOAD can attempt a relaunch before first render and made a
    // bad OTA / corrupt embedded update able to hard-crash every launch.
    expect(appJson.expo.updates?.checkAutomatically).toBe("ON_ERROR_RECOVERY");
  });

  it("keeps the embedded update and anti-bricking fallback enabled", () => {
    expect(appJson.expo.updates?.useEmbeddedUpdate).toBe(true);
    expect(appJson.expo.updates?.disableAntiBrickingMeasures).toBe(false);
  });
});

describe("app.json — iOS native build hardening", () => {
  it("builds React Native from source on iOS to avoid stale prebuilt RN/Hermes skew", () => {
    const buildPropertiesPlugin = appJson.expo.plugins?.find(
      (plugin) =>
        Array.isArray(plugin) && plugin[0] === "expo-build-properties",
    );

    expect(buildPropertiesPlugin).toBeTruthy();
    expect(
      Array.isArray(buildPropertiesPlugin)
        ? buildPropertiesPlugin[1]?.ios?.buildReactNativeFromSource
        : undefined,
    ).toBe(true);
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
