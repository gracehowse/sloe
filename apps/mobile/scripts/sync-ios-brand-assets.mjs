#!/usr/bin/env node
/**
 * Copies the canonical Sloe brand PNGs from apps/mobile/assets into the
 * committed ios/ Images.xcassets (AppIcon + SplashScreenLogo + the splash
 * background colorset). The repo's iOS project is bare/prebuilt — these native
 * catalog files are what actually ship; app.json icon/splash config only takes
 * effect on a fresh `expo prebuild`, which we deliberately avoid here.
 *
 * Run after `node scripts/render-sloe-brand-png.mjs` (or use the combined
 * `npm run build:brand-icons` from the repo root), then rebuild the dev client:
 *
 *   npm run sync-ios-brand --prefix apps/mobile
 *   npm run ios:simulator --prefix apps/mobile
 *
 * Splash design (matches docs/brand/sloe/assets/gen/wordmark-system/splash.png):
 *   - logo  = TRANSPARENT "sloe" wordmark (plum on light, white on dark)
 *   - bg    = cream #FBF8F3 (light) / plum #3B2A4D (dark) via the colorset
 * The logo PNGs carry no background; the colorset supplies the screen colour.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSETS = path.join(ROOT, "assets/images");
const XC = path.join(ROOT, "ios/Suppr/Images.xcassets");
const APP_ICON = path.join(XC, "AppIcon.appiconset/App-Icon-1024x1024@1x.png");
const SPLASH_SET = path.join(XC, "SplashScreenLogo.imageset");
const SPLASH_BG = path.join(XC, "SplashScreenBackground.colorset/Contents.json");

const SRC_ICON = path.join(ASSETS, "icon.png");
const SRC_SPLASH = path.join(ASSETS, "splash-icon.png"); // plum wordmark, transparent
const SRC_SPLASH_DARK = path.join(ASSETS, "splash-icon-dark.png"); // white wordmark, transparent

const CREAM = "#FBF8F3"; // light splash background
const PLUM = "#3B2A4D"; // dark splash background

/** Matches expo-splash-screen `imageWidth` in app.json (logical pt). */
const SPLASH_LOGICAL_WIDTH = 200;

function rgb(hex) {
  const h = hex.replace("#", "");
  return {
    red: (parseInt(h.slice(0, 2), 16) / 255).toFixed(3),
    green: (parseInt(h.slice(2, 4), 16) / 255).toFixed(3),
    blue: (parseInt(h.slice(4, 6), 16) / 255).toFixed(3),
    alpha: "1.000",
  };
}

/** Resize a transparent wordmark to a given logical width, preserving aspect + alpha. */
async function splashLogoPng(src, outPath, widthPx) {
  await sharp(src)
    .resize(widthPx, null, { fit: "inside", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(outPath);
  const meta = await sharp(outPath).metadata();
  console.log(`  ✓ ${path.relative(ROOT, outPath)} (${meta.width}×${meta.height})`);
}

async function writeSplashBackground() {
  const payload = {
    colors: [
      { color: { components: rgb(CREAM), "color-space": "srgb" }, idiom: "universal" },
      {
        color: { components: rgb(PLUM), "color-space": "srgb" },
        idiom: "universal",
        appearances: [{ appearance: "luminosity", value: "dark" }],
      },
    ],
    info: { version: 1, author: "expo" },
  };
  await fs.writeFile(SPLASH_BG, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`  ✓ ${path.relative(ROOT, SPLASH_BG)} (cream / plum)`);
}

async function main() {
  for (const f of [SRC_ICON, SRC_SPLASH, SRC_SPLASH_DARK]) {
    await fs.access(f);
  }
  await fs.access(path.join(ROOT, "ios/Suppr"));

  // App icon must be fully opaque (no alpha) — iOS rejects icons with alpha.
  const iconStats = await sharp(SRC_ICON).stats();
  if (!iconStats.isOpaque) {
    throw new Error(`${SRC_ICON} has alpha — run scripts/render-sloe-brand-png.mjs to flatten it.`);
  }

  console.log("App icon (home screen)…");
  await fs.copyFile(SRC_ICON, APP_ICON);
  console.log(`  ✓ ${path.relative(ROOT, APP_ICON)}`);

  console.log("Splash logo (native launch — transparent wordmark)…");
  const scales = [
    ["image.png", 1, false],
    ["image@2x.png", 2, false],
    ["image@3x.png", 3, false],
    ["dark_image.png", 1, true],
    ["dark_image@2x.png", 2, true],
    ["dark_image@3x.png", 3, true],
  ];
  for (const [outName, scale, isDark] of scales) {
    await splashLogoPng(
      isDark ? SRC_SPLASH_DARK : SRC_SPLASH,
      path.join(SPLASH_SET, outName),
      SPLASH_LOGICAL_WIDTH * scale,
    );
  }

  console.log("Splash background colour…");
  await writeSplashBackground();

  console.log("\nNative assets synced. Rebuild the iOS app (simulator or device) to pick up the new icon + splash.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
