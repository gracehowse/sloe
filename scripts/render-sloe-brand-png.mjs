#!/usr/bin/env node
/**
 * Renders the canonical Sloe brand assets (app icon + splash wordmark) from the
 * APPROVED design artefacts under docs/brand/sloe/assets/gen/wordmark-final/:
 *
 *   - icon-fraunces-1024.png  → the chosen home-screen icon: white "sloe"
 *     (Fraunces) on the plum gradient field. Flattened to fully opaque here
 *     (iOS app icons must have no alpha; the baked rounded corners are filled
 *     with the gradient so iOS can apply its own superellipse mask cleanly).
 *   - sloe-fraunces-base.svg        → plum "sloe" wordmark (light splash logo)
 *   - sloe-fraunces-base-white.svg  → white "sloe" wordmark (dark splash logo)
 *
 * The splash logos are TRANSPARENT wordmarks (no baked background). The cream /
 * plum background comes from the expo-splash-screen config + native colorset,
 * so the wordmark sits directly on the screen colour (matches the splash mock
 * at docs/brand/sloe/assets/gen/wordmark-system/splash.png).
 *
 * Run:  node scripts/render-sloe-brand-png.mjs
 * Then: npm run sync-ios-brand --prefix apps/mobile   (copies into ios/ catalog)
 * Or both at once: npm run build:brand-icons
 *
 * Android adaptive-icon assets (android-icon-*.png) are intentionally NOT
 * regenerated here — the app ships iOS-only (Android config is vestigial Expo
 * template, never built). See project_ios_only_no_android.
 */
import { spawnSync } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WORDMARK_FINAL = path.join(ROOT, "docs/brand/sloe/assets/gen/wordmark-final");
const SRC_ICON = path.join(WORDMARK_FINAL, "icon-fraunces-1024.png");
const SRC_WORDMARK_PLUM = path.join(WORDMARK_FINAL, "sloe-fraunces-base.svg");
const SRC_WORDMARK_WHITE = path.join(WORDMARK_FINAL, "sloe-fraunces-base-white.svg");

const MOBILE = path.join(ROOT, "apps/mobile/assets/images");

const CREAM = "#FBF8F3"; // light splash background

/** Flatten the canonical icon to a fully-opaque 1024² PNG (no alpha). */
async function renderIcon(outPath) {
  const { data, info } = await sharp(SRC_ICON)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  // Force every pixel opaque; RGB (the plum gradient) is left untouched, so the
  // baked rounded-corner pixels keep the gradient colour instead of going black.
  for (let i = 0; i < data.length; i += channels) {
    data[i + 3] = 255;
  }
  await sharp(data, { raw: { width, height, channels } }).removeAlpha().png().toFile(outPath);
  const stats = await sharp(outPath).stats();
  if (!stats.isOpaque) {
    throw new Error(`Icon ${outPath} is not opaque — iOS will reject it.`);
  }
  console.log(`  ✓ ${path.relative(ROOT, outPath)} (1024², opaque)`);
}

/**
 * Render an SVG wordmark to a transparent PNG at a given pixel width, preserving
 * the wordmark's natural aspect ratio. These scale(1,-1)-flipped path SVGs are
 * rendered right-side up by rsvg-convert (sharp's librsvg flips them), so we
 * shell out to rsvg-convert, which is already a repo dependency.
 */
function renderWordmark(srcSvg, outPath, widthPx) {
  const res = spawnSync("rsvg-convert", ["-w", String(widthPx), srcSvg, "-o", outPath], {
    stdio: ["ignore", "ignore", "inherit"],
  });
  if (res.status !== 0) {
    throw new Error(`rsvg-convert failed for ${srcSvg} (exit ${res.status})`);
  }
}

async function main() {
  for (const f of [SRC_ICON, SRC_WORDMARK_PLUM, SRC_WORDMARK_WHITE]) {
    await fs.access(f);
  }
  await fs.mkdir(MOBILE, { recursive: true });

  console.log("App icon (Fraunces, plum gradient, opaque)…");
  await renderIcon(path.join(MOBILE, "icon.png"));

  console.log("Splash wordmarks (transparent, natural aspect)…");
  // 1280px-wide master ≈ 6.4× the 200pt logical splash width — sharp on iOS @3x.
  renderWordmark(SRC_WORDMARK_PLUM, path.join(MOBILE, "splash-icon.png"), 1280);
  console.log(`  ✓ ${path.relative(ROOT, path.join(MOBILE, "splash-icon.png"))} (plum, light)`);
  renderWordmark(SRC_WORDMARK_WHITE, path.join(MOBILE, "splash-icon-dark.png"), 1280);
  console.log(`  ✓ ${path.relative(ROOT, path.join(MOBILE, "splash-icon-dark.png"))} (white, dark)`);

  console.log("Favicon (plum wordmark on cream)…");
  // Render the wordmark into a 152px-wide transparent strip, centre it on a 192²
  // cream square, then downscale to 48² — keeps the favicon legible + on-brand.
  const faviconWm = await sharp(path.join(MOBILE, "splash-icon.png"))
    .resize(152, null, { fit: "inside" })
    .png()
    .toBuffer();
  const faviconCream = await sharp({
    create: { width: 192, height: 192, channels: 4, background: CREAM },
  })
    .png()
    .toBuffer();
  const faviconComposited = await sharp(faviconCream)
    .composite([{ input: faviconWm, gravity: "center" }])
    .png()
    .toBuffer();
  await sharp(faviconComposited).resize(48, 48).png().toFile(path.join(MOBILE, "favicon.png"));
  console.log(`  ✓ ${path.relative(ROOT, path.join(MOBILE, "favicon.png"))} (48²)`);

  console.log(
    `\nDone. Sources: ${path.relative(ROOT, WORDMARK_FINAL)}.\n` +
      "Next: npm run sync-ios-brand --prefix apps/mobile",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
