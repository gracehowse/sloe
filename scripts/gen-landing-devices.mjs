import sharp from "sharp";
import path from "node:path";

const ROOT = "/Users/graceturner/Suppr-1";
const LANDING = path.join(ROOT, "public/landing");
const OUT = path.join(ROOT, "public/landing/devices");

async function svgToPng(svg) {
  return sharp(Buffer.from(svg)).png().toBuffer();
}

// frameInner = SVG markup for everything that should be drawn, EXCEPT we punch a
// transparent screen hole via a luminance mask (white = visible, black = hole).
async function buildDevice({
  name,
  canvasW,
  canvasH,
  screen,
  screenshot,
  cropTop = 0,
  frameDefs = "",
  frameBody, // SVG drawn content (the device, with screen area painted over — it'll be cut out)
}) {
  // 1. Screenshot -> cover-fit the screen region.
  const shotMeta = await sharp(screenshot).metadata();
  const targetW = screen.w;
  const targetH = screen.h;
  const scale = Math.max(targetW / shotMeta.width, targetH / shotMeta.height);
  const resizedW = Math.round(shotMeta.width * scale);
  const resizedH = Math.round(shotMeta.height * scale);
  const left = Math.round((resizedW - targetW) / 2);
  const top = Math.round(cropTop * (resizedH - targetH));

  const screenImg = await sharp(screenshot)
    .resize(resizedW, resizedH)
    .extract({
      left: Math.max(0, Math.min(left, resizedW - targetW)),
      top: Math.max(0, Math.min(top, resizedH - targetH)),
      width: targetW,
      height: targetH,
    })
    .toBuffer();

  // round the screenshot corners
  const maskSvg = `<svg width="${targetW}" height="${targetH}"><rect width="${targetW}" height="${targetH}" rx="${screen.radius}" ry="${screen.radius}" fill="#fff"/></svg>`;
  const roundedScreen = await sharp(screenImg)
    .composite([{ input: Buffer.from(maskSvg), blend: "dest-in" }])
    .png()
    .toBuffer();

  // 2. Frame SVG with a luminance mask punching out the screen hole.
  const frameSvg = `
<svg width="${canvasW}" height="${canvasH}" viewBox="0 0 ${canvasW} ${canvasH}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    ${frameDefs}
    <mask id="screenHole">
      <rect width="${canvasW}" height="${canvasH}" fill="#fff"/>
      <rect x="${screen.x}" y="${screen.y}" width="${screen.w}" height="${screen.h}" rx="${screen.radius}" ry="${screen.radius}" fill="#000"/>
    </mask>
  </defs>
  <g mask="url(#screenHole)">
    ${frameBody}
  </g>
</svg>`;
  const framePng = await svgToPng(frameSvg);

  // 3. Compose: shadows (already in frame, but masked out under screen — fine),
  // screenshot beneath, frame (with hole) on top.
  const base = sharp({
    create: {
      width: canvasW,
      height: canvasH,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  });

  const composed = await base
    .composite([
      { input: roundedScreen, left: screen.x, top: screen.y },
      { input: framePng, left: 0, top: 0 },
    ])
    .png()
    .toBuffer();

  await sharp(composed).toFile(path.join(OUT, `${name}.png`));
  console.log("wrote", path.join(OUT, `${name}.png`), `${canvasW}x${canvasH}`);
}

// =========================================================================
// MACBOOK
// =========================================================================
async function macbook() {
  const W = 1480;
  const H = 980;
  const lidX = 150;
  const lidY = 36;
  const lidW = W - lidX * 2;
  const lidH = 752;
  const bezel = 15;
  const notchH = 18;
  const screen = {
    x: lidX + bezel,
    y: lidY + bezel,
    w: lidW - bezel * 2,
    h: lidH - bezel * 2,
    radius: 7,
  };
  const baseTopY = lidY + lidH;
  const baseH = 26;
  const baseBottomW = W - 40;
  const baseTopW = lidW + 22;

  const defs = `
    <linearGradient id="aluLid" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e3e5ea"/>
      <stop offset="1" stop-color="#cbced5"/>
    </linearGradient>
    <linearGradient id="bezelG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a1a1f"/>
      <stop offset="1" stop-color="#0a0a0e"/>
    </linearGradient>
    <linearGradient id="deck" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d4d7dd"/>
      <stop offset="0.4" stop-color="#dadce2"/>
      <stop offset="1" stop-color="#b0b4be"/>
    </linearGradient>
    <linearGradient id="deckEdge" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#9da1ab"/>
      <stop offset="1" stop-color="#7c818c"/>
    </linearGradient>`;

  const body = `
  <!-- contact shadow -->
  <ellipse cx="${W / 2}" cy="${baseTopY + baseH + 22}" rx="${baseBottomW / 2 + 24}" ry="20" fill="#221b26" opacity="0.18"/>
  <!-- aluminium lid shell -->
  <rect x="${lidX}" y="${lidY}" width="${lidW}" height="${lidH}" rx="20" fill="url(#aluLid)"/>
  <rect x="${lidX + 0.5}" y="${lidY + 0.5}" width="${lidW - 1}" height="${lidH - 1}" rx="19.5" fill="none" stroke="#bcbfc7" stroke-width="1"/>
  <!-- black bezel face -->
  <rect x="${lidX + 5}" y="${lidY + 5}" width="${lidW - 10}" height="${lidH - 10}" rx="14" fill="url(#bezelG)"/>
  <!-- notch -->
  <rect x="${W / 2 - 66}" y="${lidY + 5}" width="132" height="${notchH}" rx="0" fill="#0a0a0e"/>
  <rect x="${W / 2 - 66}" y="${lidY + 5 + notchH - 9}" width="132" height="9" rx="6" fill="#0a0a0e"/>
  <circle cx="${W / 2}" cy="${lidY + 5 + notchH / 2}" r="3" fill="#16161c"/>
  <!-- hinge gap -->
  <rect x="${lidX + 18}" y="${baseTopY - 3}" width="${lidW - 36}" height="6" fill="#34343a" opacity="0.55"/>
  <!-- deck trapezoid -->
  <path d="M ${(W - baseTopW) / 2} ${baseTopY} L ${(W + baseTopW) / 2} ${baseTopY} L ${(W + baseBottomW) / 2} ${baseTopY + baseH} L ${(W - baseBottomW) / 2} ${baseTopY + baseH} Z" fill="url(#deck)"/>
  <!-- front lip -->
  <rect x="${(W - baseBottomW) / 2}" y="${baseTopY + baseH - 5}" width="${baseBottomW}" height="13" rx="6" fill="url(#deckEdge)"/>
  <!-- magsafe / hinge notch cue -->
  <rect x="${W / 2 - 60}" y="${baseTopY + 6}" width="120" height="6" rx="3" fill="#a6aab3" opacity="0.65"/>`;

  await buildDevice({
    name: "macbook",
    canvasW: W,
    canvasH: H,
    screen,
    screenshot: path.join(LANDING, "mock-web-desktop.png"),
    frameDefs: defs,
    frameBody: body,
  });
}

// =========================================================================
// IPAD
// =========================================================================
async function ipad() {
  const W = 760;
  const H = 1000;
  const r = 54;
  const bezel = 24;
  const screen = { x: bezel, y: bezel, w: W - bezel * 2, h: H - bezel * 2, radius: 30 };

  const defs = `
    <linearGradient id="ipadBody" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#26262b"/>
      <stop offset="0.5" stop-color="#17171b"/>
      <stop offset="1" stop-color="#0d0d10"/>
    </linearGradient>
    <linearGradient id="ipadEdge" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#5a5a62"/>
      <stop offset="0.045" stop-color="#28282d"/>
      <stop offset="0.5" stop-color="#1a1a1e"/>
      <stop offset="0.955" stop-color="#28282d"/>
      <stop offset="1" stop-color="#5a5a62"/>
    </linearGradient>`;
  const body = `
  <ellipse cx="${W / 2}" cy="${H - 6}" rx="${W / 2 - 30}" ry="16" fill="#221b26" opacity="0.16"/>
  <rect x="0" y="0" width="${W}" height="${H}" rx="${r}" fill="url(#ipadEdge)"/>
  <rect x="3" y="3" width="${W - 6}" height="${H - 6}" rx="${r - 3}" fill="url(#ipadBody)"/>
  <circle cx="${W / 2}" cy="${bezel / 2 + 1}" r="4" fill="#0c0c10"/>
  <circle cx="${W / 2}" cy="${bezel / 2 + 1}" r="1.5" fill="#23232a"/>`;

  await buildDevice({
    name: "ipad",
    canvasW: W,
    canvasH: H,
    screen,
    screenshot: path.join(LANDING, "mock-web-tablet.png"),
    frameDefs: defs,
    frameBody: body,
  });
}

// =========================================================================
// IPHONE
// =========================================================================
async function iphone() {
  const W = 470;
  const H = 980;
  const r = 92;
  const bezel = 15;
  const screen = { x: bezel, y: bezel, w: W - bezel * 2, h: H - bezel * 2, radius: r - bezel - 4 };
  const islandW = 116;
  const islandH = 34;

  const defs = `
    <linearGradient id="phoneRail" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#74747c"/>
      <stop offset="0.05" stop-color="#36363c"/>
      <stop offset="0.5" stop-color="#202024"/>
      <stop offset="0.95" stop-color="#36363c"/>
      <stop offset="1" stop-color="#74747c"/>
    </linearGradient>
    <linearGradient id="phoneBody" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#26262c"/>
      <stop offset="0.5" stop-color="#151518"/>
      <stop offset="1" stop-color="#0d0d10"/>
    </linearGradient>`;
  const body = `
  <ellipse cx="${W / 2}" cy="${H - 4}" rx="${W / 2 - 18}" ry="13" fill="#221b26" opacity="0.18"/>
  <rect x="0" y="0" width="${W}" height="${H}" rx="${r}" fill="url(#phoneRail)"/>
  <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="${r - 4}" fill="url(#phoneBody)"/>
  <rect x="${W / 2 - islandW / 2}" y="${bezel + 16}" width="${islandW}" height="${islandH}" rx="${islandH / 2}" fill="#050507"/>
  <circle cx="${W / 2 + islandW / 2 - 17}" cy="${bezel + 16 + islandH / 2}" r="5" fill="#0f1219"/>`;

  await buildDevice({
    name: "iphone",
    canvasW: W,
    canvasH: H,
    screen,
    screenshot: path.join(LANDING, "mock-today.png"),
    frameDefs: defs,
    frameBody: body,
  });
}

// iPhone variant for the "Difference" section (recipe screenshot)
async function iphoneRecipe() {
  const W = 470;
  const H = 980;
  const r = 92;
  const bezel = 15;
  const screen = { x: bezel, y: bezel, w: W - bezel * 2, h: H - bezel * 2, radius: r - bezel - 4 };
  const islandW = 116;
  const islandH = 34;
  const defs = `
    <linearGradient id="phoneRail" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#74747c"/>
      <stop offset="0.05" stop-color="#36363c"/>
      <stop offset="0.5" stop-color="#202024"/>
      <stop offset="0.95" stop-color="#36363c"/>
      <stop offset="1" stop-color="#74747c"/>
    </linearGradient>
    <linearGradient id="phoneBody" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#26262c"/>
      <stop offset="0.5" stop-color="#151518"/>
      <stop offset="1" stop-color="#0d0d10"/>
    </linearGradient>`;
  const body = `
  <ellipse cx="${W / 2}" cy="${H - 4}" rx="${W / 2 - 18}" ry="13" fill="#221b26" opacity="0.18"/>
  <rect x="0" y="0" width="${W}" height="${H}" rx="${r}" fill="url(#phoneRail)"/>
  <rect x="4" y="4" width="${W - 8}" height="${H - 8}" rx="${r - 4}" fill="url(#phoneBody)"/>
  <rect x="${W / 2 - islandW / 2}" y="${bezel + 16}" width="${islandW}" height="${islandH}" rx="${islandH / 2}" fill="#050507"/>
  <circle cx="${W / 2 + islandW / 2 - 17}" cy="${bezel + 16 + islandH / 2}" r="5" fill="#0f1219"/>`;
  await buildDevice({
    name: "iphone-recipe",
    canvasW: W,
    canvasH: H,
    screen,
    screenshot: path.join(LANDING, "mock-recipe.png"),
    frameDefs: defs,
    frameBody: body,
  });
}

async function main() {
  await import("node:fs/promises").then((fs) => fs.mkdir(OUT, { recursive: true }));
  await macbook();
  await ipad();
  await iphone();
  await iphoneRecipe();
  console.log("done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
