/**
 * Sloe palette — WCAG AA contrast guard (computational, not a screenshot).
 *
 * The Sloe re-skin split every accent into a graphical FILL hue (buttons,
 * arcs, dots, large headlines — 3:1 bar) and a darkened `-solid` TEXT hue
 * (small text/icons on light — 4.5:1 bar). This test computes the real WCAG
 * 2.x ratio for each pairing so a regression to a fill-as-text colour fails
 * here instead of silently shipping inaccessible UI (the failure mode that
 * forced the 7 story `a11y.test: "todo"` mutes — see
 * `tests/unit/sloeContrastUsage.test.ts` for the call-site guard).
 *
 * Surfaces (light): page #FFFFFF, card #F6F5F2. Dark card #232126.
 * The `*-solid` token values mirror `src/styles/theme.css` +
 * `apps/mobile/constants/theme.ts`; the chip-bg map is imported live from the
 * shared source so the two cannot drift.
 */
import { describe, expect, it } from "vitest";
import {
  NET_ENERGY_CHIP_BG,
  NET_ENERGY_STATE_COLOR,
} from "../../src/lib/nutrition/netEnergyBalance";

const AA_NORMAL = 4.5; // WCAG 1.4.3 — normal text
const AA_LARGE = 3.0; // ≥18.66px bold / ≥24px regular; also 1.4.11 graphical

type RGB = [number, number, number];

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ];
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

function ratio(a: string | RGB, b: string | RGB): number {
  const la = relativeLuminance(typeof a === "string" ? hexToRgb(a) : a);
  const lb = relativeLuminance(typeof b === "string" ? hexToRgb(b) : b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// Surfaces
const WHITE = "#FFFFFF";
const CARD = "#F6F5F2";
// Warm cream page (#F9F1E6) — the Today/Progress ground the amber status chips
// sit on. This is the surface the storybook a11y addon flagged (`#956619`
// warning-solid was 4.47:1 here, JUST under AA — the gap this guard had missed
// by only testing CARD). (2026-06-23)
const CREAM = "#F9F1E6";
const DARK_CARD = "#232126";
// Honey activity-soft tint as it actually composites on the card:
// rgba(214,162,74,0.16) over #F6F5F2 → ≈ #F1E8D7 (the surface the burn-detail
// "Bonus earned" text sits on).
const ACTIVITY_SOFT_ON_CARD = composite([214, 162, 74], 0.16, hexToRgb(CARD));

// Token values (must mirror theme.css / theme.ts)
const PLUM = "#3B2A4D"; // --foreground-brand (heading ink)
const PRIMARY_FILL = "#C8794E"; // --accent-primary (clay, fill-only)
const PRIMARY_SOLID = "#A0552E"; // --accent-primary-solid (clay text)
const ACTIVITY_FILL = "#D6A24A"; // --activity (honey, fill-only)
const ACTIVITY_SOLID = "#8A5A14"; // --activity-solid (honey text)
const WARNING_SOLID = "#925812"; // --accent-warning-solid (amber text, 2026-06-23 darken)
const FOREGROUND_TERTIARY = "#6E6874"; // --foreground-tertiary (muted text, 2026-06-23 darken from #9B93A3)
const DARK_BRAND = "#A98CB8"; // --foreground-brand dark (text lift of plum)
const DARK_ACTIVITY_SOLID = "#E0B25E"; // --activity-solid dark

describe("Sloe text tokens clear WCAG AA on their surfaces", () => {
  it("heading ink (plum) passes AA-normal on the card", () => {
    expect(ratio(PLUM, CARD)).toBeGreaterThanOrEqual(AA_NORMAL); // ~11.9:1
  });

  it("primary-solid (clay text) passes AA-normal on card + white", () => {
    expect(ratio(PRIMARY_SOLID, CARD)).toBeGreaterThanOrEqual(AA_NORMAL); // ~5.0
    expect(ratio(PRIMARY_SOLID, WHITE)).toBeGreaterThanOrEqual(AA_NORMAL); // ~5.5
  });

  it("activity-solid (honey text) passes AA-normal on the honey tint + white", () => {
    expect(ratio(ACTIVITY_SOLID, ACTIVITY_SOFT_ON_CARD)).toBeGreaterThanOrEqual(
      AA_NORMAL,
    ); // ~4.9
    expect(ratio(ACTIVITY_SOLID, WHITE)).toBeGreaterThanOrEqual(AA_NORMAL); // ~5.9
  });

  it("tertiary muted text passes AA-normal on white, card + cream", () => {
    // The core muted/tertiary token (labels, captions, "+N more", sublabels).
    // Darkened #9B93A3 → #6E6874 (2026-06-23) — the old grey was 2.96:1 (the
    // ~243 storybook a11y failures). Guards against a regression back to light.
    expect(ratio(FOREGROUND_TERTIARY, WHITE)).toBeGreaterThanOrEqual(AA_NORMAL); // ~5.4
    expect(ratio(FOREGROUND_TERTIARY, CARD)).toBeGreaterThanOrEqual(AA_NORMAL); // ~4.9
    expect(ratio(FOREGROUND_TERTIARY, CREAM)).toBeGreaterThanOrEqual(AA_NORMAL); // ~4.8
  });

  it("warning-solid (amber text) passes AA-normal on white, card + cream", () => {
    expect(ratio(WARNING_SOLID, WHITE)).toBeGreaterThanOrEqual(AA_NORMAL); // ~5.8
    expect(ratio(WARNING_SOLID, CARD)).toBeGreaterThanOrEqual(AA_NORMAL); // ~5.3
    // The cream-page chip surface the old #956619 (4.47) failed on.
    expect(ratio(WARNING_SOLID, CREAM)).toBeGreaterThanOrEqual(AA_NORMAL); // ~5.2
  });

  it("over-budget amber numeral clears AA-normal on cream, white + card (ENG-1296)", () => {
    // 2026-07-01 re-ratification: over-budget is uniformly amber — the ring
    // "kcal over" numeral reads in --over-budget-fg (= --accent-warning-solid,
    // #925812) on light surfaces. Measured: 5.79:1 white / 5.17:1 cream /
    // 5.31:1 card — AA PASS everywhere the numeral can sit, so no darker
    // sanctioned amber is needed. Dark numeral (#D6A24A) = 7.33:1 on the
    // dark card. Guards the amber-on-cream pair the ticket called out.
    const OVER_BUDGET_FG = WARNING_SOLID; // single-sourced in theme.css
    expect(ratio(OVER_BUDGET_FG, CREAM)).toBeGreaterThanOrEqual(AA_NORMAL); // 5.17
    expect(ratio(OVER_BUDGET_FG, WHITE)).toBeGreaterThanOrEqual(AA_NORMAL); // 5.79
    expect(ratio(OVER_BUDGET_FG, CARD)).toBeGreaterThanOrEqual(AA_NORMAL); // 5.31
    const OVER_BUDGET_FG_DARK = "#D6A24A"; // .dark --over-budget-fg (= warning-solid dark)
    expect(ratio(OVER_BUDGET_FG_DARK, DARK_CARD)).toBeGreaterThanOrEqual(AA_NORMAL); // 7.3
  });

  it("empty hero-ring gradient stops clear the 3:1 UI-component floor (ENG-1315)", () => {
    // Decision 2026-07-01 #5 (measured): the cold-open ring ticks were
    // #C4BCD4/#E6E0F1 ≈ 1.8:1 on white — below the WCAG 1.4.11 3:1 floor for
    // UI components, so the hero read as a skeleton. Deepened calm plum-lilac:
    // A #786A94 = 4.90:1 white, B #9587B3 = 3.28:1 white. Values must mirror
    // theme.css --ring-empty-a/b + mobile ringEmptyA/B (pinned in
    // crossPlatformThemeTokens.test.ts).
    const RING_EMPTY_A = "#786A94";
    const RING_EMPTY_B = "#9587B3";
    expect(ratio(RING_EMPTY_A, WHITE)).toBeGreaterThanOrEqual(AA_LARGE); // 4.90
    expect(ratio(RING_EMPTY_B, WHITE)).toBeGreaterThanOrEqual(AA_LARGE); // 3.28
    // Dark: A lifted #6A5A7E → #7D6C93 so the bloom clears 3:1 on the dark
    // card too (3.56:1; was 2.71:1). B #B9ADD0 already passed (7.99:1).
    const DARK_RING_CARD = "#211A2A"; // .dark --card
    expect(ratio("#7D6C93", DARK_RING_CARD)).toBeGreaterThanOrEqual(AA_LARGE);
    expect(ratio("#B9ADD0", DARK_RING_CARD)).toBeGreaterThanOrEqual(AA_LARGE);
  });

  it("light page ground separates measurably from the white card (ENG-1316)", () => {
    // Decision 2026-07-01 #6 (measured): page vs card was 2/255 — the one-card
    // soft lift was invisible at the fill level. The ground is now the
    // whisper-cool plum-white #F7F6FA (the v3 GROUND SYSTEM's stated intent —
    // cool, never beige); cards stay #FFFFFF on the layered --elev-card-soft.
    // Values mirror theme.css --background/--card + mobile Colors.light
    // (parity pinned in crossPlatformThemeTokens.test.ts).
    const PAGE_GROUND = "#F7F6FA";
    const CARD_WHITE = "#FFFFFF";
    expect(PAGE_GROUND).not.toBe(CARD_WHITE);
    // Measurable at token level: ≥1.07:1 luminance separation (was 1.00) and
    // every RGB channel at least 4/255 below the card (was ≤2/255).
    expect(ratio(PAGE_GROUND, CARD_WHITE)).toBeGreaterThanOrEqual(1.07);
    const [pr, pg, pb] = hexToRgb(PAGE_GROUND);
    expect(255 - pr).toBeGreaterThanOrEqual(4);
    expect(255 - pg).toBeGreaterThanOrEqual(4);
    expect(255 - pb).toBeGreaterThanOrEqual(4);
    // The ladder stays monotonic: card > page > grouped > secondary.
    const lumOf = (hex: string) => relativeLuminance(hexToRgb(hex));
    expect(lumOf(CARD_WHITE)).toBeGreaterThan(lumOf(PAGE_GROUND));
    expect(lumOf(PAGE_GROUND)).toBeGreaterThan(lumOf("#F5F4F7")); // --background-grouped
    expect(lumOf("#F5F4F7")).toBeGreaterThan(lumOf("#F1F0F4")); // --background-secondary
    // Text tokens keep AA on the tinted ground.
    expect(ratio(FOREGROUND_TERTIARY, PAGE_GROUND)).toBeGreaterThanOrEqual(AA_NORMAL); // 5.01
    expect(ratio(WARNING_SOLID, PAGE_GROUND)).toBeGreaterThanOrEqual(AA_NORMAL); // 5.38
  });

  it("net-energy chip backgrounds carry white label at AA-normal", () => {
    for (const state of ["deficit", "surplus", "maintenance"] as const) {
      expect(ratio(WHITE, NET_ENERGY_CHIP_BG[state])).toBeGreaterThanOrEqual(
        AA_NORMAL,
      );
    }
  });

  it("dark-mode heading ink + activity-solid pass AA on the dark card", () => {
    expect(ratio(DARK_BRAND, DARK_CARD)).toBeGreaterThanOrEqual(AA_NORMAL);
    expect(ratio(DARK_ACTIVITY_SOLID, DARK_CARD)).toBeGreaterThanOrEqual(
      AA_NORMAL,
    );
  });
});

describe("Sloe FILL hues are fill-only — they justify the -solid variants", () => {
  it("clay fill FAILS AA-normal as text on the card (why headings use plum/solid)", () => {
    expect(ratio(PRIMARY_FILL, CARD)).toBeLessThan(AA_NORMAL); // ~3.06
  });

  it("white-on-clay-fill FAILS AA-normal (why the chip uses -solid bg)", () => {
    expect(ratio(WHITE, PRIMARY_FILL)).toBeLessThan(AA_NORMAL); // ~3.33
  });

  it("honey fill can NEVER be text — fails even AA-large on white", () => {
    expect(ratio(ACTIVITY_FILL, WHITE)).toBeLessThan(AA_LARGE); // ~2.30
    expect(ratio(ACTIVITY_FILL, ACTIVITY_SOFT_ON_CARD)).toBeLessThan(AA_LARGE); // ~1.89
  });

  it("net-energy headline fills still pass AA-large (3:1) — they stay vivid", () => {
    // The 52px net headline keeps NET_ENERGY_STATE_COLOR; only the small chip
    // moved to the -solid NET_ENERGY_CHIP_BG.
    for (const state of ["deficit", "surplus", "maintenance"] as const) {
      expect(ratio(NET_ENERGY_STATE_COLOR[state], CARD)).toBeGreaterThanOrEqual(
        AA_LARGE,
      );
    }
  });
});
