/**
 * ENG-1275 (mobile) — raw fill hue used as TEXT on its own soft tint fails WCAG
 * AA; the fix inks with the scheme-resolved `-solid` token. Mobile twin of the
 * merged web ENG-780 / ENG-828 / ENG-1273 / ENG-1266 fixes (the `-solid` ink
 * discipline), and a sibling of `eng828PrimaryTintContrast.test.ts`.
 *
 * Three raw-fill-as-text regressions this guards, with the `-solid` ink that
 * clears AA (scheme-resolved via `useAccent()` → `DARK_ACCENT`, exactly like
 * `primarySolid` → `primarySolidDark`):
 *
 *   freeze / info Badge label  — raw `cyan` #4A7878  → `cyanSolid`
 *     (#3C5F6B light / #7FAAB8 dark). Web `--macro-water-solid` twin.
 *   added Badge label          — raw `success` #5E7C5A → `successSolid`
 *     (#466046 light / #83A57E dark). Web `--accent-success-solid` twin.
 *   Today streak headline      — same `success` family.
 *   Got-it ghost-link          — same `cyan` family.
 *   alcohol quick-add chip     — raw `warning` #C9892C → `alcoholSolid`
 *     (#9C5228 light / #D6A24A dark). Web `--stimulant-alcohol-solid` twin.
 *
 * The light `-solid` values are DARK hues: on a dark card they collapse to
 * ~2.4:1, so the dark scheme MUST lift them — these tests assert both schemes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { withAlpha, Accent } from "@/constants/theme";

const ROOT = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(ROOT, rel), "utf8");

const BADGE = read("components/Badge.tsx");
const STREAK_INSIGHT = read("components/today/TodayStreakInsightCard.tsx");
const HYDRATION = read("components/HydrationStimulantsCard.tsx");
const THEME_CTX = read("context/theme.tsx");

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

/** Contrast of a hex ink against a resolved RGB surface. */
function ratio(inkHex: string, bg: RGB): number {
  const la = relativeLuminance(hexToRgb(inkHex));
  const lb = relativeLuminance(bg);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Tint fill: ink hue at `pct`% alpha over the card. */
function tint(inkHex: string, pct: number, cardHex: string): RGB {
  return composite(hexToRgb(inkHex), pct / 100, hexToRgb(cardHex));
}

// Surfaces these chips/badges actually sit on (from constants/theme.ts Colors).
const LIGHT_CARD = "#ffffff"; // Colors.light.card
const DARK_CARD = "#211A2A"; // Colors.dark.card
const LIGHT_BG2 = "#F1F0F4"; // Colors.light.backgroundSecondary — the chip surface
const DARK_BG2 = "#1A1422"; // Colors.dark.backgroundSecondary
// The Badge fill is `withAlpha(color, 0x24)` (hex 0x24 = 36/255 ≈ 14% alpha); the
// StreakInsight card uses an 8% success tint behind the headline.
const BADGE_TINT = 14;
const STREAK_CARD_TINT = 8;

describe("ENG-1275 mobile — `-solid` inks clear AA where the raw fill (as text) does not", () => {
  it("token values mirror the merged web `-solid` twins exactly", () => {
    // Web --macro-water-solid (#3C5F6B / #7FAAB8), --accent-success-solid
    // (#466046 / #83A57E), --stimulant-alcohol-solid (#9C5228 / #D6A24A).
    expect(Accent.cyanSolid).toBe("#3C5F6B");
    expect(Accent.cyanSolidDark).toBe("#7FAAB8");
    expect(Accent.successSolid).toBe("#466046");
    expect(Accent.successSolidDark).toBe("#83A57E");
    expect(Accent.alcoholSolid).toBe("#9C5228");
    expect(Accent.alcoholSolidDark).toBe("#D6A24A");
  });

  it("cyan (freeze/info Badge + Got-it link): raw fill FAILS as text, cyanSolid PASSES — both schemes", () => {
    // Raw cyan as text on its own 14% Badge tint.
    expect(
      ratio(Accent.cyan, tint(Accent.cyan, BADGE_TINT, LIGHT_CARD)),
      "light raw cyan on its 14% tint",
    ).toBeLessThan(AA_NORMAL); // ~4.14:1
    expect(
      ratio(Accent.cyan, tint(Accent.cyan, BADGE_TINT, DARK_CARD)),
      "dark raw cyan on its 14% tint",
    ).toBeLessThan(AA_NORMAL); // ~2.98:1
    // cyanSolid (light) + cyanSolidDark clear AA on the same tint.
    expect(
      ratio(Accent.cyanSolid, tint(Accent.cyan, BADGE_TINT, LIGHT_CARD)),
      "light cyanSolid on cyan 14% tint",
    ).toBeGreaterThanOrEqual(AA_NORMAL); // ~5.78:1
    expect(
      ratio(Accent.cyanSolidDark, tint(Accent.cyan, BADGE_TINT, DARK_CARD)),
      "dark cyanSolidDark on cyan 14% tint",
    ).toBeGreaterThanOrEqual(AA_NORMAL); // ~5.84:1
    // The light cyanSolid would REGRESS dark — proves the dark variant is load-bearing.
    expect(
      ratio(Accent.cyanSolid, tint(Accent.cyan, BADGE_TINT, DARK_CARD)),
      "light cyanSolid on a DARK tint must fail (why cyanSolidDark exists)",
    ).toBeLessThan(AA_NORMAL); // ~2.13:1
  });

  it("success (added Badge + streak headline): raw fill FAILS as text, successSolid PASSES — both schemes", () => {
    expect(
      ratio(Accent.success, tint(Accent.success, BADGE_TINT, LIGHT_CARD)),
      "light raw success on its 14% tint",
    ).toBeLessThan(AA_NORMAL); // ~3.93:1
    expect(
      ratio(Accent.success, tint(Accent.success, BADGE_TINT, DARK_CARD)),
      "dark raw success on its 14% tint",
    ).toBeLessThan(AA_NORMAL); // ~3.12:1
    expect(
      ratio(Accent.successSolid, tint(Accent.success, BADGE_TINT, LIGHT_CARD)),
      "light successSolid on success 14% tint",
    ).toBeGreaterThanOrEqual(AA_NORMAL); // ~5.86:1
    expect(
      ratio(Accent.successSolidDark, tint(Accent.success, BADGE_TINT, DARK_CARD)),
      "dark successSolidDark on success 14% tint",
    ).toBeGreaterThanOrEqual(AA_NORMAL); // ~5.29:1
    // Streak headline sits on the card's 8% success tint — solid clears AA there too.
    expect(
      ratio(Accent.successSolid, tint(Accent.success, STREAK_CARD_TINT, LIGHT_CARD)),
      "light successSolid on streak card 8% tint",
    ).toBeGreaterThanOrEqual(AA_NORMAL); // ~6.33:1
    expect(
      ratio(Accent.successSolidDark, tint(Accent.success, STREAK_CARD_TINT, DARK_CARD)),
      "dark successSolidDark on streak card 8% tint",
    ).toBeGreaterThanOrEqual(AA_NORMAL); // ~5.66:1
  });

  it("alcohol chip: raw amber FAILS as text on the chip surface (light), alcoholSolid PASSES — both schemes", () => {
    // The alcohol chip tone is the amber `warning` fill; the chip text sits on
    // `backgroundSecondary`, not a tint of the hue.
    expect(
      ratio(Accent.warning, hexToRgb(LIGHT_BG2)),
      "light raw amber on the chip backgroundSecondary",
    ).toBeLessThan(AA_NORMAL); // ~2.61:1
    expect(
      ratio(Accent.alcoholSolid, hexToRgb(LIGHT_BG2)),
      "light alcoholSolid on the chip backgroundSecondary",
    ).toBeGreaterThanOrEqual(AA_NORMAL); // ~5.07:1
    // In dark the bright amber already passes on the dark surface, but the dark
    // -solid must ALSO pass (and the LIGHT alcoholSolid must NOT — it's a dark
    // clay that collapses on the dark surface, proving alcoholSolidDark is needed).
    expect(
      ratio(Accent.alcoholSolidDark, hexToRgb(DARK_BG2)),
      "dark alcoholSolidDark on the chip backgroundSecondary",
    ).toBeGreaterThanOrEqual(AA_NORMAL); // ~7.82:1
    expect(
      ratio(Accent.alcoholSolid, hexToRgb(DARK_BG2)),
      "light alcoholSolid on a DARK surface must fail (why alcoholSolidDark exists)",
    ).toBeLessThan(AA_NORMAL); // ~3.13:1
  });
});

describe("ENG-1275 mobile — call sites ink with the scheme-resolved `-solid`, not the raw fill", () => {
  it("DARK_ACCENT lifts cyanSolid / successSolid / alcoholSolid to their *Dark variants", () => {
    expect(THEME_CTX).toContain("cyanSolid: Accent.cyanSolidDark");
    expect(THEME_CTX).toContain("successSolid: Accent.successSolidDark");
    expect(THEME_CTX).toContain("alcoholSolid: Accent.alcoholSolidDark");
  });

  it("Badge freeze/info text reads accent.cyanSolid; added reads accent.successSolid", () => {
    expect(BADGE).toContain('variant === "freeze" || variant === "info"');
    expect(BADGE).toContain("? accent.cyanSolid");
    expect(BADGE).toContain('variant === "added"');
    expect(BADGE).toContain("? accent.successSolid");
    // The fill/border still anchor on the raw hue (`color`), not the solid.
    expect(BADGE).toContain("backgroundColor: color + BG_ALPHA");
    expect(BADGE).toContain("borderColor: color + BORDER_ALPHA");
  });

  it("TodayStreakInsightCard headline reads accent.successSolid; Got-it reads accent.cyanSolid", () => {
    expect(STREAK_INSIGHT).toContain("import { useAccent }");
    expect(STREAK_INSIGHT).toContain("color: accent.successSolid");
    expect(STREAK_INSIGHT).toContain("color: accent.cyanSolid");
    // The icons + soft tints stay on the raw Accent.success / Accent.cyan fills.
    expect(STREAK_INSIGHT).toContain("color={Accent.success}");
    expect(STREAK_INSIGHT).toContain("backgroundColor: Accent.success +");
    expect(STREAK_INSIGHT).toContain("color={Accent.cyan}");
  });

  it("HydrationStimulantsCard alcohol chip label reads accent.alcoholSolid", () => {
    expect(HYDRATION).toContain("import { useAccent }");
    expect(HYDRATION).toContain('tone === "alcohol" ? accent.alcoholSolid');
    // Water/caffeine chips keep their tone; the StatRow fill stays Accent.warning.
    expect(HYDRATION).toContain("tones(waterTone)[tone]");
  });
});
