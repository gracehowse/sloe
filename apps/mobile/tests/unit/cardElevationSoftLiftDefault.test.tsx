// @vitest-environment jsdom
/**
 * useCardElevation — soft-lift is the DEFAULT, and the iOS overflow-clip is
 * fixed on the prominent Today cards (2026-06-04, Grace: "sim cards are
 * blending into the background, figma does not do this").
 *
 * ROOT CAUSE these guard:
 *  1. The Sloe Figma lifts `#F6F5F2` cards off the `#FFFFFF` page with a soft
 *     DROP SHADOW, not a heavier border. On the sim the cards read flat because
 *     (a) flag-FORCE is dead in a bundled app (ENG-840) so the old
 *     `design_system_elevation` gate could never be exercised, and (b) the most
 *     prominent Today cards spread the shadow onto the SAME View that clips its
 *     children with `overflow: 'hidden'` — and iOS clips shadows under
 *     `overflow: 'hidden'`, so the shadow was swallowed.
 *  2. The fix makes the soft lift the UNCONDITIONAL light default of
 *     `useCardElevation` (no flag read — the hook is consumed by ~30 components
 *     and an analytics read here throws under their partial mocks), and splits
 *     the clipping cards so the shadow sits on an OUTER wrapper.
 *
 * Two layers, mirroring the repo convention (see `sloeCardHairlineBorders`):
 *  - the hook's RETURN shape is render-tested (shadow values are not subpixel,
 *    so they're assertable under the RN vitest mock — unlike hairlineWidth);
 *  - the clip-fix STRUCTURE is pinned at source level, because the merged
 *    style tree of an outer-vs-inner View split is brittle to assert by render.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react-native";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { Elevation } from "../../constants/theme";

void React;

const MOBILE_ROOT = resolve(__dirname, "../..");
function read(relPath: string): string {
  return readFileSync(resolve(MOBILE_ROOT, relPath), "utf8");
}

// Flip the theme per-test. `useThemeColors` reads `colors` off `useTheme`, so
// the mock must supply both `resolved` and `colors`.
const themeState: { resolved: "light" | "dark"; colors: Record<string, string> } = {
  resolved: "light",
  colors: { cardElevated: "#2A2730", card: "#232126" },
};
vi.mock("@/context/theme", () => ({
  useTheme: () => themeState,
}));

// eslint-disable-next-line import/first
import { useCardElevation } from "../../hooks/useCardElevation";

describe("useCardElevation — soft lift is the default", () => {
  it("LIGHT default carries the soft drop shadow and drops the border", () => {
    themeState.resolved = "light";
    const { result } = renderHook(() => useCardElevation());
    // The shadow is the separation — it lifts the card off the white page.
    expect(result.current.shadowStyle).toBe(Elevation.cardSoft);
    // Border dropped (shadow carries it — no double edge, no heavy 1pt box).
    expect(result.current.useBorder).toBe(false);
    // Light keeps the caller's own background (no tonal lift).
    expect(result.current.liftBg).toBeUndefined();
  });

  it("the LIGHT default is NOT gated behind the elevation flag (renders flags-cold)", () => {
    // No flag is mocked ON here — the global `@/lib/analytics` shim resolves
    // every flag OFF / cold. The soft lift must STILL be returned, proving the
    // hook no longer hides the shadow behind `design_system_elevation` (the bug
    // was that a cold/forced-off flag on the sim left the cards flat).
    themeState.resolved = "light";
    const { result } = renderHook(() => useCardElevation());
    expect(result.current.shadowStyle).toBe(Elevation.cardSoft);
    expect(result.current.shadowStyle?.shadowOpacity).toBeGreaterThan(0);
  });

  it("DARK default uses a tonal lift + hairline, never a (poorly-rendered) shadow", () => {
    themeState.resolved = "dark";
    const { result } = renderHook(() => useCardElevation());
    expect(result.current.shadowStyle).toBeUndefined();
    expect(result.current.useBorder).toBe(true);
    expect(result.current.liftBg).toBe(themeState.colors.cardElevated);
    // restore for any later test ordering
    themeState.resolved = "light";
  });
});

describe("Elevation.cardSoft — the 10% soft lift, web ↔ mobile", () => {
  it("is bumped to 10% opacity (Grace 'push it to 10%', 2026-06-04)", () => {
    // The lever the founder asked for: opacity 0.07 → 0.10 so the #F6F5F2 card
    // separates more confidently from the #FFFFFF page. Pinned EXACTLY at 0.10
    // (not a band) — the value is the point of this change.
    expect(Elevation.cardSoft.shadowOpacity).toBe(0.1);
  });

  it("sits in the premium band (radius soft, y-offset small)", () => {
    // Premium band (Grace red-lines a Material drop shadow as cheap): the radius
    // widened 12 → 14 alongside the opacity bump; the y-offset stays +4.
    expect(Elevation.cardSoft.shadowRadius).toBe(14);
    expect(Elevation.cardSoft.shadowOffset.height).toBe(4);
  });

  it("is plum/aubergine-tinted (the Sloe ink), matching the web token exactly", () => {
    // #221B26 == rgba(34,27,38) == web --elev-card-soft colour. Keeps web ==
    // mobile and reads as a calm plum-tinted ambient shadow, not pure black.
    expect(Elevation.cardSoft.shadowColor.toLowerCase()).toBe("#221b26");
  });

  it("matches the web --elev-card-soft token EXACTLY (10% / 14px / y+4 / Sloe ink)", () => {
    // The web token must carry the same three levers, so web == mobile cards.
    // Source-read the light :root token straight from theme.css.
    const themeCss = readFileSync(
      resolve(MOBILE_ROOT, "../../src/styles/theme.css"),
      "utf8",
    );
    const root = themeCss.slice(themeCss.indexOf(":root {"));
    const m = root.match(/--elev-card-soft:\s*([^;]+);/);
    expect(m, "--elev-card-soft in :root").not.toBeNull();
    const webToken = m![1].trim().toLowerCase().replace(/\s+/g, " ");
    // 0 4px 14px rgba(34, 27, 38, 0.10) — y+4, radius 14, Sloe ink at 10%.
    expect(webToken).toBe("0 4px 14px rgba(34, 27, 38, 0.10)");
  });

  it("the flat `card` token stays flat — it is no longer the hook default", () => {
    // The flat token must remain a no-op (any direct consumer relies on it),
    // but the hook no longer routes light cards to it.
    expect(Elevation.card.shadowOpacity).toBe(0);
  });
});

describe("iOS overflow-clip fix lives in the shared <SupprCard> shell", () => {
  // iOS clips shadows under `overflow: 'hidden'`. The fix — soft shadow on an
  // OUTER node, corner-clip on a SEPARATE inner node — used to be hand-rolled
  // (and drifted) in ~6 card surfaces. It now lives in ONE place: the SupprCard
  // primitive. So the guard moves with it: (1) the shell encapsulates the split
  // correctly, and (2) the migrated card surfaces route through the shell rather
  // than re-rolling the (bug-prone) clip themselves.

  /** Strip comments so an explanatory note that mentions `overflow: 'hidden'`
   *  can't be mistaken for a real style. */
  function stripComments(src: string): string {
    return src
      .replace(/\/\*[\s\S]*?\*\//g, "") // block comments
      .replace(/(^|[^:])\/\/.*$/gm, "$1"); // line comments (not the // in URLs)
  }

  it("SupprCard's `overflow: 'hidden'` inner View does NOT carry the soft shadow", () => {
    // The shell's inner (clipping) view must NOT spread the elevation shadow —
    // the shadow rides the OUTER wrapper, or iOS swallows it. Pinned at source:
    // the only `overflow: "hidden"` in the shell is `styles.inner`, and the
    // outer wrapper is the one that takes `outerShadow`.
    const src = stripComments(read("components/ui/SupprCard.tsx"));
    expect(src).toMatch(/overflow:\s*["']hidden["']/);
    // The shadow is applied as `outerShadow` on the OUTER View only.
    expect(src).toMatch(/outerShadow/);
    // `styles.inner` (the clip) must be the only thing with overflow hidden, and
    // it must not be where the shadow is spread — the inner style literal lists
    // border/padding, never `outerShadow`/`elevation.shadowStyle`.
    expect(src).not.toMatch(/inner:\s*\{[^}]*shadow/i);
  });

  // The card surfaces migrated to the shell — they must route their chrome
  // THROUGH <SupprCard>, not re-roll a clip+shadow pair. (The recurring-drift
  // fix: the clip can never be re-introduced per-card again.)
  const MIGRATED_SURFACES = [
    "components/HydrationStimulantsCard.tsx", // SloeCard → SupprCard
    "components/today/TodayHeroRing.tsx",
    "components/today/TodayDashboardMacroTiles.tsx", // size="tile"
    "components/today/TodayPlannedMealsCard.tsx",
    "components/today/TodayMealsSection.tsx", // per-slot + quick-add cards
    "components/today/TodayActivityBonusCard.tsx", // outer + inset sub-cards
    "components/progress/TrajectoryCard.tsx",
    "components/progress/TrendSummaryCard.tsx",
    "components/progress/DigestStoryCard.tsx",
  ];

  it.each(MIGRATED_SURFACES)(
    "%s renders its card chrome through <SupprCard>",
    (relPath) => {
      const src = read(relPath);
      expect(src).toMatch(/from ["']@\/components\/ui\/SupprCard["']/);
      expect(src).toMatch(/<SupprCard/);
    },
  );

  it("the migrated surfaces no longer hand-roll a clip+shadow pair", () => {
    // None of the migrated files may spread `cardElevation.shadowStyle` onto a
    // View that also clips — that whole pattern moved into the shell. (Files that
    // legitimately still use `useCardElevation` for a NON-resting-card surface —
    // a modal/banner — are fine; we only forbid the co-located clip+shadow bug
    // shape.)
    for (const relPath of MIGRATED_SURFACES) {
      const lines = stripComments(read(relPath)).split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!/overflow:\s*["']hidden["']/.test(lines[i])) continue;
        let start = i;
        while (start > 0 && start > i - 12 && !/style=\{/.test(lines[start])) start--;
        let end = i;
        while (end < lines.length - 1 && end < i + 12 && !/\]\}|\}\}/.test(lines[end])) end++;
        const literal = lines.slice(start, end + 1).join("\n");
        expect(
          /cardElevation\.shadowStyle/.test(literal),
          `${relPath} re-rolled a clip+shadow pair near line ${i + 1}`,
        ).toBe(false);
      }
    }
  });

  it("Progress `progress-3-stat-row` is a <SupprCard> (testID on the shell)", () => {
    // The founder-visible Progress stat row routes through the shell; the testID
    // moved onto the SupprCard outer node so Maestro/captures stay stable.
    const src = read("app/(tabs)/progress.tsx");
    const stripped = stripComments(src);
    expect(stripped).toMatch(
      /<SupprCard[\s\S]{0,160}testID="progress-3-stat-row"/,
    );
  });
});
