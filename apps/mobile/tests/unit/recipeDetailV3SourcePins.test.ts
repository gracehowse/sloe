/**
 * 2026-05-01 v3 redesign — mobile source-pin parity for the
 * recipe-detail rewrite.
 *
 * 2026-05-02 v4 polish (recipe-detail-tiles-and-kcal): two visual
 * fixes against v3 from user feedback:
 *   - "the widgets should be the same size and fit on one row" →
 *     macro tiles use `flex: 1` (no `maxWidth: "48%"`) so 4 fit on
 *     one row at iPhone 14/15/16 Pro 393pt widths, with `flexWrap`
 *     preserved for narrow widths and 5–6-tracked-macro users.
 *   - "cals need to be clearer" → kcal got promoted out of the
 *     subtitle row into its own dedicated headline line directly
 *     under the title ("329 kcal · per portion" at 17-pt).
 *
 * `apps/mobile/app/recipe/[id].tsx` is a 2k+ LOC component wired to
 * Supabase, expo-router, planner deeplinks, cook mode, and a stack of
 * sub-dialogs — mounting it for an isolated layout assertion would
 * require a sandbox of mocks. We pin the structural contract via
 * source-string regex (matches the existing `screenAuditFixesParity`
 * idiom).
 *
 * If this test breaks, the recipe-detail redesign has regressed on
 * mobile.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const MOBILE_RECIPE = resolve(__dirname, "../../app/recipe/[id].tsx");
const SRC = readFileSync(MOBILE_RECIPE, "utf8");

describe("mobile recipe-detail v4 — Fix 1 (subtitle + dedicated kcal line)", () => {
  it("composeSubtitleParts is NOT passed a kcal arg in v4 (kcal lives on its own line)", () => {
    // v3 passed `kcal: kcalForSubtitle` so the helper would emit a
    // `kcal` part inline. v4 removes that — kcal renders on a
    // dedicated headline line above the subtitle. Pin the call site
    // directly: the call must not include `kcal:` as a property.
    const callIdx = SRC.indexOf("composeSubtitleParts({");
    expect(callIdx).toBeGreaterThan(0);
    const closeIdx = SRC.indexOf("})", callIdx);
    expect(closeIdx).toBeGreaterThan(callIdx);
    const callBlock = SRC.slice(callIdx, closeIdx + 2);
    expect(callBlock).not.toMatch(/\bkcal:/);
  });

  it("subtitle no longer renders the v3 inline `recipe-subtitle-kcal` testID", () => {
    expect(SRC).not.toMatch(/"recipe-subtitle-kcal"/);
  });

  it("dedicated kcal headline line exists with `recipe-kcal-line` + `recipe-kcal-number`", () => {
    expect(SRC).toMatch(/testID="recipe-kcal-line"/);
    expect(SRC).toMatch(/testID="recipe-kcal-number"/);
  });

  it("kcal line uses 17-pt headline weight + tabular-nums + foreground colour", () => {
    expect(SRC).toMatch(/kcalNumber:\s*\{[\s\S]*?fontSize:\s*17/);
    expect(SRC).toMatch(/kcalNumber:\s*\{[\s\S]*?fontWeight:\s*"700"/);
    expect(SRC).toMatch(/kcalNumber:\s*\{[\s\S]*?color:\s*colors\.text/);
    expect(SRC).toMatch(/kcalNumber:\s*\{[\s\S]*?fontVariant:\s*\["tabular-nums"\]/);
  });

  it("kcal line renders `<N> kcal · per portion`", () => {
    expect(SRC).toMatch(/per portion/);
    expect(SRC).toMatch(/\{kcalForLine\}\s*kcal/);
  });

  it("kcal line is gated on `kcalForLine <= 0` (no `0 kcal` for un-imported recipes)", () => {
    // P1-16 behaviour preserved: the dimmed nutrition-pending
    // placeholder must take over when kcal is unknown.
    expect(SRC).toMatch(/if\s*\(\s*kcalForLine\s*<=\s*0\s*\)\s*return\s+null;/);
  });

  it("subtitleTextStrong style is still defined (for any future bold inline tokens)", () => {
    // The style itself remains in StyleSheet (refactor scope is
    // layout, not style grooming) but it's no longer applied to the
    // subtitle's kcal part because there's no kcal part any more.
    expect(SRC).toMatch(/subtitleTextStrong/);
  });
});

describe("mobile recipe-detail v3 — Fix 2 (compact time stats — preserved)", () => {
  it("time-stats row is gated by shouldRenderTimeStats", () => {
    expect(SRC).toMatch(/shouldRenderTimeStats\(/);
    expect(SRC).toMatch(/testID="recipe-time-stats"/);
  });

  it("compact form renders `<X> prep · <Y> cook`, not 4-tile icon-circle row", () => {
    expect(SRC).toMatch(/\$\{formatMinutes\(prepMin\)\}\s*prep/);
    expect(SRC).toMatch(/\$\{formatMinutes\(cookMin\)\}\s*cook/);
  });

  it("the old icon-circle infoRow style is gone", () => {
    expect(SRC).not.toMatch(/infoRow:\s*\{\s*flexDirection:\s*"row",\s*justifyContent:\s*"space-around"/);
    expect(SRC).not.toMatch(/<View style=\{styles\.infoRow\}/);
  });
});

describe("mobile recipe-detail v3 — Fix 3 (kcal hero card removed)", () => {
  it("the bordered kcal hero card is gone — no `recipe-calorie-hero` testID", () => {
    expect(SRC).not.toMatch(/testID="recipe-calorie-hero"/);
  });

  it("the dimmed pending placeholder has its own testID", () => {
    expect(SRC).toMatch(/testID="recipe-nutrition-pending"/);
    expect(SRC).toMatch(/Calories not yet computed[^"]*open the Ingredients tab/);
  });

  it("the hero `MacroColors.calories + \"55\"` border treatment is gone", () => {
    // The only remaining MacroColors.calories reference should be the
    // macro-tile fiber tint (which uses the calories token as a proxy
    // colour). The bordered hero with "55" alpha border is gone.
    expect(SRC).not.toMatch(
      /borderColor:\s*hasNutrition\s*\?\s*MacroColors\.calories\s*\+\s*"55"/,
    );
  });
});

describe("mobile recipe-detail — macro summary is the ENG-920 flat Figma 332:2 strip", () => {
  // ENG-920 (resolved 2026-06-07): the macro summary renders as a FLAT NUMBER
  // STRIP (CAL / PRO / CARB / FAT — calories first), serif Newsreader value +
  // small-caps label, four equal columns in one white slab, NO per-macro
  // progress bar. Replaces the v4 progress-bar tiles. Net-carbs lens + all
  // tracked values preserved (micros fall to a chip row).
  it("the strip carries `recipe-macros-grid` testID and leads with CAL", () => {
    expect(SRC).toMatch(/testID="recipe-macros-grid"/);
    expect(SRC).toContain("macroStrip");
    expect(SRC).toContain('label: "CAL"');
    expect(SRC).toContain('label: "PRO"');
    expect(SRC).toContain('label: "FAT"');
  });

  it("strip columns carry stable per-macro testIDs keyed by macro key", () => {
    expect(SRC).toMatch(/testID=\{`recipe-macro-tile-\$\{m\.key\}`\}/);
  });

  it("strip values render in the Newsreader serif at 24px (not the old sans bold tile)", () => {
    const strip = SRC.slice(
      SRC.indexOf('testID="recipe-macros-grid"'),
      SRC.indexOf("recipe-macro-micro-chips"),
    );
    expect(strip).toContain("FontFamily.serifRegular");
    expect(strip).toContain("fontSize: 24");
    // Flat strip: NO per-macro progress-bar fill (the old `width: %` bar).
    expect(strip).not.toMatch(/width:\s*`\$\{Math\.min\(m\.cur/);
    // Column dividers via borderLeft (the strip column rule).
    expect(strip).toContain("borderLeftWidth");
  });

  it("the old per-macro progress-bar tile structure is gone", () => {
    // v4 tiles used `flex: 1, minWidth: 70` + a `width: %` fill bar.
    expect(SRC).not.toMatch(/flex:\s*1,\s*minWidth:\s*70/);
    expect(SRC).not.toMatch(/maxWidth:\s*"48%"/);
    // The stale "ENG-920 ... DEFERRED" comment is gone (now resolved).
    expect(SRC).not.toMatch(/ENG-920[^]*?DEFERRED/);
  });

  it("net-carbs lens preserved (label + value swap via shared helpers)", () => {
    expect(SRC).toContain("carbsLabel(");
    expect(SRC).toContain("netCarbsForRow(");
    expect(SRC).toContain('? "NET" : "CARB"');
  });

  it("tracked micros (fiber/sugar/sodium) fall to a chip row — no value dropped", () => {
    expect(SRC).toContain("recipe-macro-micro-chips");
    expect(SRC).toMatch(/recipeMacrosToShow\.includes\("fiber"\)/);
    expect(SRC).toMatch(/recipeMacrosToShow\.includes\("sugar"\)/);
    expect(SRC).toMatch(/recipeMacrosToShow\.includes\("sodium"\)/);
  });
});

describe("mobile recipe-detail v3 — Fix 5 (Fits your day softened)", () => {
  it("verdict logic delegates to the shared `computeFitsYourDayVerdict` helper", () => {
    expect(SRC).toMatch(/computeFitsYourDayVerdict\(\{/);
  });

  it("the flag-OFF legacy path is still a plain text line (no pill bg)", () => {
    // ENG-818 keeps the legacy flat coloured-text line alive in the
    // `else` of the `winFitsChip` gate. Pin THAT path (the second
    // `testID="recipe-fits-your-day"` occurrence) to make sure the
    // flag-off render is unchanged.
    const first = SRC.indexOf('testID="recipe-fits-your-day"');
    const second = SRC.indexOf('testID="recipe-fits-your-day"', first + 1);
    expect(second).toBeGreaterThan(first);
    const legacyBlock = SRC.slice(second, second + 600);
    expect(legacyBlock).not.toMatch(/borderRadius:\s*Radius\.full,\s*backgroundColor:/);
  });
});

/**
 * ENG-818 (Redesign — Design Direction 2026) — the "Fits your day" verdict is
 * promoted to a tinted payoff CHIP behind `design_system_colours`. When it fits
 * well it uses the dedicated landmark WIN amber (`Accent.win` / `Accent.winSoft`)
 * — the reserved "genuine win" colour, NOT generic success-green. The legacy
 * flat line stays alive in the `else` (the flag-off path).
 */
describe("mobile recipe-detail — ENG-818 'Fits your day' payoff chip", () => {
  it("gates the chip on the colour-system flag (old flat line in the else)", () => {
    expect(SRC).toMatch(/isFeatureEnabled\("design_system_colours"\)/);
    expect(SRC).toMatch(/const winFitsChip = commitColours/);
    expect(SRC).toMatch(/if \(winFitsChip\) \{/);
    expect(SRC).toMatch(/Flag-off legacy path — flat coloured glyph \+ text line/);
  });

  it("the fits-well chip uses the WIN amber token, not success-green", () => {
    const chipIdx = SRC.indexOf("ENG-818 (Redesign — Design Direction 2026)");
    expect(chipIdx).toBeGreaterThan(0);
    const block = SRC.slice(chipIdx, chipIdx + 1400);
    // success tone → win amber + winSoft tint (the landmark colour).
    expect(block).toMatch(/success:\s*\{\s*fg:\s*Accent\.win,\s*bg:\s*Accent\.winSoft\s*\}/);
  });

  it("over-half → warning tint; over-a-day → destructive tint (semantic tones)", () => {
    const chipIdx = SRC.indexOf("ENG-818 (Redesign — Design Direction 2026)");
    const block = SRC.slice(chipIdx, chipIdx + 1400);
    expect(block).toMatch(/warning:\s*\{\s*fg:\s*Accent\.warning/);
    expect(block).toMatch(/destructive:\s*\{[\s\S]{0,80}fg:\s*Accent\.destructive/);
  });

  it("the chip is a Radius.full pill with a real background fill", () => {
    const chipIdx = SRC.indexOf("ENG-818 (Redesign — Design Direction 2026)");
    const block = SRC.slice(chipIdx, chipIdx + 2200);
    expect(block).toMatch(/borderRadius:\s*Radius\.full,\s*\n\s*backgroundColor:\s*bg/);
  });

  it("a11y contract preserved — accessibilityLabel on BOTH paths", () => {
    const matches = SRC.match(/testID="recipe-fits-your-day"/g) ?? [];
    expect(matches.length).toBe(2); // chip path + legacy path
    expect(SRC).toMatch(/accessibilityLabel=\{verdict\.a11y\}/);
  });
});

/**
 * ENG-818/819 — soft elevation on the resting detail cards (via
 * `useCardElevation`) + the quiet confirm haptic on the commit CTAs (Log all /
 * Log / Start Cooking). Both flag-gated; flag-off keeps today's flat/hairline
 * card + silent commit.
 */
describe("mobile recipe-detail — ENG-818/819 elevation + commit haptics", () => {
  it("resting detail card is a WHITE slab on cream with the soft `useCardElevation` lift (Figma 332:2)", () => {
    expect(SRC).toMatch(/import \{ useCardElevation \} from "@\/hooks\/useCardElevation"/);
    // Superseded 2026-06-07 (Figma 332:2): the page is cream, so the card is
    // an UNCONDITIONAL white slab (the `soft` variant carries the lift); the
    // dark tonal-lift branch still resolves via `liftBg`.
    expect(SRC).toMatch(/const cardElevation = useCardElevation\(\{ variant: "soft" \}\);/);
    // White fill on light (`colors.background`), tonal lift on dark (`liftBg`).
    expect(SRC).toMatch(/backgroundColor:\s*cardElevation\.liftBg\s*\?\?\s*colors\.background/);
    // Always-on hairline (cardBorder) — the slab is delineated even before the
    // shadow renders — plus the soft shadow spread.
    expect(SRC).toMatch(/borderColor:\s*colors\.cardBorder/);
    expect(SRC).toMatch(/\.\.\.\(cardElevation\.shadowStyle\s*\?\?\s*\{\}\)/);
    // And the StyleSheet useMemo depends on it so it re-derives on theme flip.
    expect(SRC).toMatch(/\}\), \[colors, insets\.top, cardElevation\]\)/);
  });

  it("commit CTAs are PressableScale with a flag-gated confirm/success haptic", () => {
    expect(SRC).toMatch(/import \{ PressableScale \} from "@\/components\/ui\/PressableScale"/);
    expect(SRC).toMatch(/const winMomentFeedback = isFeatureEnabled\("redesign_winmoment"\)/);
    // In-body Log + Start Cooking → quiet `confirm`; flag-off → `none`.
    const confirmUses = SRC.match(/haptic=\{winMomentFeedback \? "confirm" : "none"\}/g) ?? [];
    expect(confirmUses.length).toBeGreaterThanOrEqual(2);
    // Sticky "Log all" (whole-recipe landmark commit) → heavier `success`.
    expect(SRC).toMatch(/haptic=\{winMomentFeedback \? "success" : "none"\}/);
    // The sticky CTA is the PressableScale (not a bare Pressable any more).
    expect(SRC).toMatch(
      /<PressableScale[\s\S]{0,600}testID="recipe-detail-sticky-log-cta"/,
    );
  });
});

describe("mobile recipe-detail v3 — Fix 6 (calorieNumber style retired at call site)", () => {
  it("the legacy `calorieNumber` 26-pt extra-bold style is unused at the call site", () => {
    // The style itself can stay in the StyleSheet (other stale
    // entries do — refactor scope is layout, not StyleSheet
    // grooming), but the JSX must not reference it any more.
    expect(SRC).not.toMatch(/<Text\s+style=\{\[styles\.calorieNumber/);
  });
});
