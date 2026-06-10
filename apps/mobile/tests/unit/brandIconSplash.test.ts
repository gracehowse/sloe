import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");
const REPO_ROOT = join(ROOT, "../..");

/**
 * The on-disk `apps/mobile/ios/` project is gitignored and regenerated each
 * build (`expo prebuild`) from app.json + the tracked asset PNGs. So the durable
 * contract lives in app.json + assets/images + the brand scripts — those are
 * asserted unconditionally. The generated `ios/` catalog is verified only when
 * present (i.e. on a machine that has built locally), and skipped in CI.
 */
const IOS = join(ROOT, "ios/Suppr");
const hasNativeIos = existsSync(IOS);

/**
 * Parse a PNG's IHDR chunk (no image deps): width/height (big-endian uint32 at
 * bytes 16/20) and colour type (byte 25). Colour type 2 = truecolour (RGB, no
 * alpha); 6 = truecolour + alpha. iOS app icons MUST be opaque (no alpha), so a
 * shipped icon must be colour type 2.
 */
function pngHeader(absPath: string): { width: number; height: number; colorType: number } {
  const buf = readFileSync(absPath);
  expect(buf.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a"); // PNG magic
  expect(buf.subarray(12, 16).toString("ascii")).toBe("IHDR");
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colorType: buf.readUInt8(25),
  };
}

describe("Sloe brand: app icon + name (tracked sources that drive prebuild)", () => {
  it("app.json names the iOS app 'Sloe' but keeps the suppr bundle id / scheme / slug (TM-gated)", () => {
    const appJson = JSON.parse(readFileSync(join(ROOT, "app.json"), "utf8")) as {
      expo: {
        name: string;
        slug: string;
        scheme: string;
        icon: string;
        ios: { bundleIdentifier: string };
      };
    };
    expect(appJson.expo.name).toBe("Sloe");
    // The rename to Sloe is display-only until the trademark gate clears.
    expect(appJson.expo.slug).toBe("suppr");
    expect(appJson.expo.scheme).toBe("suppr");
    expect(appJson.expo.ios.bundleIdentifier).toBe("com.supprclub.supprapp");
    expect(appJson.expo.icon).toBe("./assets/images/icon.png");
  });

  it("the tracked app-icon PNG is 1024×1024 and fully opaque (no alpha) — the previous broken icon had alpha", () => {
    const exported = pngHeader(join(ROOT, "assets/images/icon.png"));
    expect(exported.width).toBe(1024);
    expect(exported.height).toBe(1024);
    expect(exported.colorType).toBe(2); // truecolour, no alpha — survives prebuild as an opaque AppIcon
  });

  it("the tracked splash logos are transparent wordmarks (so the cream/plum field shows through)", () => {
    const light = pngHeader(join(ROOT, "assets/images/splash-icon.png"));
    const dark = pngHeader(join(ROOT, "assets/images/splash-icon-dark.png"));
    expect(light.colorType).toBe(6); // truecolour + alpha
    expect(dark.colorType).toBe(6);
    // Wide wordmark aspect (~1.86:1), not a square — confirms it's the wordmark, not a tile.
    expect(light.width).toBeGreaterThan(light.height);
  });
});

describe("Sloe brand: splash config (app.json drives the native splash on prebuild)", () => {
  it("native splash background is cream (light) / plum (dark) with the wordmark images", () => {
    const appJson = JSON.parse(readFileSync(join(ROOT, "app.json"), "utf8")) as {
      expo: { plugins: unknown[] };
    };
    const splashPlugin = appJson.expo.plugins.find(
      (p) => Array.isArray(p) && p[0] === "expo-splash-screen",
    ) as [string, Record<string, unknown>] | undefined;
    expect(splashPlugin?.[1]?.backgroundColor).toBe("#FBF8F3"); // cream / Oat
    expect(splashPlugin?.[1]?.image).toContain("splash-icon");
    const dark = splashPlugin?.[1]?.dark as Record<string, unknown> | undefined;
    expect(dark?.backgroundColor).toBe("#3B2A4D"); // plum
    expect(dark?.image).toContain("splash-icon-dark");
  });
});

describe("Sloe brand: asset pipeline sources the canonical Fraunces artefacts", () => {
  it("render script reads the approved wordmark-final icon + SVGs (not the old white-bg system font)", () => {
    const render = readFileSync(join(REPO_ROOT, "scripts/render-sloe-brand-png.mjs"), "utf8");
    expect(render).toContain("wordmark-final");
    expect(render).toContain("icon-fraunces-1024.png");
    expect(render).toContain("sloe-fraunces-base.svg");
    expect(render).toContain("sloe-fraunces-base-white.svg");
    // Regression guard: the broken pipeline rendered "Sloe" in Newsreader on white.
    expect(render).not.toContain("Newsreader_400Regular.ttf");
  });

  it("sync script refuses an icon with alpha and writes the cream/plum colorset", () => {
    const sync = readFileSync(join(ROOT, "scripts/sync-ios-brand-assets.mjs"), "utf8");
    expect(sync).toContain("isOpaque");
    expect(sync).toContain("#FBF8F3");
    expect(sync).toContain("#3B2A4D");
    expect(sync).toContain("splash-icon-dark.png");
  });
});

// The generated native catalog is local-only (ios/ is gitignored). Verify the
// sync landed correctly when it exists; skip in CI where there is no ios/.
describe.skipIf(!hasNativeIos)("Sloe brand: generated native iOS catalog (local builds only)", () => {
  it("native Info.plist home-screen label is 'Sloe'", () => {
    const plist = readFileSync(join(IOS, "Info.plist"), "utf8");
    expect(plist).toMatch(/<key>CFBundleDisplayName<\/key>\s*<string>Sloe<\/string>/);
    expect(plist).toContain("$(PRODUCT_BUNDLE_IDENTIFIER)");
  });

  it("native AppIcon is 1024×1024 and opaque (colour type 2)", () => {
    const icon = pngHeader(
      join(IOS, "Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png"),
    );
    expect(icon.width).toBe(1024);
    expect(icon.height).toBe(1024);
    expect(icon.colorType).toBe(2);
  });

  it("native splash colorset is cream (light) / plum (dark)", () => {
    const colorset = JSON.parse(
      readFileSync(join(IOS, "Images.xcassets/SplashScreenBackground.colorset/Contents.json"), "utf8"),
    ) as {
      colors: {
        appearances?: { appearance: string; value: string }[];
        color: { components: { red: string; green: string; blue: string } };
      }[];
    };
    const toHex = (c: { red: string; green: string; blue: string }) =>
      "#" +
      [c.red, c.green, c.blue]
        .map((v) => Math.round(parseFloat(v) * 255).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    const light = colorset.colors.find((c) => !c.appearances);
    const dark = colorset.colors.find((c) => c.appearances?.some((a) => a.value === "dark"));
    expect(light && toHex(light.color.components)).toBe("#FBF8F3");
    expect(dark && toHex(dark.color.components)).toBe("#3B2A4D");
  });

  it("native splash logo imageset is a transparent wordmark (keeps alpha)", () => {
    const light = pngHeader(join(IOS, "Images.xcassets/SplashScreenLogo.imageset/image@3x.png"));
    expect(light.colorType).toBe(6);
    expect(light.width).toBeGreaterThan(light.height);
  });
});
