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

describe("mobile recipe-detail v4 — Fix 4 (4-up macro grid, equal-width tiles)", () => {
  it("the macros grid carries `recipe-macros-grid` testID", () => {
    expect(SRC).toMatch(/testID="recipe-macros-grid"/);
  });

  it("macro tiles use `flex: 1` (no `maxWidth: \"48%\"`) so 4 fit on one row", () => {
    // v3 used `flexGrow: 1, maxWidth: "48%"` which forced a 2x2 wrap
    // and left fiber alone on row 2 at half-width. v4 spec: `flex: 1`
    // with `flexWrap` preserved, so all tiles share width.
    expect(SRC).toMatch(/flex:\s*1,\s*minWidth:\s*70/);
    expect(SRC).not.toMatch(/maxWidth:\s*"48%"/);
  });

  it("tiles carry stable per-macro testIDs so RTL renders can target them", () => {
    expect(SRC).toMatch(/testID=\{`recipe-macro-tile-\$\{macro\}`\}/);
  });

  it("macro tile container row uses Spacing.sm gap (8pt) for the 4-up density", () => {
    // Was `gap: 10` in v3 with 2x2 wrap. v4 tightens to Spacing.sm
    // (8pt) to fit 4-up at 393pt without truncation. The `style` prop
    // sits immediately before `testID` on the container View, so the
    // `gap: Spacing.sm` token appears within ~200 chars before the
    // `recipe-macros-grid` testID.
    const gridIdx = SRC.indexOf('testID="recipe-macros-grid"');
    expect(gridIdx).toBeGreaterThan(0);
    const lookbackStart = Math.max(0, gridIdx - 400);
    const lookbackBlock = SRC.slice(lookbackStart, gridIdx);
    expect(lookbackBlock).toMatch(/gap:\s*Spacing\.sm/);
    // And it must not regress to the v3 hard-coded `gap: 10`.
    expect(lookbackBlock).not.toMatch(/gap:\s*10\b/);
  });

  it("macro tiles still use a bold tabular-nums value treatment", () => {
    // v4 dropped `fontSize: 20` to `fontSize: 18` to fit the 4-up
    // grid at 393pt without truncation. Weight 800 + tabular preserved.
    expect(SRC).toMatch(/fontSize:\s*18,\s*fontWeight:\s*"800"/);
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
 * 2026-06-08 — the recipe-detail FRAME (`recipes.md` §315) supersedes the
 * earlier ENG-818 win-amber chip. The "Fits your day" verdict is still a
 * tinted payoff CHIP behind `design_system_colours`, but the palette now flows
 * from the shared `fitsYourDayChipStyle` helper (SAGE for the fits moment, amber
 * for over-budget) so web + mobile render the same frame colours. The legacy
 * flat line stays alive in the `else` (the flag-off path).
 */
describe("mobile recipe-detail — 'Fits your day' payoff chip (frame §315)", () => {
  it("gates the chip on the colour-system flag (old flat line in the else)", () => {
    expect(SRC).toMatch(/isFeatureEnabled\("design_system_colours"\)/);
    expect(SRC).toMatch(/const winFitsChip = commitColours/);
    expect(SRC).toMatch(/if \(winFitsChip\) \{/);
    expect(SRC).toMatch(/Flag OFF keeps the old flat coloured-glyph \+ text line/);
  });

  it("the chip palette comes from the shared frame helper, not inline win-amber", () => {
    const chipIdx = SRC.indexOf("Redesign frame (`recipes.md` §315)");
    expect(chipIdx).toBeGreaterThan(0);
    const block = SRC.slice(chipIdx, chipIdx + 900);
    expect(block).toMatch(/const \{ fg, bg \} = fitsYourDayChipStyle\(verdict\.tone\)/);
    // No more inline win-amber lookup for the fit chip.
    expect(block).not.toMatch(/Accent\.win,\s*bg:\s*Accent\.winSoft/);
  });

  it("the chip is a Radius.full pill with a real background fill", () => {
    const chipIdx = SRC.indexOf("Redesign frame (`recipes.md` §315)");
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
  it("resting detail card consumes `useCardElevation` (shadow/border/lift branch)", () => {
    expect(SRC).toMatch(/import \{ useCardElevation \} from "@\/hooks\/useCardElevation"/);
    expect(SRC).toMatch(/const cardElevation = useCardElevation\(\);/);
    // The card style threads the hook output: lift bg, flag-driven border,
    // and the soft shadow spread.
    expect(SRC).toMatch(/backgroundColor:\s*cardElevation\.liftBg\s*\?\?\s*colors\.card/);
    expect(SRC).toMatch(/borderWidth:\s*cardElevation\.useBorder\s*\?\s*1\s*:\s*0/);
    expect(SRC).toMatch(/\.\.\.\(cardElevation\.shadowStyle\s*\?\?\s*\{\}\)/);
    // And the StyleSheet useMemo depends on it so it re-derives on flag flip.
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
