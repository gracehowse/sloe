/**
 * Recipe-detail source-pin parity (mobile).
 *
 * History of this contract:
 *   - 2026-05-01 v3 redesign — first source-pin of the recipe-detail rewrite.
 *   - 2026-05-02 v4 polish — promoted kcal to its own headline line, 4-up tiles.
 *   - 2026-06-07 ENG-920 / Figma 332:2 — the recipe-detail screen was rebuilt
 *     as a cream editorial page with EXTRACTED components. The intermediate
 *     v3/v4 inline structure (a dedicated kcal headline line, an inline macro
 *     grid with per-macro progress bars, a flag-gated win-amber "Fits your day"
 *     chip) is SUPERSEDED. The canonical structure now lives in:
 *       - `components/recipe/RecipeMacroStrip.tsx`  — the flat CAL/PRO/CARB/FAT
 *         serif number strip (testID `recipe-macros-grid`). kcal is the CAL
 *         column here, NOT a separate headline line.
 *       - `components/recipe/RecipeTitleBlock.tsx`  — title + attribution +
 *         the single (unflagged) "Fits your day" verdict chip.
 *       - `components/recipe/RecipeMetaRow.tsx`      — the `⏱ time · 🗂 items`
 *         meta row (replaces the v3 `prep · cook` time-stats line).
 *       - `components/recipe/RecipeActionPills.tsx`  /
 *         `components/recipe/RecipeServingsFooter.tsx` — `PressableScale`
 *         commit CTAs with the flag-gated confirm haptic.
 *
 * These screens are 2k+ LOC wired to Supabase / expo-router / cook mode, so we
 * pin the structural contract via source-string regex against the screen AND
 * its extracted components (the `screenAuditFixesParity` idiom). If this test
 * breaks, the recipe-detail redesign has regressed on mobile.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const read = (rel: string) => readFileSync(resolve(__dirname, rel), "utf8");

const SRC = read("../../app/recipe/[id].tsx");
const MACRO_STRIP = read("../../components/recipe/RecipeMacroStrip.tsx");
const TITLE_BLOCK = read("../../components/recipe/RecipeTitleBlock.tsx");
const META_ROW = read("../../components/recipe/RecipeMetaRow.tsx");
const ACTION_PILLS = read("../../components/recipe/RecipeActionPills.tsx");
const SERVINGS_FOOTER = read("../../components/recipe/RecipeServingsFooter.tsx");

describe("mobile recipe-detail — kcal lives in the macro strip CAL column (ENG-920 / Figma 332:2)", () => {
  it("kcal is NOT composed into the subtitle (no inline subtitle kcal arg)", () => {
    // The v3/v4 `composeSubtitleParts({ kcal })` inline subtitle is gone — the
    // screen no longer composes a subtitle row at all. If a future change
    // reintroduces a subtitle call, it must not smuggle kcal back inline.
    const callIdx = SRC.indexOf("composeSubtitleParts({");
    if (callIdx >= 0) {
      const closeIdx = SRC.indexOf("})", callIdx);
      expect(closeIdx).toBeGreaterThan(callIdx);
      const callBlock = SRC.slice(callIdx, closeIdx + 2);
      expect(callBlock).not.toMatch(/\bkcal:/);
    } else {
      expect(SRC).not.toContain("composeSubtitleParts(");
    }
  });

  it("the v3 inline `recipe-subtitle-kcal` testID is gone", () => {
    expect(SRC).not.toMatch(/"recipe-subtitle-kcal"/);
  });

  it("the v4 dedicated kcal headline line is gone — kcal is the CAL strip column", () => {
    // Superseded by Figma 332:2: there is no separate `recipe-kcal-line`. kcal
    // renders as the leading CAL column of the macro strip.
    expect(SRC).not.toMatch(/testID="recipe-kcal-line"/);
    expect(SRC).not.toMatch(/testID="recipe-kcal-number"/);
    expect(SRC).toContain('{ key: "calories" as const, label: "CAL"');
    expect(SRC).toMatch(/value:\s*`\$\{Math\.round\(macros\.calories\)\}`/);
  });

  it("the CAL value renders in the Newsreader serif + tabular-nums + plum (calories token)", () => {
    // The CAL number is the macro-strip value: serif 24px, tabular-nums, plum
    // (the aubergine `navPrimary` token), NOT the retired 17-pt sans headline.
    // Font-consistency sweep (ENG-1630): the hand-duplicated
    // `fontFamily: FontFamily.serifRegular, fontSize: 24, lineHeight: 28,
    // fontWeight: "400"` literal was replaced by the canonical `Type.title`
    // token, which resolves to those exact same values (plus letterSpacing).
    expect(MACRO_STRIP).toMatch(/\.\.\.Type\.title/);
    expect(MACRO_STRIP).toMatch(/fontVariant:\s*\["tabular-nums"\]/);
    // calories column colour comes from the plum token, not a hardcoded hex.
    // ENG-1223: `macroValueColor` is now scheme-aware (takes `isDark`); calories
    // still returns the passed plum (navPrimary), the other macros resolve via
    // the scheme-aware `macroColorFor`.
    expect(MACRO_STRIP).toMatch(/macroValueColor\(cell\.key,\s*colors\.navPrimary,\s*isDark\)/);
    expect(MACRO_STRIP).toMatch(/if \(key === "calories"\) return plum;/);
  });

  it("the macro card carries a per-serving accessibility label (`per portion` semantics)", () => {
    // v4 rendered `<N> kcal · per portion` as a headline; the per-serving
    // framing now lives on the strip's accessibility label.
    expect(MACRO_STRIP).toMatch(/accessibilityLabel="Nutrition per serving"/);
  });

  it("the macro card is gated on `hasNutrition` — no `0 kcal` for un-imported recipes", () => {
    // P1-16 behaviour preserved via the dimmed pending placeholder: when no
    // macro is > 0 the strip is replaced by `recipe-nutrition-pending`.
    expect(SRC).toMatch(/const hasNutrition =/);
    expect(SRC).toMatch(/if\s*\(\s*!hasNutrition\s*\)\s*\{/);
    expect(SRC).toMatch(/return <RecipeMacroStrip cells=\{macroCells\} variant=\{recipeDetailV3 \? "borderless" : "slab"\} \/>;/);
  });

  it("the macro-strip label uses the canonical Type.label eyebrow token", () => {
    // Re-pinned: headers census 2026-06-10. The hand-rolled small-caps caption
    // (sansSemibold 10/600/ls1/uppercase) converged onto the Type.label token —
    // the single eyebrow voice (sansBold 11/700/0.88/uppercase). The token now
    // carries the family + tracking + uppercase; the call site sets the
    // textSecondary colour. The old per-property pins are superseded.
    expect(MACRO_STRIP).toMatch(/\.\.\.Type\.label/);
    expect(MACRO_STRIP).toMatch(/color:\s*colors\.textSecondary/);
    // The off-ramp 10px private size is gone.
    expect(MACRO_STRIP).not.toMatch(/fontSize:\s*10\b/);
  });
});

describe("mobile recipe-detail — meta row replaces the v3 compact time-stats line", () => {
  it("time + item-count stats come from the shared `composeRecipeMeta` helper", () => {
    // The v3 `shouldRenderTimeStats` + inline `<X> prep · <Y> cook` line is
    // superseded by the `RecipeMetaRow` (Figma §5), fed by `composeRecipeMeta`
    // so web + mobile surface identical visible stats.
    expect(SRC).toMatch(/const metaStats = composeRecipeMeta\(\{/);
    expect(SRC).toMatch(/<RecipeMetaRow stats=\{metaStats\} \/>/);
    expect(META_ROW).toMatch(/testID="recipe-meta-row"/);
  });

  it("the meta row renders icon + text (clock / item-list), not a 4-tile icon-circle row", () => {
    // Figma §5: `⏱ time · 🗂 items` as icon + Inter 14px, gated to render
    // nothing when no stat is known (`if (stats.length === 0) return null`).
    expect(META_ROW).toMatch(/if \(stats\.length === 0\) return null;/);
    expect(META_ROW).toMatch(/<Clock size=\{15\}/);
    expect(META_ROW).toMatch(/<LayoutList size=\{15\}/);
  });

  it("the old icon-circle infoRow style is gone", () => {
    expect(SRC).not.toMatch(/infoRow:\s*\{\s*flexDirection:\s*"row",\s*justifyContent:\s*"space-around"/);
    expect(SRC).not.toMatch(/<View style=\{styles\.infoRow\}/);
  });
});

describe("mobile recipe-detail — kcal hero card removed (Fix 3)", () => {
  it("the bordered kcal hero card is gone — no `recipe-calorie-hero` testID", () => {
    expect(SRC).not.toMatch(/testID="recipe-calorie-hero"/);
  });

  it("the dimmed pending placeholder has its own testID + accessible copy", () => {
    expect(SRC).toMatch(/testID="recipe-nutrition-pending"/);
    // Canonical copy (Figma 332:2): points the user to the ingredients to verify.
    expect(SRC).toMatch(/Calories not yet computed — open the ingredients to verify/);
    expect(SRC).toMatch(/accessibilityLabel="Calories not yet computed for this recipe"/);
  });

  it("the hero `MacroColors.calories + \"55\"` border treatment is gone", () => {
    expect(SRC).not.toMatch(
      /borderColor:\s*hasNutrition\s*\?\s*MacroColors\.calories\s*\+\s*"55"/,
    );
  });
});

describe("mobile recipe-detail — macro summary is the ENG-920 flat Figma 332:2 strip", () => {
  // ENG-920 (resolved 2026-06-07): the macro summary renders as a FLAT NUMBER
  // STRIP (CAL / PRO / CARB / FAT — calories first), serif Newsreader value +
  // small-caps label, four equal columns in one slab, NO per-macro progress
  // bar. Net-carbs lens + all tracked values preserved (micros fall to a chip
  // row). The strip is the extracted `RecipeMacroStrip`; the cell data + net
  // lens + micro chips are assembled on the screen.
  it("the strip carries `recipe-macros-grid` testID and leads with CAL", () => {
    expect(MACRO_STRIP).toMatch(/testID="recipe-macros-grid"/);
    expect(SRC).toContain('label: "CAL"');
    expect(SRC).toContain('label: "PRO"');
    expect(SRC).toContain('label: "FAT"');
    // CAL is the first cell of the strip (calories first).
    const calIdx = SRC.indexOf('label: "CAL"');
    const proIdx = SRC.indexOf('label: "PRO"');
    expect(calIdx).toBeGreaterThan(0);
    expect(calIdx).toBeLessThan(proIdx);
  });

  it("strip columns carry stable per-macro testIDs keyed by macro key", () => {
    expect(MACRO_STRIP).toMatch(/testID=\{`recipe-macro-tile-\$\{cell\.key\}`\}/);
  });

  it("strip values render in the Newsreader serif at 24px (not the old sans bold tile)", () => {
    // Font-consistency sweep (ENG-1630): pinned via the `Type.title` token
    // (serifRegular/24/28/400) rather than a hand-duplicated literal — see
    // the token definition in constants/theme.ts.
    expect(MACRO_STRIP).toContain("...Type.title");
    // Flat strip: NO per-macro progress-bar fill (the old `width: %` bar).
    expect(MACRO_STRIP).not.toMatch(/width:\s*`\$\{Math\.min\(/);
    // Column dividers via borderLeft (the strip column rule).
    expect(MACRO_STRIP).toContain("borderLeftWidth");
  });

  it("the old per-macro progress-bar tile structure is gone", () => {
    // v4 tiles used `flex: 1, minWidth: 70` + a `width: %` fill bar.
    expect(SRC).not.toMatch(/flex:\s*1,\s*minWidth:\s*70/);
    expect(SRC).not.toMatch(/maxWidth:\s*"48%"/);
    expect(MACRO_STRIP).not.toMatch(/flex:\s*1,\s*minWidth:\s*70/);
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

/**
 * 'Fits your day' verdict — re-pinned 2026-07-19 (ENG-1612). Grace flagged
 * the ENG-1085 confident SOLID full-width banner as "too big and agressive"
 * (annotated screenshot, Soothing Chicken Congee). ENG-1612 supersedes the
 * ENG-1085/ENG-1356 ruling that kept the banner SOLID — canon is the
 * prototype `.rd-fits` inline soft pill (11px semibold, `*Soft` tone tint,
 * 4/12 padding, full radius), same scale as the card-level `.fit-tag`. Ships
 * behind `recipe_verdict_chip_v1` (default-OFF): flag-on renders the soft
 * chip, flag-off keeps the ENG-1085 solid banner as the kill switch — see
 * docs/decisions/2026-07-19-fits-your-day-verdict-chip.md.
 */
describe("mobile recipe-detail — 'Fits your day' verdict (ENG-1612, flag-gated chip)", () => {
  it("verdict logic delegates to the shared `computeFitsYourDayVerdict` helper", () => {
    expect(SRC).toMatch(/computeFitsYourDayVerdict\(\{/);
  });

  it("rendering is gated on `recipe_verdict_chip_v1` — exactly two source blocks (chip + legacy banner)", () => {
    // Both branches of the ternary render the same testID; only one mounts at
    // runtime depending on the flag. Two textual occurrences, not one — the
    // ENG-1356 "unconditional, exactly one block" pin no longer holds.
    const matches = TITLE_BLOCK.match(/testID="recipe-fits-your-day"/g) ?? [];
    expect(matches.length).toBe(2);
    expect(TITLE_BLOCK).toMatch(/isFeatureEnabled\("recipe_verdict_chip_v1"\)/);
    expect(TITLE_BLOCK).toMatch(/const verdictChipV1 = isFeatureEnabled/);
  });

  it("the chip palette is tinted from `verdict.tone`, not an inline win-amber lookup", () => {
    expect(TITLE_BLOCK).toMatch(/verdict\.tone === "success"/);
    expect(TITLE_BLOCK).toMatch(/verdict\.tone === "warning"/);
    // No inline win-amber lookup for the fit chip.
    expect(TITLE_BLOCK).not.toMatch(/Accent\.win,\s*bg:\s*Accent\.winSoft/);
    // Over-budget tones use the warning/destructive tokens, never a raw hex.
    expect(TITLE_BLOCK).toMatch(/Accent\.warningSolid/);
    expect(TITLE_BLOCK).toMatch(/Accent\.destructiveSolid/);
  });

  it("flag-ON path renders an inline soft chip — 11px semibold, *Soft tone tint, 4/12 padding, full radius", () => {
    const chipIdx = TITLE_BLOCK.indexOf('testID="recipe-fits-your-day"');
    expect(chipIdx).toBeGreaterThan(0);
    const chip = TITLE_BLOCK.slice(chipIdx, chipIdx + 700);
    expect(chip).toMatch(/paddingHorizontal:\s*Spacing\.dense/);
    expect(chip).toMatch(/paddingVertical:\s*Spacing\.xs/);
    expect(chip).toMatch(/borderRadius:\s*Radius\.full/);
    expect(chip).toMatch(/fontSize:\s*11/);
    expect(chip).toMatch(/fontWeight:\s*"600"/);
    expect(chip).toMatch(/backgroundColor:\s*chipTone\.bg/);
    expect(chip).not.toMatch(/alignSelf:\s*"stretch"/);
  });

  it("chip tone pairs `*Soft` bg with AA-safe text — warning reads `warningSolid`, not the 2.96:1 base tone", () => {
    expect(TITLE_BLOCK).toMatch(/\{ bg: Accent\.successSoft, fg: Accent\.success \}/);
    expect(TITLE_BLOCK).toMatch(/\{ bg: Accent\.warningSoft, fg: Accent\.warningSolid \}/);
    expect(TITLE_BLOCK).toMatch(/\{ bg: Accent\.destructiveSoft, fg: Accent\.destructive \}/);
  });

  it("flag-OFF path keeps the ENG-1085 confident full-bleed solid banner (kill switch)", () => {
    // A full-bleed (alignSelf stretch) Radius.xl banner filled with the SOLID
    // tone token + white text — not the legacy 10%-wash pill (ENG-1356), and
    // not the new ENG-1612 soft chip.
    expect(TITLE_BLOCK).toMatch(/alignSelf:\s*"stretch"/);
    expect(TITLE_BLOCK).toMatch(/borderRadius:\s*Radius\.xl,\s*\n\s*backgroundColor:\s*bannerBg/);
    expect(TITLE_BLOCK).toMatch(/color:\s*Accent\.primaryForeground/);
    // Legacy 10%-wash pill (verdictTone.bg) is fully removed.
    expect(TITLE_BLOCK).not.toMatch(/verdictTone/);
  });

  it("a11y contract preserved — accessibilityLabel from the verdict on both branches", () => {
    const uses = TITLE_BLOCK.match(/accessibilityLabel=\{verdict\.a11y\}/g) ?? [];
    expect(uses.length).toBe(2);
  });

  it("the win-moment haptic fires on `fits` regardless of chip/banner treatment", () => {
    expect(TITLE_BLOCK).toMatch(/if \(fits\) \{\s*\n\s*haptics\.success\(\);/);
  });
});

/**
 * ENG-818/819 — soft elevation on the resting detail cards (via
 * `useCardElevation`) + the quiet confirm haptic on the commit CTAs (Cook Mode
 * / Log / servings stepper). Flag-gated; flag-off keeps the flat/hairline card
 * + silent commit.
 */
describe("mobile recipe-detail — ENG-818/819 elevation + commit haptics", () => {
  it("resting detail card is a WHITE slab on cream with the soft `useCardElevation` lift (Figma 332:2)", () => {
    expect(SRC).toMatch(/import \{ useCardElevation \} from "@\/hooks\/useCardElevation"/);
    // The page is cream, so the card is an UNCONDITIONAL white slab (the `soft`
    // variant carries the lift); the dark tonal-lift branch resolves via `liftBg`.
    expect(SRC).toMatch(/const cardElevation = useCardElevation\(\{ variant: "soft" \}\);/);
    // §1 inversion (2026-06-10): colors.card IS white now — the old
    // `colors.background` fill went cream-on-cream when the ground
    // inverted, so the card reads the canonical card token.
    expect(SRC).toMatch(/backgroundColor:\s*cardElevation\.liftBg\s*\?\?\s*colors\.card/);
    // Always-on hairline (cardBorder) — the slab is delineated even before the
    // shadow renders — plus the soft shadow spread.
    expect(SRC).toMatch(/borderColor:\s*colors\.cardBorder/);
    expect(SRC).toMatch(/\.\.\.\(cardElevation\.shadowStyle\s*\?\?\s*\{\}\)/);
    // And the StyleSheet useMemo depends on it so it re-derives on theme flip.
    expect(SRC).toMatch(/\}\),\s*\[colors,\s*cardElevation,\s*accent\]\)/);
  });

  it("commit CTAs are PressableScale with a flag-gated confirm haptic", () => {
    // The commit CTAs (Start Cooking / Log / Cook Mode / servings) are
    // `PressableScale` in the extracted action-pill + footer components, fed a
    // flag-gated haptic from the screen.
    // ENG-1079: the action-pill commit CTAs (Log/Add) migrated to SupprButton,
    // which wraps PressableScale internally and takes the flag-gated haptic via
    // its `haptic` prop. The servings footer stepper is unmigrated PressableScale.
    expect(ACTION_PILLS).toMatch(/import \{ SupprButton \} from "@\/components\/ui\/SupprButton"/);
    expect(ACTION_PILLS).toMatch(/haptic=\{haptic\}/);
    expect(SERVINGS_FOOTER).toMatch(/import \{ PressableScale \} from "@\/components\/ui\/PressableScale"/);
    // The screen still derives the flag-gated haptic and threads it into the CTAs.
    expect(SRC).toMatch(/const winMomentFeedback = isFeatureEnabled\("redesign_winmoment"\)/);
    const hapticUses = SRC.match(/winMomentFeedback \? "confirm" : "none"/g) ?? [];
    expect(hapticUses.length).toBeGreaterThanOrEqual(1);
    // The dominant Log pill is a SupprButton (ENG-1079; PressableScale now
    // lives INSIDE the primitive). Cook entry deduped to the footer (gap 1).
    expect(ACTION_PILLS).toMatch(
      /<SupprButton[\s\S]{0,600}testID="recipe-action-log"/,
    );
  });
});

describe("mobile recipe-detail — legacy `calorieNumber` style retired at call site", () => {
  it("the legacy `calorieNumber` 26-pt extra-bold style is unused at the call site", () => {
    expect(SRC).not.toMatch(/<Text\s+style=\{\[styles\.calorieNumber/);
  });
});
