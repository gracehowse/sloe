/**
 * ENG-828 (mobile) — `accent.primary` as small text/icon on a `primary` soft
 * tint fails WCAG AA in dark; the fix inks with the scheme-resolved
 * `accent.primarySolid`. Mobile twin of the web
 * `tests/unit/eng828PrimaryTintContrastCensus.test.ts` guard.
 *
 * `useAccent()` returns the scheme-resolved palette: light → `primary`
 * #3B2A4D / `primarySolid` #3B2A4D; dark → `primary` #7E5C92 (the lifted FILL)
 * / `primarySolid` #C4ACD0. A chip/badge/pill that fills with the primary tint
 * and inks its label with the bare `primary` reads ~2.8:1 in dark (AA FAIL);
 * `primarySolid` clears ~7.6:1. Light is effectively a no-op (both #3B2A4D).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { Accent } from "@/constants/theme";

const ROOT = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");

const BADGE = read("components/Badge.tsx");
const HOUSEHOLD_BAR = read("components/HouseholdBar.tsx");
const PORTION_PICKER = read("components/PortionPicker.tsx");
const STREAK_PIP = read("components/today/StreakPip.tsx");

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

function ratio(a: string, b: RGB): number {
  const la = relativeLuminance(hexToRgb(a));
  const lb = relativeLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Tint fill: ink hue at `pct`% alpha over the card. */
function tint(inkHex: string, pct: number, cardHex: string): RGB {
  return composite(hexToRgb(inkHex), pct / 100, hexToRgb(cardHex));
}

const TINT_PCTS = [8, 10, 14, 15, 20, 26] as const; // alpha suffixes the chips use
const LIGHT_CARD = "#ffffff";
const DARK_CARD = "#211a2a";

describe("ENG-828 mobile — primarySolid is AA-safe on the primary tint, the bare fill is not", () => {
  it("light: primarySolid clears AA on its own primary tint", () => {
    for (const pct of TINT_PCTS) {
      expect(
        ratio(Accent.primarySolid, tint(Accent.primary, pct, LIGHT_CARD)),
        `light primarySolid on /${pct}`,
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    }
  });

  it("dark: primarySolidDark clears AA, but the bare primaryDark fill FAILS", () => {
    for (const pct of TINT_PCTS) {
      expect(
        ratio(Accent.primarySolidDark, tint(Accent.primaryDark, pct, DARK_CARD)),
        `dark primarySolidDark on /${pct}`,
      ).toBeGreaterThanOrEqual(AA_NORMAL);
    }
    // The regression class: bare lifted fill as small text on its tint.
    expect(
      ratio(Accent.primaryDark, tint(Accent.primaryDark, 10, DARK_CARD)),
    ).toBeLessThan(AA_NORMAL);
  });

  it("StreakPip plum-light tint: primarySolid passes both schemes (bare tint fails dark)", () => {
    // StreakPip fills with `${colors.tint}14` — colors.tint is the plum-LIGHT
    // (#5B3B6E) in both schemes. The active ink now reads primarySolid.
    const fillHue = Accent.primaryLight; // #5B3B6E = Colors.*.tint
    expect(ratio(Accent.primarySolid, tint(fillHue, 14, LIGHT_CARD)))
      .toBeGreaterThanOrEqual(AA_NORMAL);
    expect(ratio(Accent.primarySolidDark, tint(fillHue, 14, DARK_CARD)))
      .toBeGreaterThanOrEqual(AA_NORMAL);
    // Bare colors.tint as text on its own 14% tint fails in dark (the old code).
    expect(ratio(fillHue, tint(fillHue, 14, DARK_CARD))).toBeLessThan(AA_NORMAL);
  });
});

describe("ENG-828 mobile — call sites ink with primarySolid, not the bare fill", () => {
  it("Badge pro/custom text reads accent.primarySolid via textColor", () => {
    expect(BADGE).toContain("const textColor = isPrimaryVariant ? accent.primarySolid");
    expect(BADGE).toContain("color: textColor");
  });

  it("HouseholdBar selected chip + Manage link read accent.primarySolid", () => {
    expect(HOUSEHOLD_BAR).toContain("fg: active ? accent.primarySolid");
    expect(HOUSEHOLD_BAR).not.toMatch(/fg: active \? accent\.primary\b(?!Solid)/);
  });

  it("PortionPicker pill/chip/unit-row ink reads accent.primarySolid", () => {
    expect(PORTION_PICKER).toContain("color: accent.primarySolid");
    expect(PORTION_PICKER).not.toMatch(
      /color:\s*isActive \? accent\.primary\b(?!Solid)/,
    );
  });

  it("StreakPip active pip ink reads accent.primarySolid", () => {
    expect(STREAK_PIP).toContain("? accent.primarySolid");
  });
});
