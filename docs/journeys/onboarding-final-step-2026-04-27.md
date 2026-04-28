# Onboarding final step — "Pick 5 recipes"

**Status:** Phase 5 / B2.3 — recipe grid + auto-plan persist shipped
2026-04-27. Selection state machine landed Phase 3.
**Authority:** D-2026-04-27-14 (onboarding ends with a populated
first week, not just a target) + the resolved sub-decision
`docs/decisions/2026-04-27-onboarding-candidate-source.md`
(hand-picked 15-recipe JSON seed, no new DB table).
**Spec:** `docs/specs/2026-04-27-production-design-spec.md` Surface F.

## What it is

The final step of the onboarding flow — Step 15 of 15 — where the
user picks at least 5 recipes from a 15-recipe grid. Their picks
seed the Library on Today + drive the auto-plan generator that
populates Plan with their first week.

> "Best-in-class onboarding ends with the user having a thing, not
> just knowing a thing."
> — D-2026-04-27-14

## What ships in Phase 5 — full flow

### Seed list (shared)

`src/lib/onboarding/onboardingSeeds.ts` — `OnboardingSeed[]`
typed as `{ slug, matchTitle, title, kcal, protein_g, prepMins,
dietTags, cuisine, heroEmoji }`.

15 hand-picked recipes covering 5 omnivore / 4 vegetarian-or-vegan /
2 pescatarian / 4 GF; prep 5–45 min; protein 18–45g. The full
list lives at the file head; canonical names match the
candidate-source decision doc.

`apps/mobile/lib/onboardingSeeds.ts` re-exports the shared module.
Parity test
(`apps/mobile/tests/unit/onboardingSeedsParityPhase5.test.ts`) pins
that the two surfaces import the same constant.

### Filter logic (shared)

`filterOnboardingSeeds(seeds, { diet, allergies })`:

- Empty diet → returns full list.
- `vegan` → drops omnivore / pescatarian / vegetarian-only seeds.
- `vegetarian` → drops omnivore / pescatarian.
- `pescatarian` → drops omnivore.
- `gluten-free` → keeps only seeds explicitly tagged GF (no
  inference — coeliac UX requires explicit per D-2026-04-27-13).
- Allergens → substring match against `matchTitle`.

**Fallback rule:** when the filtered list size <
`SEED_FILTER_FALLBACK_THRESHOLD` (= 6), the function returns the
unfiltered list. Better-than-empty per the candidate-source decision.

### Recipe picker grid (web + mobile)

- **Web:** `src/app/components/onboarding-v2/recipe-picker-grid.tsx`
  — 2-col mobile-web / 3-col desktop. Selected tile: bg
  `rgba(76,108,224,0.08)` + border `--primary` + 12pt Check overlay.
- **Mobile:** `apps/mobile/components/onboarding/RecipePickerGrid.tsx`
  — 2-col, identical visual treatment via theme tokens.

Both consume the shared `togglePick` / `derivePickerState` /
`pickCounterLabel` helpers (Phase 3).

### Final-step component

- **Web:** `src/app/components/onboarding-v2/steps/recipes.tsx`
  (`RecipePickerStep`).
- **Mobile:** `apps/mobile/components/onboarding-v2/steps/recipes.tsx`
  (`MobileRecipePickerStep`).

Both inject the picker grid into a step shell with the spec-pinned
copy:
- Eyebrow: "★ LAST STEP" (with Sparkles).
- Title: "Pick 5 recipes you'd actually cook".
- Subtitle: "We'll seed your library and build your first weekly
  plan from these. You can change everything later."

### Step ordering

`STEP_IDS` extends from 14 → **15 steps**: …`permissions`,
`import`, **`recipes`**. The `recipes` step is the new terminal
step; the `import` "show, don't tell" demo close stays in the flow
as the penultimate step.

`OnboardingState.pickedRecipeSlugs: string[]` persists the user's
selection across step navigation. Sets aren't natively
JSON-serialisable, so we round-trip through `string[]` ↔
`Set<string>` at the picker boundary.

### Resolver + persist (shared)

`src/lib/onboarding/onboardingSeedResolver.ts`:

- `resolveSeedsToRecipeIds(supabase, picks)` — case-insensitive
  title match against `recipes.title` (via PostgREST `or()` +
  `ilike`). Returns `{ resolved, missing }` partition. Unpublished
  recipes count as missing.
- `saveResolvedSeeds(supabase, { userId, resolved })` — idempotent
  upsert into `saves` table with `onConflict: "user_id,recipe_id"`.

`src/lib/onboarding/onboardingFirstWeek.ts`:

- `seedsToPlannerRecipes(resolved)` — converts resolved seeds into
  the `SimpleRecipe` shape expected by `generateSmartPlan`. Carb
  / fat / fibre values default to a conservative split (the planner
  refines from real DB rows on first plan refresh).
- `buildFirstWeekFromSeeds(supabase, args)` — runs the shared
  planner, persists via the `save_meal_plan` RPC.

### Web flow shell wiring

`src/app/components/onboarding-v2/web-flow.tsx`:

- `isTerminal = currentStepId === "recipes"` (was `"import"`).
- The terminal CTA button label switches between "Build my first
  week" (canSubmit=true) and "Pick {n} more to continue"
  (canSubmit=false) — gated on `derivePickerState(picked)`.
- `handleComplete` runs:
  1. The existing `persistOnboardingV2(profiles upsert)`.
  2. Phase 5: resolve the picked seeds → recipes.id.
  3. Save them via `saveResolvedSeeds`.
  4. `buildFirstWeekFromSeeds` → 7-day plan via the
     `save_meal_plan` RPC.
  5. Bounce to `/home?onboarding_complete=1` (or
     `?plan_build=failed` if step 4 failed).
- Analytics: `onboarding_completed` payload now carries
  `recipes_picked`, `recipes_resolved`, `plan_built`.

### Mobile flow shell wiring

`apps/mobile/components/onboarding-v2/mobile-flow.tsx`:

- `isTerminal = currentStepId === "recipes"`.
- Footer button label switches identically (web parity).
- The actual onboarding completion (post-CTA persist + bounce) is
  owned by the mobile shell at `apps/mobile/app/onboarding.tsx` —
  the seed-and-plan flow is identical to web (via the shared
  helpers in `src/lib/onboarding/`).

## Migration

`supabase/migrations/20260503110000_onboarding_seed_recipes.sql` —
idempotent `INSERT … ON CONFLICT DO NOTHING` for all 15 canonical
seed rows + a new `recipes_lower_title_idx` for the resolver's
case-insensitive lookup.

**Apply with:** `supabase db push --linked`. **Never via MCP
`apply_migration`** per CLAUDE.md.

## Tests shipped

- `tests/unit/onboardingSeedsPhase5.test.ts` — 9 tests on the
  seed shape (15 unique slugs, ≥4 GF coverage, ≥3 vegan, ≥1
  batch-cook) + the diet filter rules + the fallback threshold.
- `tests/unit/onboardingSeedResolverPhase5.test.ts` — 9 tests on
  the resolver: case-insensitive title match, partial-hit
  partitioning, unpublished filter, error fallback, idempotent
  upsert.
- `tests/unit/onboardingFirstWeekPhase5.test.ts` — 5 tests on the
  planner recipe shape conversion + the RPC happy path + RPC
  error surfacing.
- `tests/unit/onboardingV2State.test.ts` — updated to expect 15
  steps with `recipes` as the last id.
- `apps/mobile/tests/unit/onboardingSeedsParityPhase5.test.ts` —
  2 tests pinning that mobile re-exports the shared seed list.
- Phase 3 selection-state tests
  (`tests/unit/onboardingFinalStepPhase3.test.ts`) still apply.

## Cross-platform

- Same shared seeds + filter + resolver + first-week helper.
- Same CTA copy ("Build my first week" / "Pick {n} more to
  continue") via the shared `derivePickerState`.
- Same step ordering (`recipes` is step 15 on both platforms).
- Welcome-copy divergence (web "Join the Suppr Club" vs mobile
  prototype copy) preserved per
  `project_onboarding_welcome_divergence.md`.

## State coverage

- **Loading recipe candidates** — never (the seeds are an
  in-bundle constant; no fetch). Future schema migration to a
  `recipes.slug` column may introduce a fetch path; today no
  loader needed.
- **Empty (no candidates — broken backend)** — guarded by the
  fallback-to-unfiltered rule. The picker is never shown empty.
- **Disabled state** — button at 50% opacity, label "Pick {n} more
  to continue".
- **Success transition** — persist + 600ms loader → /home.
- **Plan-build fails post-save** — bounces to
  `/home?onboarding_complete=1&plan_build=failed`. Caller surface
  shows a toast "We saved your recipes but couldn't build a plan.
  Try regenerate from the Plan tab." (toast wiring is per /home's
  existing onboarding-complete query-param handler).

## Open follow-ups

- **Schema follow-up:** add `recipes.slug` column + populate it,
  switch the resolver from title-match to slug equality. Stage as
  a migration, run via `supabase db push --linked`. Owner:
  `data-integrity`.
- **Plan-build retry from Today** — surface a "Build my plan"
  button when the first-week build failed silently. Owner:
  `executor` follow-up.
- **Filter chip tighter visibility** — when the filtered list
  exceeds the threshold + the user wants to see "more options",
  surface a "Show all 15" link below the grid. Owner:
  `ui-product-designer`.
