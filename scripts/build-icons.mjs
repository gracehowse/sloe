#!/usr/bin/env node
/**
 * Renders icon PNGs: Sloe mobile assets via Newsreader TTF, legacy web Suppr marks unchanged.
 *
 * Run: node scripts/build-icons.mjs
 * Then: npm run sync-ios-brand --prefix apps/mobile
 */
import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const LEGACY_WEB_MARK_SVG = path.join(PUBLIC_DIR, "suppr-mark.svg");
const BRAND_BLUE = "#4c6ce0";

const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="${BRAND_BLUE}"/>
  <g transform="translate(512 512) scale(0.72) translate(-512 -512)">
    <path d="M 619 320 L 405 320 Q 299 320 299 427 Q 299 512 405 512 L 619 512 Q 725 512 725 619 Q 725 704 619 704 L 405 704"
      fill="none" stroke="#ffffff" stroke-width="88" stroke-linecap="round" stroke-linejoin="round"/>
  </g>
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

function runNode(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script], { stdio: "inherit", cwd: ROOT });
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${script} exited ${code}`))));
  });
}

async function main() {
  const hasLegacyWeb = await fs
    .access(LEGACY_WEB_MARK_SVG)
    .then(() => true)
    .catch(() => false);

  if (hasLegacyWeb) {
    console.log("Rendering legacy web Suppr marks…");
    await render(LEGACY_WEB_MARK_SVG, path.join(PUBLIC_DIR, "icon-192.png"), 192);
    await render(LEGACY_WEB_MARK_SVG, path.join(PUBLIC_DIR, "icon-512.png"), 512);
    await render(LEGACY_WEB_MARK_SVG, path.join(PUBLIC_DIR, "apple-touch-icon.png"), 180);
    await render(MASKABLE_SVG, path.join(PUBLIC_DIR, "icon-maskable-512.png"), 512);
  }

  await runNode(path.join(ROOT, "scripts/render-sloe-brand-png.mjs"));
  console.log("\nDone. Sync native iOS: npm run sync-ios-brand --prefix apps/mobile");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
