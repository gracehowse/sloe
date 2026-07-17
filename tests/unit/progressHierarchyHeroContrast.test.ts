/**
 * ENG-1525 — `--hero-tint` ink-on-tint WCAG AA guard (computational).
 *
 * The Progress Trajectory hero is the ONE tinted card on the hierarchy-v1
 * page (deliberate ENG-1497 carve-out). Its plum wash sits UNDER real text —
 * the serif kg numeral (plum ink), the projection/footnote lines (muted ink)
 * and the "toward goal" verdict — so the composited tint ground must keep
 * those inks at AA-normal (4.5:1), light AND dark.
 *
 * Follows the `sloeContrastTokens.test.ts` pattern (real WCAG 2.x maths, not
 * a screenshot) with one deliberate upgrade: the token values are PARSED
 * LIVE from `src/styles/theme.css` and `apps/mobile/constants/theme.ts`
 * rather than mirrored as hardcoded hex duplicates — a later tint retune
 * cannot silently drift past this guard, and the web↔mobile trio parity is
 * pinned from the same parse.
 *
 * Both gradient stops are checked (`--hero-tint` top, `--hero-tint-to`
 * bottom): in light mode the stronger top stop is the darker/worst ground
 * for dark ink; asserting both keeps the guard honest wherever text sits in
 * the gradient.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const THEME_CSS = readFileSync(resolve(ROOT, "src/styles/theme.css"), "utf8");
const THEME_TS = readFileSync(
  resolve(ROOT, "apps/mobile/constants/theme.ts"),
  "utf8",
);

const AA_NORMAL = 4.5;

// ---------------------------------------------------------------------------
// Token parsing — live from the theme files, never hardcoded mirrors.
// ---------------------------------------------------------------------------

/** theme.css light block = `:root {` → the `.dark {` selector. */
const CSS_LIGHT = THEME_CSS.slice(
  THEME_CSS.indexOf(":root {"),
  THEME_CSS.indexOf(".dark {"),
);
/** theme.css dark block = `.dark {` → the `@theme` mapping section. */
const CSS_DARK = THEME_CSS.slice(
  THEME_CSS.indexOf(".dark {"),
  THEME_CSS.indexOf("@theme"),
);

function cssVar(block: string, name: string): string {
  const m = block.match(new RegExp(`${name}:\\s*([^;]+);`));
  expect(m, `${name} present in theme.css block`).toBeTruthy();
  return m![1].trim();
}

/** `Colors.light` / `Colors.dark` blocks in mobile theme.ts. */
const TS_COLORS = THEME_TS.slice(THEME_TS.indexOf("export const Colors"));
const TS_LIGHT = TS_COLORS.slice(
  TS_COLORS.indexOf("light: {"),
  TS_COLORS.indexOf("dark: {"),
);
const TS_DARK = TS_COLORS.slice(TS_COLORS.indexOf("dark: {"));

function tsToken(block: string, name: string): string {
  const m = block.match(new RegExp(`${name}:\\s*'([^']+)'`));
  expect(m, `${name} present in theme.ts block`).toBeTruthy();
  return m![1].trim();
}

// ---------------------------------------------------------------------------
// WCAG maths (same as sloeContrastTokens.test.ts).
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
}

function parseRgba(value: string): { rgb: RGB; alpha: number } {
  const m = value.match(
    /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/,
  );
  expect(m, `rgba() parse of "${value}"`).toBeTruthy();
  return {
    rgb: [Number(m![1]), Number(m![2]), Number(m![3])],
    alpha: Number(m![4]),
  };
}

/** Composite an rgba foreground over an opaque background (straight alpha). */
function composite(fg: RGB, alpha: number, bg: RGB): RGB {
  return [
    Math.round(fg[0] * alpha + bg[0] * (1 - alpha)),
    Math.round(fg[1] * alpha + bg[1] * (1 - alpha)),
    Math.round(fg[2] * alpha + bg[2] * (1 - alpha)),
  ];
}

function relativeLuminance([r, g, b]: RGB): number {
  const lin = (c8: number) => {
    const c = c8 / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a: RGB, b: RGB): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------
// Per-scheme fixtures parsed from the theme files.
// ---------------------------------------------------------------------------

function scheme(block: string) {
  const bg = hexToRgb(cssVar(block, "--background"));
  const tint = parseRgba(cssVar(block, "--hero-tint"));
  const tintTo = parseRgba(cssVar(block, "--hero-tint-to"));
  return {
    /** The gradient's two stops composited on the Progress page ground. */
    tintTop: composite(tint.rgb, tint.alpha, bg),
    tintBottom: composite(tintTo.rgb, tintTo.alpha, bg),
    inkPlumBody: hexToRgb(cssVar(block, "--foreground")),
    inkPlumBrand: hexToRgb(cssVar(block, "--foreground-brand")),
    // `--muted-foreground` aliases `--foreground-secondary` in theme.css.
    inkMuted: hexToRgb(cssVar(block, "--foreground-secondary")),
  };
}

describe.each([
  ["light", CSS_LIGHT],
  ["dark", CSS_DARK],
] as const)("hero ink-on-tint AA (%s)", (_name, block) => {
  const s = scheme(block);

  it("plum body ink (--foreground) clears AA-normal on both tint stops", () => {
    expect(ratio(s.inkPlumBody, s.tintTop)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(ratio(s.inkPlumBody, s.tintBottom)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("plum heading ink (--foreground-brand) clears AA-normal on both tint stops", () => {
    expect(ratio(s.inkPlumBrand, s.tintTop)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(ratio(s.inkPlumBrand, s.tintBottom)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("muted ink (--muted-foreground → --foreground-secondary) clears AA-normal on both tint stops", () => {
    expect(ratio(s.inkMuted, s.tintTop)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(ratio(s.inkMuted, s.tintBottom)).toBeGreaterThanOrEqual(AA_NORMAL);
  });
});

describe("hero-tint trio web ↔ mobile parity (parsed, not mirrored)", () => {
  const strip = (v: string) => v.replace(/\s+/g, "");

  it.each([
    ["--hero-tint", "heroTint"],
    ["--hero-tint-to", "heroTintTo"],
    ["--hero-tint-border", "heroTintBorder"],
  ] as const)("%s matches mobile %s in light AND dark", (cssName, tsName) => {
    expect(strip(cssVar(CSS_LIGHT, cssName))).toBe(strip(tsToken(TS_LIGHT, tsName)));
    expect(strip(cssVar(CSS_DARK, cssName))).toBe(strip(tsToken(TS_DARK, tsName)));
  });
});
