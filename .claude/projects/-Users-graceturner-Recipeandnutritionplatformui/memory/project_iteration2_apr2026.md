---
name: Iteration 2 fixes (Apr 2026)
description: Re-audit found bugs in new components, dead analytics events, broken image upload, missing UX paths. All 9 items fixed.
type: project
---

## Iteration 2 — 2026-04-10

### 9 issues fixed (all verified with typecheck + 36/36 tests)

1. **CookMode meal logging bugs** — Was hardcoding "Dinner" and `portionMultiplier: 1`. Now infers meal name from recipe slots or time of day, scales macros by `servings / recipe.servings`.

2. **FirstRunChecklist persistence** — Dismissed state now stored in localStorage (`suppr-checklist-dismissed`). Also tracks `onboarding_completed` and `first_run_step_completed` events.

3. **5 dead analytics events wired** — Created `PageViewTracker.tsx` client component for SSR pages. All events now tracked: `empty_state_cta_clicked` (EmptyState), `first_run_step_completed` + `onboarding_completed` (FirstRunChecklist), `pricing_page_viewed` (pricing page), `recipe_page_viewed` (recipe page).

4. **Image upload fixed** — Created `src/lib/supabase/uploadRecipeImage.ts` with 2MB limit, type validation. RecipeUpload now uses `URL.createObjectURL` for preview and uploads to Supabase Storage on save. Falls back gracefully if bucket not configured. DataURL storage in PostgreSQL eliminated.

5. **Direct Cook button in MealPlanner** — New green "Cook" button on each meal row. Opens recipe detail with cook mode auto-activated via `?cook=1` URL param. Flow: Planner → Cook (2 clicks, down from 4).

6. **Pricing page auth awareness** — New `CurrentTierBadge.tsx` client component checks user session and shows "Your current plan" badge on the tier they're subscribed to.

7. **SaveLimitBanner pricing link** — Added "See plans" link inside the banner text, pointing to `/pricing`.

8. **Public recipe page fixes** — JSON-LD now uses `"500 calories"` (not "kcal"), fat uses `"X g"` format. Ingredient formatting uses `filter(Boolean).join(" ")` to prevent leading spaces. New branded `not-found.tsx` page.

9. **PageViewTracker** — New reusable client component for firing analytics events from server-rendered pages.

### New files created
- `src/lib/supabase/uploadRecipeImage.ts`
- `src/app/components/PageViewTracker.tsx`
- `app/pricing/CurrentTierBadge.tsx`
- `app/recipe/[id]/not-found.tsx`

### Remaining top priorities
1. **Run seed script** — Content is still 4 recipes. 83 URLs ready.
2. **Split AppDataContext** — 1,543-line god-object with 67-dep memo array.
3. **Set up Supabase Storage bucket** — `recipe-images` bucket needs manual creation in Supabase dashboard.
