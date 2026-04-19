#!/usr/bin/env node
/**
 * Renders every PNG icon asset from the master SVG marks in /public.
 *
 * Source of truth:
 *   public/suppr-mark.svg       — full mark (blue squircle + white S)
 *   public/suppr-mark-mono.svg  — white S only, transparent
 *
 * Run with: node scripts/build-icons.mjs
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const MOBILE_ASSETS = path.join(ROOT, "apps/mobile/assets/images");

const BRAND_BLUE = "#4c6ce0";

const MARK_SVG = path.join(PUBLIC_DIR, "suppr-mark.svg");
const MONO_SVG = path.join(PUBLIC_DIR, "suppr-mark-mono.svg");

// Maskable icon: full-bleed blue background, white S inside safe zone.
// Web manifest maskable purpose needs ≥40% radius clear around the logo.
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="${BRAND_BLUE}"/>
  <g transform="translate(512 512) scale(0.72) translate(-512 -512)">
    <path d="M 619 320 L 405 320 Q 299 320 299 427 Q 299 512 405 512 L 619 512 Q 725 512 725 619 Q 725 704 619 704 L 405 704"
      fill="none" stroke="#ffffff" stroke-width="88" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
</svg>`;

// Android adaptive background: solid brand blue full-bleed square.
const ANDROID_BG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="${BRAND_BLUE}"/>
</svg>`;

async function render(svgInput, outPath, size) {
  const buffer =
    typeof svgInput === "string" && svgInput.trimStart().startsWith("<")
      ? Buffer.from(svgInput)
      : await fs.readFile(svgInput);
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await sharp(buffer, { density: 384 }).resize(size, size).png().toFile(outPath);
  console.log(`  ✓ ${path.relative(ROOT, outPath)} (${size}×${size})`);
}

async function main() {
  console.log("Rendering web icons…");
  await render(MARK_SVG, path.join(PUBLIC_DIR, "icon-192.png"), 192);
  await render(MARK_SVG, path.join(PUBLIC_DIR, "icon-512.png"), 512);
  await render(MARK_SVG, path.join(PUBLIC_DIR, "apple-touch-icon.png"), 180);
  await render(MASKABLE_SVG, path.join(PUBLIC_DIR, "icon-maskable-512.png"), 512);

  console.log("Rendering mobile icons…");
  await render(MARK_SVG, path.join(MOBILE_ASSETS, "icon.png"), 1024);
  await render(MARK_SVG, path.join(MOBILE_ASSETS, "favicon.png"), 48);
  await render(MONO_SVG, path.join(MOBILE_ASSETS, "splash-icon.png"), 512);
  await render(MONO_SVG, path.join(MOBILE_ASSETS, "android-icon-foreground.png"), 1024);
  await render(ANDROID_BG_SVG, path.join(MOBILE_ASSETS, "android-icon-background.png"), 1024);
  await render(MONO_SVG, path.join(MOBILE_ASSETS, "android-icon-monochrome.png"), 1024);

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
