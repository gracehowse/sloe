/**
 * F-80…F-86 (2026-04-25) — pin the visual / UX fixes from the screenshot
 * audit so a future refactor can't silently regress them. Source-string
 * matching mirrors the existing parity pins.
 *
 * - F-80: meal-card header text-wrap regression
 * - F-81: AbortError no longer logged to console (no toast leak)
 * - F-82: macro split incomplete-data state
 * - F-83: 7-day avg below 50 kcal noise floor hidden
 * - F-84: Day/Week toggle now icon-only (visually distinct from date-nav)
 * - F-85: recipe title de-CAPS + per-ingredient macro bars removed (web + mobile)
 * - F-86: meal-detail micros panel renders source-attributed empty state
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_TODAY_MEALS = resolve(__dirname, "../../components/today/TodayMealsSection.tsx");
const MOBILE_DEFICIT = resolve(__dirname, "../../components/today/TodayDeficitInsight.tsx");
const MOBILE_DATE_HEADER = resolve(__dirname, "../../components/today/TodayDateHeader.tsx");
const MOBILE_VERIFY = resolve(__dirname, "../../lib/verifyRecipe.ts");
const MOBILE_MEAL = resolve(__dirname, "../../app/meal-nutrition.tsx");
const MOBILE_RECIPE = resolve(__dirname, "../../app/recipe/[id].tsx");
const WEB_RECIPE = resolve(__dirname, "../../../../src/app/components/RecipeDetail.tsx");
/**
 * 2026-04-30 — web FoodSearch.tsx (1568 LOC) was extracted into
 * `food-search/FoodSearchPanel.tsx` (commit `cb1317f`). The wrapper
 * keeps only the dialog shell; F-89 / F-90 / F-91 inference + filter
 * imports live in the panel. Source-pin parity reads the panel.
 */
const WEB_FOOD_SEARCH = resolve(
  __dirname,
  "../../../../src/app/components/food-search/FoodSearchPanel.tsx",
);
const WEB_DATE_HEADER = resolve(__dirname, "../../../../src/app/components/suppr/today-date-header.tsx");
const SHARED_CONFIDENCE = resolve(__dirname, "../../../../src/lib/nutrition/macroSplitConfidence.ts");
const SHARED_TITLE = resolve(__dirname, "../../../../src/lib/recipe/normaliseDisplayTitle.ts");

const SRC = {
  mealsSection: readFileSync(MOBILE_TODAY_MEALS, "utf8"),
  deficit: readFileSync(MOBILE_DEFICIT, "utf8"),
  dateHeader: readFileSync(MOBILE_DATE_HEADER, "utf8"),
  verify: readFileSync(MOBILE_VERIFY, "utf8"),
  mealNutrition: readFileSync(MOBILE_MEAL, "utf8"),
  recipe: readFileSync(MOBILE_RECIPE, "utf8"),
  webRecipe: readFileSync(WEB_RECIPE, "utf8"),
  webSearch: readFileSync(WEB_FOOD_SEARCH, "utf8"),
  webDateHeader: readFileSync(WEB_DATE_HEADER, "utf8"),
  confidence: readFileSync(SHARED_CONFIDENCE, "utf8"),
  title: readFileSync(SHARED_TITLE, "utf8"),
};

describe("F-80 — meal-card header survives `Log usual` chip", () => {
  it("title and meta text use numberOfLines={1}", () => {
    // The slot title "{slot}" Text element gets numberOfLines={1}
    expect(SRC.mealsSection).toMatch(/\{slot\}\s*<\/Text>/);
    expect(SRC.mealsSection).toMatch(/numberOfLines=\{1\}[^\n]*\n[^}]*\{slot\}/s);
  });

  it("title column declares minWidth: 0 so RN allows the text to shrink", () => {
    expect(SRC.mealsSection).toMatch(/flex:\s*1,\s*minWidth:\s*0/);
  });

  it("trailing controls row sets flexShrink: 0", () => {
    expect(SRC.mealsSection).toMatch(/flexDirection:\s*"row"[^}]*flexShrink:\s*0/s);
  });

  it("Log-usual chip caps maxWidth and is itself flexShrink: 1", () => {
    expect(SRC.mealsSection).toMatch(/maxWidth:\s*180[^}]*flexShrink:\s*1/s);
  });
});

describe("F-81 — benign AbortError no longer leaks to console", () => {
  it("verifyRecipe defines isBenignAbort helper", () => {
    expect(SRC.verify).toMatch(/function\s+isBenignAbort/);
    expect(SRC.verify).toMatch(/AbortError/);
  });

  it("searchUsda guards console.error with isBenignAbort", () => {
    // Find the actual `console.error(...)` call (the comment block also
    // contains the literal string).
    const idx = SRC.verify.indexOf('console.error("[searchUsda]');
    expect(idx).toBeGreaterThan(0);
    const preceding = SRC.verify.slice(Math.max(0, idx - 200), idx);
    expect(preceding).toMatch(/isBenignAbort\(e\)/);
  });

  it("searchOFF and searchEdamam also guard with isBenignAbort", () => {
    const offIdx = SRC.verify.indexOf('console.error("[searchOFF]');
    expect(SRC.verify.slice(Math.max(0, offIdx - 100), offIdx)).toMatch(/isBenignAbort\(e\)/);
    const edamamIdx = SRC.verify.indexOf('console.error("[searchEdamam]');
    expect(SRC.verify.slice(Math.max(0, edamamIdx - 100), edamamIdx)).toMatch(/isBenignAbort\(e\)/);
  });
});

describe("F-82 — macro split gates on data confidence", () => {
  it("shared helper exports macroSplitConfidence + macroSplitIncompleteCopy", () => {
    expect(SRC.confidence).toMatch(/export\s+function\s+macroSplitConfidence/);
    expect(SRC.confidence).toMatch(/export\s+function\s+macroSplitIncompleteCopy/);
  });

  it("meal-detail screen branches on splitConfidence.state", () => {
    expect(SRC.mealNutrition).toMatch(/macroSplitConfidence\(/);
    expect(SRC.mealNutrition).toMatch(/splitConfidence\.state\s*===\s*"single_macro"/);
    expect(SRC.mealNutrition).toMatch(/macroSplitIncompleteCopy/);
  });

  it("MacroStat accepts pct: number | null so the % line can be suppressed", () => {
    expect(SRC.mealNutrition).toMatch(/pct:\s*number\s*\|\s*null/);
    expect(SRC.mealNutrition).toMatch(/pct\s*!=\s*null\s*\?/);
  });
});

describe("F-83 — under-ring line is forward 'Room for {meal}', not backward deficit", () => {
  // SLOE 2026-06-04 (Grace "room for dinner is missing"): the under-ring
  // line flipped from the backward "deficit so far today" + rolling-avg
  // sub-line to the forward `todayRoomForMeal` coach line. The backward
  // energy-balance trend (today's net + the rolling avg with its ≥50 kcal
  // noise floor) now lives ONLY in `TodayActivityBonusCard` below the ring
  // — `todayDeficitAverageLoggedDays.test.tsx` pins that calc. This file
  // now asserts the deficit insight is the forward line and no longer
  // re-computes the backward trend (so the two surfaces can't duplicate).
  it("TodayDeficitInsight renders the shared forward coach line", () => {
    expect(SRC.deficit).toMatch(/todayRoomForMeal\(/);
    expect(SRC.deficit).toMatch(/nextUnloggedMealSlot\(/);
  });
  it("TodayDeficitInsight no longer re-computes the backward deficit trend", () => {
    expect(SRC.deficit).not.toMatch(/avgDeficit/);
    expect(SRC.deficit).not.toMatch(/so far today/);
  });
});

describe("F-84 — Day/Week toggle uses icons, not 'Day' / 'Week' text", () => {
  it("Mobile DateHeader uses lucide Sun / LayoutGrid (post §1.5 sweep, 2026-04-27)", () => {
    // The toggle previously had `<Text>Day</Text>` / `<Text>Week</Text>`,
    // then Ionicons sunny-outline / grid-outline (F-84). The §1.5 lucide
    // sweep replaces those with the equivalent lucide-react-native
    // glyphs (Sun / LayoutGrid) — same shape, same semantics.
    expect(SRC.dateHeader).toMatch(/from\s*["']lucide-react-native["']/);
    expect(SRC.dateHeader).toMatch(/\bSun\b/);
    expect(SRC.dateHeader).toMatch(/\bLayoutGrid\b/);
    expect(SRC.dateHeader).toMatch(/accessibilityLabel="Day view"/);
    expect(SRC.dateHeader).toMatch(/accessibilityLabel="Week view"/);
    // Ionicons must be gone from this surface.
    expect(SRC.dateHeader).not.toMatch(/@expo\/vector-icons/);
  });

  // F-84 web parity (sync-enforcer D-1, 2026-04-25): mobile shipped the
  // icon toggle but web kept text labels — the parity test was scoped
  // to mobile only and missed the regression. This pin extends the same
  // contract to web.
  it("Web today-date-header uses Sun / LayoutGrid icons, not 'Day' / 'Week' text inside the toggle", () => {
    expect(SRC.webDateHeader).toMatch(/Icons\.lightMode/);
    expect(SRC.webDateHeader).toMatch(/Icons\.layoutGrid/);
    expect(SRC.webDateHeader).toMatch(/aria-label="Day view"/);
    expect(SRC.webDateHeader).toMatch(/aria-label="Week view"/);
    // The toggle no longer contains literal `>Day<` / `>Week<` JSX text.
    expect(SRC.webDateHeader).not.toMatch(/>\s*Day\s*</);
    expect(SRC.webDateHeader).not.toMatch(/>\s*Week\s*</);
  });
});

describe("F-85 — recipe title de-CAPS + per-ingredient macro bars removed", () => {
  it("shared helper exports normaliseRecipeDisplayTitle", () => {
    expect(SRC.title).toMatch(/export\s+function\s+normaliseRecipeDisplayTitle/);
  });

  it("mobile recipe screen uses normaliseRecipeDisplayTitle on every title render", () => {
    // After the Figma 332:2 redesign, the three inline calls were consolidated
    // into a single `displayTitle` constant (computed once, used in multiple
    // render sites). The minimum call count is 2: one for the share handler
    // and one for the `displayTitle` declaration. The constant must then be
    // threaded to at least 2 JSX title render sites (RecipeDetailHero +
    // RecipeTitleBlock) — equivalent protection, no weaker contract.
    const matches = SRC.recipe.match(/normaliseRecipeDisplayTitle\(/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
    // `displayTitle` is the computed normalised value and must appear in
    // at least 2 title= prop sites so every hero/title render is covered.
    const titlePropMatches = SRC.recipe.match(/title=\{displayTitle\}/g) ?? [];
    expect(titlePropMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("web recipe detail uses normaliseRecipeDisplayTitle (parity)", () => {
    expect(SRC.webRecipe).toMatch(/normaliseRecipeDisplayTitle\(recipe\.title\)/);
  });

  it("mobile recipe screen no longer renders per-ingredient macro split bar JSX", () => {
    // The old <View style={styles.macroBar}>...</View> ingredient row
    // is gone; only one macroBar style usage may remain (recipe-level
    // nutrition tab if present). The per-ingredient one is the regression
    // we removed: confirm the proteinPct/carbsPct/fatPct triple-render
    // pattern under styles.macroBar inside ingredient rows is gone.
    expect(SRC.recipe).not.toMatch(
      /styles\.macroBar[^}]*}\s*>\s*\n[^<]*<View\s+style=\{\{[^}]*flex:\s*proteinPct/s,
    );
  });
});

describe("F-91 — name-based natural-serving inference for verified USDA rows", () => {
  it("mobile mergeResults chains inferNaturalServingFromName into the primaryServing fallback", () => {
    expect(SRC.verify).toMatch(/import\s*\{\s*inferNaturalServingFromName\s*\}/);
    expect(SRC.verify).toMatch(/inferNaturalServingFromName\(item\.description,\s*per100g,\s*isVerified\)/);
  });

  it("web searchUsda chains inferNaturalServingFromName into the primaryServing fallback", () => {
    expect(SRC.webSearch).toMatch(/import\s*\{\s*inferNaturalServingFromName\s*\}/);
    expect(SRC.webSearch).toMatch(/inferNaturalServingFromName\(h\.description \?\? "",\s*per100g,\s*isVerified\)/);
  });
});

describe("F-89 + F-90 — bare-noun + low-relevance filters applied at merge", () => {
  it("mobile mergeResults imports and applies isBareGenericNounRow + isLowRelevanceNonVerifiedRow", () => {
    expect(SRC.verify).toMatch(/import\s*\{[^}]*isBareGenericNounRow[^}]*\}/s);
    expect(SRC.verify).toMatch(/isBareGenericNounRow\(r\.name,\s*isVerified\)/);
    expect(SRC.verify).toMatch(/isLowRelevanceNonVerifiedRow\(r\._relevance,\s*isVerified\)/);
  });

  it("web mergeAndDedup applies the same filters", () => {
    expect(SRC.webSearch).toMatch(/import\s*\{[^}]*isBareGenericNounRow[^}]*\}/s);
    expect(SRC.webSearch).toMatch(/isBareGenericNounRow\(r\.name,\s*isVerified\)/);
    // After the FoodSearchPanel extraction the `_rel` field is widened
    // to `unknown` on the panel's local type, so the call site casts
    // (`r._rel as number`). Same semantics — gate the row on relevance
    // when the source isn't verified.
    expect(SRC.webSearch).toMatch(
      /isLowRelevanceNonVerifiedRow\(r\._rel(?:\s+as\s+number)?,\s*isVerified\)/,
    );
  });
});

describe("F-86 — micros panel collapses to source-attributed empty state", () => {
  it("renders 'did not publish' copy when populatedCount === 0", () => {
    expect(SRC.mealNutrition).toMatch(/populatedCount\s*===\s*0/);
    expect(SRC.mealNutrition).toMatch(/did not publish vitamin or mineral data/);
  });

  it("absent fields collapse to a quiet rest-line instead of rendering rows (e2e walk 2026-06-10)", () => {
    // Only populated rows render…
    expect(SRC.mealNutrition).toMatch(/\.filter\(\(row\) => row\.value !== "—"\)/);
    // …and the absent count collapses to one summary line.
    expect(SRC.mealNutrition).toMatch(/more not published by \{sourceLabel\}/);
    // The old wall of per-row "Not published" labels is gone.
    expect(SRC.mealNutrition).not.toMatch(/"Not published"/);
  });

  it("attribution line names the source", () => {
    expect(SRC.mealNutrition).toMatch(/published by \{sourceLabel\}/);
  });
});
