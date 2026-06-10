// @vitest-environment jsdom
/**
 * useCardElevation — FLAT is the default; SOFT is the opt-in for elevated
 * cards — plus the `Elevation.cardSoft` token values (web ↔ mobile) and the
 * iOS overflow-clip fix that lives in the shared `<SupprCard>` shell.
 *
 * DIRECTION these guard (2026-06-04 "flat slabs" sweep, commit 664df1cb):
 *  1. The Sloe Figma `654:2` Today renders `#F6F5F2` cards AND tiles as
 *     borderless, shadowless warm slabs — the fill against the `#FFFFFF` page
 *     is the separation. So `useCardElevation()` with no args (and the
 *     `SupprCard` `lift` default) returns FLAT: no shadow, no border, no lift.
 *  2. SOFT is the opt-in for the few ELEVATED surfaces that float off the page
 *     — the recipe-card grids/detail (Discover, Library, recipe detail) pass
 *     `{ variant: "soft" }`. When requested, soft adds the ambient drop shadow
 *     (light) / tonal lift + hairline (dark). It is NOT flag-gated (flag-FORCE
 *     is dead in a bundled app, ENG-840, and an `@/lib/analytics` read here
 *     throws under the ~30 consumer tests' partial mocks).
 *  3. iOS clips shadows under `overflow: 'hidden'`, so the soft shadow must
 *     ride an OUTER wrapper separate from the corner-clip. That split now lives
 *     in ONE place — the `<SupprCard>` shell — instead of being re-rolled
 *     (and drifting) per card.
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
import {
  useCardElevation,
  useTodayCardElevation,
} from "../../hooks/useCardElevation";

describe("useCardElevation — FLAT is the default", () => {
  it("the no-arg default is a FLAT slab in LIGHT (no shadow, no border, no lift)", () => {
    // Figma `654:2`: borderless, shadowless warm slab — the `#F6F5F2` fill on
    // the white page is the separation. The no-arg default pins `?? "flat"`.
    themeState.resolved = "light";
    const { result } = renderHook(() => useCardElevation());
    expect(result.current.shadowStyle).toBeUndefined();
    expect(result.current.useBorder).toBe(false);
    expect(result.current.liftBg).toBeUndefined();
  });

  it("the no-arg default is FLAT in DARK too (variant wins over theme)", () => {
    // Flat short-circuits before the dark branch — it returns the same flat
    // shape regardless of theme, so a no-arg card never picks up the dark
    // tonal lift + hairline (that is the SOFT-in-dark treatment).
    themeState.resolved = "dark";
    const { result } = renderHook(() => useCardElevation());
    expect(result.current.shadowStyle).toBeUndefined();
    expect(result.current.useBorder).toBe(false);
    expect(result.current.liftBg).toBeUndefined();
    themeState.resolved = "light"; // restore for later test ordering
  });

  it("useTodayCardElevation() is the named flat wrapper (the FLAT system contract)", () => {
    // The named flat wrapper is the SYSTEM CONTRACT for the flat variant — it
    // stays available for nested/tile surfaces that must not double-shadow.
    // (Page-ground Today cards now opt INTO soft under the one-treatment rule,
    // Grace 2026-06-09, so they no longer call this wrapper — but the wrapper +
    // its flat guarantee are unchanged.)
    themeState.resolved = "light";
    const { result } = renderHook(() => useTodayCardElevation());
    expect(result.current.shadowStyle).toBeUndefined();
    expect(result.current.useBorder).toBe(false);
    expect(result.current.liftBg).toBeUndefined();
  });
});

describe("useCardElevation — SOFT is the opt-in for elevated cards", () => {
  // The recipe-card surfaces (Discover, Library, recipe detail) pass
  // `{ variant: "soft" }` to float off the page. Soft is the ONLY path to the
  // ambient shadow / tonal lift — the default never reaches it.
  it("SOFT in LIGHT carries the drop shadow and drops the border", () => {
    themeState.resolved = "light";
    const { result } = renderHook(() => useCardElevation({ variant: "soft" }));
    // The shadow is the separation — it lifts the card off the white page.
    expect(result.current.shadowStyle).toBe(Elevation.cardSoft);
    // Border dropped (shadow carries it — no double edge, no heavy 1pt box).
    expect(result.current.useBorder).toBe(false);
    // Light keeps the caller's own background (no tonal lift).
    expect(result.current.liftBg).toBeUndefined();
  });

  it("SOFT is NOT gated behind the elevation flag (renders flags-cold)", () => {
    // No flag is mocked ON here — the global `@/lib/analytics` shim resolves
    // every flag OFF / cold. The soft lift must STILL be returned, proving the
    // hook no longer hides the shadow behind `design_system_elevation` (the bug
    // was that a cold/forced-off flag on the sim left the cards flat).
    themeState.resolved = "light";
    const { result } = renderHook(() => useCardElevation({ variant: "soft" }));
    expect(result.current.shadowStyle).toBe(Elevation.cardSoft);
    expect(result.current.shadowStyle?.shadowOpacity).toBeGreaterThan(0);
  });

  it("SOFT in DARK uses a tonal lift + hairline, never a (poorly-rendered) shadow", () => {
    themeState.resolved = "dark";
    const { result } = renderHook(() => useCardElevation({ variant: "soft" }));
    expect(result.current.shadowStyle).toBeUndefined();
    expect(result.current.useBorder).toBe(true);
    expect(result.current.liftBg).toBe(themeState.colors.cardElevated);
    // restore for any later test ordering
    themeState.resolved = "light";
  });
});

describe("Elevation.cardSoft — the 16% soft lift, web ↔ mobile", () => {
  it("is bumped to 16% opacity (Grace 'cards still blend on-device', 2026-06-04)", () => {
    // The lever the founder asked for, twice: opacity 0.07 → 0.10 → 0.16. The
    // second bump is because edge-pixel sampling on the sim PROVED the shadow
    // was rendering but too weak — the #F6F5F2 fill sits only ~10 lum below the
    // #FFFFFF page, so the shadow must do all the lifting, and 10% read flat.
    // Pinned EXACTLY at 0.16 (not a band) — the value is the point of the change.
    expect(Elevation.cardSoft.shadowOpacity).toBe(0.16);
  });

  it("sits in the premium band (radius soft + wide, y-offset small)", () => {
    // Premium band (Grace red-lines a Material drop shadow as cheap): the radius
    // widened 12 → 14 → 18 and the y-offset 4 → 6 alongside the opacity bumps.
    // The wide radius keeps the penumbra long/ambient so the stronger shadow
    // still reads soft, not as a hard floating-card drop shadow.
    expect(Elevation.cardSoft.shadowRadius).toBe(18);
    expect(Elevation.cardSoft.shadowOffset.height).toBe(6);
  });

  it("is plum/aubergine-tinted (the Sloe ink), matching the web token exactly", () => {
    // #221B26 == rgba(34,27,38) == web --elev-card-soft colour. Keeps web ==
    // mobile and reads as a calm plum-tinted ambient shadow, not pure black.
    expect(Elevation.cardSoft.shadowColor.toLowerCase()).toBe("#221b26");
  });

  it("matches the web --elev-card-soft token EXACTLY (16% / 18px / y+6 / Sloe ink)", () => {
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
    // 0 6px 18px rgba(34, 27, 38, 0.16) — y+6, radius 18, Sloe ink at 16%.
    expect(webToken).toBe("0 6px 18px rgba(34, 27, 38, 0.16)");
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

  it("Progress energy stat row routes through the <SupprCard> shell", () => {
    // The founder-visible Progress AVG/TDEE/DEFICIT stat row was extracted from
    // an inline single `progress-3-stat-row` card into the <ProgressEnergyTriad>
    // component (three discrete stat cards). The elevation-shell intent is
    // preserved — each stat card is a <SupprCard> inside the component — so we
    // assert (a) progress.tsx renders the triad, and (b) the triad routes its
    // stats through the SupprCard shell (testIDs on the shells).
    const progress = stripComments(read("app/(tabs)/progress.tsx"));
    expect(progress).toMatch(/<ProgressEnergyTriad\b/);

    const triad = stripComments(read("components/progress/ProgressEnergyTriad.tsx"));
    expect(triad).toMatch(/from ["']@\/components\/ui\/SupprCard["']/);
    expect(triad).toMatch(/<SupprCard[\s\S]{0,160}testID="progress-energy-avg-intake"/);
    expect(triad).toMatch(/<SupprCard[\s\S]{0,160}testID="progress-energy-tdee"/);
    expect(triad).toMatch(/<SupprCard[\s\S]{0,160}testID="progress-energy-deficit"/);
  });
});
