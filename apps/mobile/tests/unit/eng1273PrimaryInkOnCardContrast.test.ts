/**
 * ENG-1273 (mobile) — `accent.primary` as small TEXT on the dark card/page
 * (no tint) fails WCAG AA; the fix inks with the scheme-resolved
 * `accent.primarySolid`. Mobile twin of the web
 * `tests/unit/eng1273PrimaryInkOnCardContrastCensus.test.ts` guard, and the
 * on-card sibling of `eng828PrimaryTintContrast.test.ts`.
 *
 * `useAccent()` returns the scheme-resolved palette: dark → `primary` #7E5C92
 * (the lifted FILL) / `primarySolid` #C4ACD0. A ghost link / credit line /
 * on-card data value inked with the bare `primary` reads ~3.08:1 on the dark
 * card #211A2A and ~3.50:1 on the dark page #120D18 (AA FAIL); `primarySolid`
 * clears ~8.15:1 / ~9.6:1. Light is effectively a no-op (both #3B2A4D).
 *
 * Only TEXT `color:` inks swap — `backgroundColor` / `borderColor` / icon
 * `color={…}` keep the 3:1-graphical FILL hue (correct for non-text).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { Accent } from "@/constants/theme";

const ROOT = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");

const IMPORT_SHARED = read("app/import-shared.tsx");
const RECIPE_DETAIL = read("app/recipe/[id].tsx");
const SHOPPING = read("app/shopping.tsx");
const TODAY_SCREEN = read("app/(tabs)/_today/TodayScreen.tsx");
const DIGEST_BLENDED = read("components/DigestBlended.tsx");
const FOOD_SEARCH = read("components/food-search/FoodSearchPanel.tsx");

const AA_NORMAL = 4.5;

type RGB = [number, number, number];

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

const DARK_CARD = "#211a2a"; // Colors.dark.card (↔ web --card)
const DARK_BG = "#120d18"; // Colors.dark.background (↔ web --background)
const LIGHT_CARD = "#ffffff";

describe("ENG-1273 mobile — primarySolid is AA-safe on the dark card/page, the bare fill is not", () => {
  it("light: primarySolid (deep plum) clears AA as on-card text", () => {
    expect(ratio(Accent.primarySolid, LIGHT_CARD)).toBeGreaterThanOrEqual(AA_NORMAL);
  });

  it("dark: primarySolidDark clears AA on card AND page; the bare primaryDark fill FAILS both", () => {
    expect(ratio(Accent.primarySolidDark, DARK_CARD), "primarySolidDark on card").toBeGreaterThanOrEqual(AA_NORMAL);
    expect(ratio(Accent.primarySolidDark, DARK_BG), "primarySolidDark on page").toBeGreaterThanOrEqual(AA_NORMAL);
    // The regression class: bare lifted fill as small on-card text.
    expect(ratio(Accent.primaryDark, DARK_CARD), "primaryDark on card").toBeLessThan(AA_NORMAL);
    expect(ratio(Accent.primaryDark, DARK_BG), "primaryDark on page").toBeLessThan(AA_NORMAL);
  });
});

describe("ENG-1273 mobile — on-card / link call sites ink with primarySolid, not the bare fill", () => {
  it("import-shared link + credit/outline labels read accent.primarySolid", () => {
    expect(IMPORT_SHARED).toContain("textLinkLabel: { color: accent.primarySolid");
    expect(IMPORT_SHARED).toContain("outlineBtnText: { color: accent.primarySolid");
    expect(IMPORT_SHARED).toContain("successCreditLine:");
  });

  it("recipe/[id] source-link + official-button labels read accent.primarySolid", () => {
    expect(RECIPE_DETAIL).toContain("sourceNameLink: { color: accent.primarySolid");
    expect(RECIPE_DETAIL).toContain("sourceLinkText: { color: accent.primarySolid");
  });

  it("shopping / digest / food-search on-card ink reads accent.primarySolid", () => {
    expect(SHOPPING).toContain("color: accent.primarySolid");
    expect(DIGEST_BLENDED).toContain("color: accent.primarySolid");
    expect(FOOD_SEARCH).toContain("color: accent.primarySolid");
  });

  it("no on-card TEXT `color:` ink regresses to the bare accent.primary fill", () => {
    const bareTextInk = /(^|[^A-Za-z])color:\s*accent\.primary(?![A-Za-z])/m;
    for (const [name, src] of [
      ["import-shared", IMPORT_SHARED],
      ["recipe/[id]", RECIPE_DETAIL],
      ["shopping", SHOPPING],
      ["TodayScreen", TODAY_SCREEN],
      ["DigestBlended", DIGEST_BLENDED],
      ["FoodSearchPanel", FOOD_SEARCH],
    ] as const) {
      expect(bareTextInk.test(src), `${name} has no bare color: accent.primary`).toBe(false);
    }
  });
});
