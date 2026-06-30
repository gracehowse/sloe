/**
 * ENG-1273 — primary INK as small text on the dark card/page (NO tint) WCAG AA
 * census. The on-card / ghost-link sibling class of ENG-828.
 *
 * ENG-828 fixed `text-primary` co-located with a `bg-primary/N` tint fill
 * (chips / badges / pills). Its scope-boundary explicitly carved out the LARGER
 * class — `text-primary` / `accent.primary` used as small text directly on the
 * dark CARD or PAGE (no tint): ghost-link CTAs, credit lines, inline links,
 * data values. `--primary` is the OLED-lifted FILL hue `#7E5C92` in dark, which
 * reads only ~3.08:1 on the dark card `#211A2A` and ~3.50:1 on the dark page
 * `#120D18` — both WCAG AA-normal FAILS. (See
 * docs/decisions/2026-06-29-eng828-primary-tint-text-contrast.md, "Scope
 * boundary".)
 *
 * The fix is identical in spirit to ENG-828: ink with the AA-safe
 * `text-primary-solid` → `--primary-solid` (`#3B2A4D` light / `#C4ACD0` dark).
 * Light is a pixel-identical no-op (`--primary` === `--primary-solid` in
 * `:root`); dark lifts the text to ~8.15:1 on the card / ~9.6:1 on the page.
 *
 * This guard computes real WCAG 2.x ratios off `src/styles/theme.css` and the
 * mobile `apps/mobile/constants/theme.ts`, asserts the bare-fill on-card
 * failure + the `-solid` pass in BOTH schemes, pins web↔mobile token parity,
 * and pins canonical ghost-link / on-card call sites so the class can't
 * silently regress back to the bare fill hue. Mirrors the
 * `eng828PrimaryTintContrastCensus` pattern.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const THEME_CSS = readFileSync(resolve(ROOT, "src/styles/theme.css"), "utf8");
const MOBILE_THEME = readFileSync(
  resolve(ROOT, "apps/mobile/constants/theme.ts"),
  "utf8",
);

// Canonical on-card / ghost-link call sites (web).
const WEB_TERMS = readFileSync(resolve(ROOT, "app/terms/page.tsx"), "utf8");
const WEB_LICENCES = readFileSync(resolve(ROOT, "app/licences/page.tsx"), "utf8");
const WEB_HOUSEHOLD_BAR = readFileSync(
  resolve(ROOT, "src/app/components/HouseholdBar.tsx"),
  "utf8",
);

// Canonical on-card / link call sites (mobile).
const MOBILE_IMPORT_SHARED = readFileSync(
  resolve(ROOT, "apps/mobile/app/import-shared.tsx"),
  "utf8",
);
const MOBILE_RECIPE_DETAIL = readFileSync(
  resolve(ROOT, "apps/mobile/app/recipe/[id].tsx"),
  "utf8",
);
const MOBILE_TODAY_SCREEN = readFileSync(
  resolve(ROOT, "apps/mobile/app/(tabs)/_today/TodayScreen.tsx"),
  "utf8",
);

const AA_NORMAL = 4.5;

type RGB = [number, number, number];

function block(selector: ":root" | ".dark"): string {
  const needle = selector === ":root" ? ":root {" : "\n.dark {";
  const idx = THEME_CSS.indexOf(needle);
  const open = THEME_CSS.indexOf("{", idx);
  let depth = 1;
  let i = open + 1;
  while (i < THEME_CSS.length && depth > 0) {
    const ch = THEME_CSS[i];
    if (ch === "{") depth += 1;
    else if (ch === "}") depth -= 1;
    i += 1;
  }
  return THEME_CSS.slice(open + 1, i - 1);
}

function readCssVar(blockSrc: string, name: string): string {
  const m = blockSrc.match(new RegExp(`--${name}:\\s*([^;]+);`));
  expect(m, `--${name}`).not.toBeNull();
  let value = m![1].trim().toLowerCase();
  const varRef = value.match(/^var\(--([^)]+)\)$/);
  if (varRef) value = readCssVar(blockSrc, varRef[1]);
  return value;
}

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: RGB): number {
  const lin = (c8: number) => {
    const c = c8 / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a: string, b: string): number {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(hexToRgb(b));
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

function readMobile(key: string): string {
  const start = MOBILE_THEME.indexOf("export const Accent");
  expect(start, "Accent literal").toBeGreaterThanOrEqual(0);
  const slice = MOBILE_THEME.slice(start, start + 2500);
  const m = slice.match(new RegExp(`\\b${key}:\\s*'([^']+)'`));
  expect(m, `Accent.${key}`).not.toBeNull();
  return m![1].toLowerCase();
}

describe("ENG-1273 — WHY the fix exists: bare primary ink fails on the dark card/page", () => {
  it("light: `text-primary` (deep-plum fill) passes AA as small text on the card AND page", () => {
    const light = block(":root");
    const ink = readCssVar(light, "primary");
    const card = readCssVar(light, "card");
    const bg = readCssVar(light, "background");
    expect(ratio(ink, card), "light text-primary on card").toBeGreaterThanOrEqual(AA_NORMAL);
    expect(ratio(ink, bg), "light text-primary on page").toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("dark: bare `text-primary` (lifted fill #7E5C92) FAILS AA on the card AND page — the regression class", () => {
    const dark = block(".dark");
    const ink = readCssVar(dark, "primary"); // #7e5c92 lifted FILL
    const card = readCssVar(dark, "card"); // #211a2a
    const bg = readCssVar(dark, "background"); // #120d18
    // Documents the defect ENG-828's scope-boundary flagged: ~3.08:1 / ~3.50:1.
    expect(ratio(ink, card), "dark text-primary on card").toBeLessThan(AA_NORMAL);
    expect(ratio(ink, bg), "dark text-primary on page").toBeLessThan(AA_NORMAL);
  });
});

describe("ENG-1273 — the fix: `text-primary-solid` clears AA on the card AND page in BOTH schemes", () => {
  it.each([":root", ".dark"] as const)(
    "%s: `text-primary-solid` passes AA-normal on both the card and the page ground",
    (scheme) => {
      const b = block(scheme);
      const ink = readCssVar(b, "primary-solid");
      const card = readCssVar(b, "card");
      const bg = readCssVar(b, "background");
      expect(ratio(ink, card), `${scheme} text-primary-solid on card`).toBeGreaterThanOrEqual(AA_NORMAL);
      expect(ratio(ink, bg), `${scheme} text-primary-solid on page`).toBeGreaterThanOrEqual(AA_NORMAL);
    },
  );

  it("light `--primary-solid` === `--primary` (the swap is a light-mode no-op)", () => {
    const light = block(":root");
    expect(readCssVar(light, "primary-solid")).toBe(readCssVar(light, "primary"));
  });
});

describe("ENG-1273 — mobile token parity (primarySolid is the AA-safe on-card twin)", () => {
  it("mobile primarySolid hexes mirror web `--primary-solid` (light + dark)", () => {
    expect(readMobile("primarySolid")).toBe(readCssVar(block(":root"), "primary-solid"));
    expect(readMobile("primarySolidDark")).toBe(readCssVar(block(".dark"), "primary-solid"));
  });

  it("mobile: primarySolid clears AA on the dark card/page; the bare primaryDark fill FAILS", () => {
    const darkSolid = readMobile("primarySolidDark"); // #c4acd0
    const darkFill = readMobile("primaryDark"); // #7e5c92
    const darkCard = "#211a2a"; // Colors.dark.card (↔ web --card)
    const darkBg = "#120d18"; // Colors.dark.background (↔ web --background)
    expect(ratio(darkSolid, darkCard), "mobile primarySolidDark on card").toBeGreaterThanOrEqual(AA_NORMAL);
    expect(ratio(darkSolid, darkBg), "mobile primarySolidDark on page").toBeGreaterThanOrEqual(AA_NORMAL);
    // The mobile twin of the defect: bare lifted fill as on-card text.
    expect(ratio(darkFill, darkCard), "mobile primaryDark on card").toBeLessThan(AA_NORMAL);
    expect(ratio(darkFill, darkBg), "mobile primaryDark on page").toBeLessThan(AA_NORMAL);
  });
});

describe("ENG-1273 — web on-card / ghost-link call sites ink with -solid, not the bare fill", () => {
  it("legal pages (terms / licences) ink their on-card links with text-primary-solid", () => {
    expect(WEB_TERMS).toMatch(/text-primary-solid underline/);
    expect(WEB_LICENCES).toMatch(/text-primary-solid underline/);
    // No on-card link may regress to the bare fill ink (text-primary not -solid,
    // not bg-/border-/fill-/ring-primary).
    expect(WEB_TERMS).not.toMatch(/className="[^"]*\btext-primary\b(?!-)/);
    expect(WEB_LICENCES).not.toMatch(/className="[^"]*\btext-primary\b(?!-)/);
  });

  it("HouseholdBar Manage-style ghost link inks with text-primary-solid", () => {
    expect(WEB_HOUSEHOLD_BAR).toMatch(/text-primary-solid hover:underline/);
  });
});

describe("ENG-1273 — mobile on-card / link call sites ink with primarySolid, not bare accent.primary", () => {
  it("import-shared link + outline-button labels read accent.primarySolid", () => {
    expect(MOBILE_IMPORT_SHARED).toContain(
      "textLinkLabel: { color: accent.primarySolid",
    );
    expect(MOBILE_IMPORT_SHARED).toContain(
      "outlineBtnText: { color: accent.primarySolid",
    );
  });

  it("recipe/[id] source-link + official-button labels read accent.primarySolid", () => {
    expect(MOBILE_RECIPE_DETAIL).toContain(
      "sourceNameLink: { color: accent.primarySolid",
    );
    expect(MOBILE_RECIPE_DETAIL).toContain(
      "sourceLinkText: { color: accent.primarySolid",
    );
    expect(MOBILE_RECIPE_DETAIL).toContain(
      'officialButtonText: { fontSize: 14, fontWeight: "700", color: accent.primarySolid }',
    );
  });

  it("no on-card TEXT ink regresses to the bare `color: accent.primary` fill", () => {
    // backgroundColor / borderColor / shadowColor keep the 3:1 graphical fill —
    // only TEXT `color:` must read primarySolid.
    const bareTextInk = /(^|[^A-Za-z])color:\s*accent\.primary(?![A-Za-z])/m;
    expect(bareTextInk.test(MOBILE_IMPORT_SHARED)).toBe(false);
    expect(bareTextInk.test(MOBILE_RECIPE_DETAIL)).toBe(false);
    expect(bareTextInk.test(MOBILE_TODAY_SCREEN)).toBe(false);
  });
});
