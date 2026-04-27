# Decision log: 2026-04-26 UI consistency polish round

**Date:** 2026-04-26
**Status:** Resolved
**Trigger:** Tester feedback (Grace, with 30+ screenshots covering virtually every screen of the mobile app): *"whole UI needs reviewing to make sure it is consistent and best in class"*. Identified 28 distinct issues across hard bugs, brand colour orphans, section-header casing, and smaller polish items.

This decision covers the eight highest-impact fixes plus a Library navigation promotion driven by a separate tester quote: *"the library (ie recipes the user has saved themselves) are harder to access than the main discovery dashboard which is random recipes. your own library should be prominent."*

---

## Decision

Land nine UI consistency fixes in one polish round. Each has a structural test pin (`tests/unit/uiConsistencyPolishRound.test.ts`) so future PRs cannot regress them quietly.

### 1. Render-time recipe-title normalisation (Library + Discover + planner)

**Problem:** Polish round on 2026-04-25 added `normalizeRecipeTitle` at the *save* boundary (mobile import, web upload form, mobile create-recipe). But existing prod rows imported before that fix still carried ALL-CAPS titles ("HEALTHY 3 INGREDIENT WHIPPED PISTACHIO PUDDING POTS"). Recipe Detail rendered them properly cased (it has its own normaliser); Library cards and Discover cards rendered them verbatim ALL-CAPS.

**Fix:** Apply `normalizeRecipeTitle` at the read boundary in three additional sites:
- `apps/mobile/lib/recipes.ts` — `useDiscoverRecipes` and `useSavedLibraryRecipes`
- `src/context/AppDataContext.tsx` — `refreshDiscoverRecipes` and `refreshMyLibraryRecipes`

The helper is a no-op for any title that already contains lowercase, so authored mixed-case titles ("Banh Mi", "iPhone-friendly Pasta") pass through untouched. Belt-and-braces with the save-time fix; users see Title Case immediately without needing a DB backfill.

### 2. Recipe Detail meal-type pill dedup + 85% pill labelled

**Problem:** Two meal-type pills on the same screen — `lunch` (lowercase, gray, top tag row) AND `Lunch` (Title case, blue, below title). Same data, two pills, different casing. Plus a bare `85%` pill with no caption — users couldn't tell whether it meant match confidence, fit-to-targets, or something else.

**Fix:** Dropped the lowercase meal-type pill from the top tag row (the canonical "Lunch" pill below the title remains). Labelled the fit-percent pill `{N}% match`.

### 3. Symmetric portion presets {0.5, 1, 1.5, 2}

**Problem:** Recipe Detail "Log to journal" presets were `0.5× · 0.75× · 1× · 1.5× · 2×` — asymmetric (extra fractional step between 0.5 and 1, none between 1 and 1.5). Inconsistent with the planner's tightened clamp from the 2026-04-25 round.

**Fix:** Dropped `0.75×`. Presets are now `0.5× · 1× · 1.5× · 2×` — matches the planner clamp, removes the asymmetry. The +/– stepper still allows finer increments for users who genuinely need them.

### 4. Save Recipe button → primary colour (was green)

**Problem:** The Save Recipe submit on Create Recipe was full-width Accent.success (green). Every other primary action in the app uses Accent.primary (purple/blue). The green submit was a visual orphan.

**Fix:** `saveBtn.backgroundColor` → `Accent.primary` in `apps/mobile/app/create-recipe.tsx`.

### 5. Removed duplicate `CREATE` top-right submit

**Problem:** The Create Recipe form's header strip carried `Cancel` (left), `CREATE` (right, uppercase blue text — submit), AND a full-width `Save Recipe` button at the bottom. Two affordances for the same submit action plus a casing mismatch (`Cancel` Title case vs `CREATE` uppercase).

**Fix:** Removed the top-right submit. Header strip now shows `Cancel` left, `New recipe` (Title case, screen title) centered. The bottom Save Recipe button is the single submit affordance — matches every other form in the app (Create Recipe, Targets, Settings).

### 6. Import idempotency by `source_url`

**Problem:** Tester's Library showed the same recipe twice with different macro values (163 kcal/8 P vs 210 kcal/9 P) — same title, two distinct recipe rows. Investigation: the import path inserted unconditionally; tapping "import this URL" twice produced two rows. The second import re-fetched the page and got slightly different macro values (publisher updated the recipe between requests, or the OG card vs full-page parse landed different totals).

**Fix:** `apps/mobile/lib/saveImportedRecipe.ts` now does a pre-insert check: `recipes.author_id = userId AND source_url = sourceUrl`. If a row exists, return its id idempotently — the user-visible toast still says "Saved to library" so the UX is identical to a fresh import. Skipped when `source_url` is null (manual create flow has no canonical key).

### 7. Library promoted to a primary tab

**Problem:** Library was hidden behind `<Tabs.Screen name="library" options={{ href: null }} />` and only accessible via Discover → "My Library" link at the BOTTOM of that screen. With 32 saved recipes in this user's library, that placement was inverted — random publisher recipes on Discover got top-billing while the user's own collection was three taps deep.

**Fix:** Library is now a primary tab in `apps/mobile/app/(tabs)/_layout.tsx`. Tab order: Today → Discover → **Library** → Plan → Progress → More. Six tabs is on the heavy side, but matches the pattern most nutrition apps converge on (MFP, Strava, Yazio, Lose It). The alternative (hiding Library behind a Discover sub-link) was the bug we're closing.

### 8. Title-case casing fix in Create Recipe header

**Problem:** Header strip on Create Recipe mixed `Cancel` (Title case) and `CREATE` (uppercase) — same strip, two casings. Inconsistent.

**Fix:** Applied as part of #5 above — `Cancel` (Title case) + `New recipe` (Title case) match every other navigation header in the app.

### 9. Tests pinning the round

12 structural tests in `tests/unit/uiConsistencyPolishRound.test.ts` cover Recipe Detail pill dedup, fit-percent label, portion-preset symmetry, save-button colour, removed-CREATE submit, header casing, title-normalisation routing on both platforms, Library tab promotion, and import idempotency.

---

## Rationale

The tester's screenshots told one story consistently: the app's UI patterns aren't broken individually, but they're not *consistent* across screens. The same data renders one way on Recipe Detail (Title case "Lunch") and another way on the same screen (lowercase "lunch"). The same primary submit action is purple on most forms and green on Create Recipe. Library is one tap on the way out (the bottom of Discover) but five taps to find on the way in.

The fix shape is identical for every issue: pick the *canonical* pattern the rest of the app uses, route the divergent surface through that pattern, pin it with a structural test. No mass refactor, no design overhaul — just close the gap between best and worst.

The Library tab promotion is the one structural change. Putting Library on the tab bar is a 6-tab posture; the trade is acceptable because Library is more frequently accessed than More (which holds settings) and the alternative is the inverted information architecture the tester surfaced.

## Alternatives considered

- **DB backfill of ALL-CAPS titles** instead of render-time normalisation. Rejected — the render-time helper is idempotent and runs in <0.1ms per row, render-time is more defensible (any future legacy import path can't regress it), and avoids a write migration on the prod recipes table.
- **Replace More with Library on the tab bar** to keep the bar at 5 tabs. Rejected — More holds settings + Apple Health + Notifications + Household + several other items the user needs to reach; demoting it would create the same problem in the opposite direction.
- **Remove the fit-percent pill entirely** (consistent with the F-45 removal from Discover for being decorative). Considered. Kept on Recipe Detail because the pill there is the *only* surface where the user can see how a candidate recipe scores against their day; on Discover the pill was duplicated by the macro icons. Different surface, different signal.
- **Drop the legacy 0.75× preset to the +/– stepper only.** That's effectively what landed — the stepper allows any 0.05× increment. The presets are for the common cases.

## Cross-platform check

- Web typecheck (`tsc --noEmit`): clean.
- Mobile typecheck (`tsc --noEmit`): clean.
- Web vitest scoped run on the affected modules: 45/45 + 12 new tests = 57/57 green.
- Mobile vitest blocked by an esbuild config issue in the sandbox (unrelated to this round); please verify locally.

## Outstanding (not in scope for this round)

The full audit found 28 issues. This round shipped 9. The remaining 19 are tracked in `docs/audits/2026-04-26-ui-consistency-audit.md` for a follow-up round:

- Sign-out treatment unification (red text vs red outline button)
- Section-header casing canonicalisation (UPPERCASE eyebrows vs Sentence Case section labels — mixed across screens)
- "Howse" — confirmed not a typo (Grace's surname); removed from list
- Creator-name underline affordance ("by Lisa Bryan" looks like a link)
- "View all nutrients (9)" caption clarity
- Duplicate Targets header
- Burn Detail stuck on Loading…
- Tab-bar weight pills (1W / 1M / 3M / 6M / 9M / 12M / All — 7 is too dense)
- True-black background → subtle elevation (#0A0A0A)
- Small typography / icon parity items

## Outcome

9 UI consistency fixes shipped in one polish round. 12 new tests pin the contract. Web + mobile typecheck clean. Library navigation promoted to a primary tab. Launch posture unchanged from the 2026-04-25 ship verdict: GO for cohort expansion.
