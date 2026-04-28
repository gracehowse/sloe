# Recipe creation flows audit — 3 platforms

**Phase 6 comprehensive scope.** Upload + Import + Verify + Edit + Delete + Share + Go Public.
**Source:** customer-lens, 2026-04-28.

---

## Top 5

### CR-01 [P0] — Mobile recipe detail has NO Edit / Delete / Duplicate / Publish even for own recipes

`apps/mobile/app/recipe/[id].tsx`. Top bar = back / bookmark / share only; no overflow menu.

Web has full editor at `/profile?editRecipe={id}` (`RecipeUpload.tsx:572-636`) plus GoPublicDialog. **Mobile has zero mutation paths from the detail screen.** User who creates on mobile and types a typo has no way to fix it on mobile — must open web.

This is also where users will reach for Delete first; **there are zero ways to delete a recipe on mobile-native today.**

### CR-02 [P0 trust] — Recipe Delete doesn't exist anywhere; web `recipe_ingredients.delete` strategy leaves orphaned planner / nutrition entries

Nowhere in the codebase is there a "delete recipe" action surfaced to users on either platform. The orphan-handling at `recipes.ts:332-340` is **observation-only** — logs `"dropping orphan save rows"` to console but never warns the user. If recipe is deleted at DB level, planner entries silently disappear.

**Fix:** Add Delete to both surfaces, with explicit confirm copy naming affected planner/library entries: "This recipe is on your Wed dinner plan and saved to your Library. Delete anyway?"

### IM-01 [P1] — Permanent decoy: "Recent imports — No recent imports" + 4 dead source buttons

`RecipeUpload.tsx:1342-1346`. "Recent imports" is hard-coded `<p>No recent imports</p>` — no query, no state, no fetch. After 10 imports, panel still says "No recent imports". **A lie.**

Lines 1273-1291: 4-icon "Import from TikTok / Instagram / YouTube / Website" grid has **no onClick handlers**. Decorative buttons that do nothing on tap.

### IM-02 [P1 trust] — Web import 3-step animation is FAKE

`RecipeUpload.tsx:1320-1339`:
```js
{ label: "Fetching recipe page…", done: true },
{ label: "Analyzing ingredients…", done: false },
{ label: "Calculating nutrition…", done: false },
```

From the moment user clicks Import, step 1 is checked-green and steps 2/3 are pulsing-grey. **They never advance.** Worse than a single spinner — suggests system "knows" what stage it's at but is just static markup.

### VR-01 [P0 trust] — "Confirm All" promotes low-confidence rows to `is_verified=true`

`apps/mobile/app/recipe/verify.tsx:912-927` + web. Footer button Confirm All ships zeros / low-confidence rows straight into `recipes.is_verified = true` (set unconditionally in `saveVerifiedIngredients`, `verifyRecipe.ts:1318`).

**The Verify screen exists *because* nutrition is uncertain — then it overrides `is_verified=true` regardless of row-level confidence.** A user who taps Confirm All without scrolling has just published a recipe whose oats matched against "rolled oat sushi" with 35% confidence as Verified. Recipe gets a green Verified TrustChip on detail view.

**Fix:** Gate `is_verified=true` on `!hasUnverified` in `saveVerifiedIngredients`. If any row below threshold, persist `is_verified=false` and surface "Save anyway / Review rows" Alert.

---

## Other notable findings

- CR-03 [P1 trust]: Mobile create Publish toggle unguarded; web requires GoPublicDialog + attestation. Mobile user can publish someone else's content under own name.
- CR-04 [P2]: Per-100g rounding produces 0g protein on small ingredients (1 tsp soy sauce → 0g instead of 0.04g). Aggregate impact 4-5g/serving.
- CR-05 [P2]: Servings field accepts "0", "-1", "abc" silently. Negative servings flip per-serving macros negative on totals card.
- CR-07 [P1 trust]: Cancel on mobile create doesn't confirm "discard changes". 20 minutes of pasted recipes vanish on accidental swipe.
- IM-03 [P1]: Image OCR — web doesn't gate Pro upfront (free-tier abuse risk); mobile gates server-side.
- IM-04 [P1]: URL import not surfaced on mobile create-recipe screen. Only via share-extension. Unintended divergence.
- IM-05 [P2]: Idempotency guard per-source-URL only. Photo-only re-import creates duplicates.
- VR-02 [P1]: Verify "needs density" hint only fires for `ml` without resolved density. Other unsafe-defaults silently render "= 0 g" — a confident zero.
- VR-03 [P1 trust]: Re-verify auto-fire can overwrite user's manual amount/portion edits silently.
- TR-01 [P1 security]: `recipe-import/route.ts:43` accepts `http://` URLs. Source attribution rendered as clickable link with no security check.
- TR-03 [P1]: Site-provided JSON-LD nutrition preferred over verifyIngredients DB match. Comment claims "site nutrition is from a dietitian" — many sites use auto-generated macros from third-party widgets. Silent lying.
- AC-01 [P1 a11y]: Verify ingredient table not screen-reader navigable as table. VoiceOver reads each row as single chunk.
- AC-02 [P1 a11y]: Web RecipeUpload form fields use `<label>` and `<input>` without `id`/`for` linkage.

---

## Web vs mobile divergences

| Area | Web | Mobile | Verdict |
|---|---|---|---|
| Edit recipe | Full form via `?editRecipe=` | None on detail; only `/recipe/verify` for ingredients | **Drift P0** |
| Delete recipe | None | None | **Both missing P0** |
| Duplicate | None | None | **Both missing P1** |
| Go Public | GoPublicDialog with attestation checkbox | Bare Switch toggle, no attestation | **Drift P1, contradicts memo** |
| URL import | First-class form field | Only via share-sheet handoff | **Drift P1** |
| Photo OCR Pro gate | None upfront | Pro-gated server-side | Drift P1 |
| Recent imports panel | Hard-coded empty | N/A | Drift P1 |

---

## Trust concerns ranked

1. CR-02 / CR-01: No Delete on mobile, no overflow menu — user can't undo.
2. VR-01: Confirm All promotes low-confidence rows to `is_verified=true`.
3. CR-03: Mobile Publish toggle has no attestation; web does.
4. IM-02: Fake 3-step extraction animation is misleading.
5. TR-01: `http://` URLs accepted as source attribution.
6. TR-03: Site-claimed nutrition preferred over our DB match without disclosure.
7. IM-01: Permanent "No recent imports" decoy + 4 dead source buttons.
