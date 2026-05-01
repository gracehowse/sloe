# User Journey: Create a Recipe (from scratch)

**Audience:** Product / Design / Engineering
**Status:** Live as of 2026-04-30 (mobile wizard); web still single-screen `RecipeUpload` form.

## Overview

A creator writes their own recipe in the app — title, photo, ingredients,
steps, macros — and saves it private OR publishes it to the community
Discover feed.

This journey is distinct from
[Import a Recipe](./import-recipe.md) (URL / share-extension flow):

- **Import** = "this recipe exists somewhere, bring it in"
- **Create** = "this recipe doesn't exist yet, I'm writing it"

## Surfaces

### Mobile

There are two create surfaces today, optimised for different mental
models. Both write to the same `recipes` / `recipe_ingredients` /
`saves` tables and route to `/recipe/{id}` after save.

| Route | Shape | When | Entry points |
|---|---|---|---|
| `/recipe/create` | 5-step **wizard** | First-time creator, "guide me" | Library tab "+ Create" pill (header), Library empty-state primary CTA |
| `/create-recipe` | Long single-screen form | Returning creator, paste/scan workflow | Settings bundle row (`More → Settings → Create recipe`), share-extension fallthrough |

The wizard surface ships from `apps/mobile/components/recipe/CreateRecipeWizard.tsx`
and is wrapped at the route level by `apps/mobile/app/recipe/create.tsx`.
Step machine + validations live in
`src/lib/recipes/createRecipeWizard.ts` (shared so web can adopt
the same step IDs if a wizard ever lands on web).

### Web

Web has one create surface: `src/app/components/RecipeUpload.tsx`
(`mode="create"`). It's a single-screen form on a desktop layout.
Wizard pacing doesn't help on the larger viewport — the form is the
right primitive for keyboard + mouse input. See parity table at the
bottom of this file.

## Wizard flow (mobile, `/recipe/create`)

5 ordered steps, each with explicit gating before Continue is enabled.

### Step 1 — Title + photo
- Title input (required, 80-char cap).
- Photo: tap to open the iOS image picker. Optional. Fallback shows a
  dashed border + camera glyph.
- Servings: stepper, default 4, clamped 1-50 (`clampServings`).
- **Continue gate:** title is non-empty after trim AND ≤ 80 chars.

### Step 2 — Ingredients
- Tap "+ Add ingredient" → opens `FoodSearchModal` (the shared search
  surface used across the app). Selecting a food adds a row with
  quantity + unit + computed kcal/macros from the picker's portion
  weight.
- Each row shows: name, "{amount} {unit} · {kcal} · {source}".
- Per-row delete (X icon).
- **Continue gate:** at least one ingredient with a non-empty name.

### Step 3 — Steps (instructions)
- Each step has its own multiline TextInput.
- Reorder via per-row up/down arrows. Delete via trash icon.
- "+ Add step" appends an empty row.
- **Continue gate:** none — combine-and-serve recipes can skip this
  step entirely. Steps with empty text are filtered out at save time.

### Step 4 — Macros confirm
- Per-serving auto-compute: totals ÷ servings. Calories rounded to
  whole, macros rounded to 1 decimal.
- Each field exposes an override input (`MacroOverrideRow`) — typing
  a number locks that field; clearing the input reverts to auto.
- "Manually edited" footer label appears as soon as any override is
  set, so the user can spot they've diverged from the database
  compute.
- **Continue gate:** none.

### Step 5 — Save
- Two primary actions:
  - **Save private** → `recipes.published = false`. Goes straight to
    `/recipe/{id}`.
  - **Publish to community** → opens an Alert with the attestation
    copy ("I created this recipe and I have the right to share it
    publicly..."). On confirm, `recipes.published = true`. Goes to
    `/recipe/{id}` rendered with a Pending state until moderation
    clears (web parity: `GoPublicDialog`).

## Persistence path

Identical to `/create-recipe`:

```
INSERT recipes (author_id, title, instructions, servings, published,
                calories, protein, carbs, fat)
INSERT recipe_ingredients (recipe_id, name, amount, unit, calories,
                           protein, carbs, fat, fiber_g, source,
                           is_verified=true)
INSERT saves (user_id, recipe_id)   -- creator auto-saves their own
```

Image upload (if a photo was picked) writes to the `recipe-images`
storage bucket at `recipes/{id}.{ext}` and a follow-up
`UPDATE recipes SET image_url = ?` runs after the row exists.

Title is normalised through `normalizeRecipeTitle` (Title Case fallback
for ALL CAPS input). Instructions are normalised through
`normaliseInstructions` (collapses literal `\n` / `/n` typos to real
newlines).

## Validation rules

Centralised in `src/lib/recipes/createRecipeWizard.ts`:

- `isTitleStepValid` — non-empty trim, ≤ `TITLE_MAX_LENGTH` (80).
- `isIngredientsStepValid` — at least one row with non-empty name.
- `isStepsStepValid` — always true.
- `isMacrosStepValid` — always true.
- `clampServings` — rejects NaN / Infinity / negative / over-cap.

The publish path additionally requires the user to confirm an
attestation Alert (mirrors web `GoPublicDialog`).

## Discard-changes guard

Pressing Back on Step 1 with any field touched fires an Alert:
"Discard recipe? You'll lose what you've entered so far." Cancel keeps
the user on the step; Discard pops back. Steps 2-5 Back is non-
destructive (step machine `prevStep`).

## Analytics

| Event | When |
|---|---|
| `recipe_create_wizard_step` | Continue / Back tap. Payload: `{ from, to, direction, platform }`. |
| `recipe_create_wizard_saved` | Save private / Publish completes. Payload: `{ recipe_id, published, ingredient_count, step_count, has_macro_overrides, platform }`. |

Funnel = `recipe_create_wizard_step { from: "title-photo" }` →
`recipe_create_wizard_saved`. Drop-out steps surface where the wizard
loses users.

## Web vs mobile

| Concern | Web | Mobile (wizard) | Mobile (single-screen) |
|---|---|---|---|
| Title + photo | Form fields | Step 1 | Inline at top |
| Ingredient autocomplete | USDA search + paste list | `FoodSearchModal` (shared) | `FoodSearchModal` + paste + scan-photo |
| Steps reorder | Drag handles | Up/down arrows | Single textarea |
| Macro overrides | Inline per-line | Step 4 dedicated screen | Inline totals card |
| Publish | `GoPublicDialog` w/ attestation checkbox | Step 5 → Alert attestation | Switch + Alert attestation |
| Save | Primary "Publish" / Secondary "Save draft" | Primary "Save private" / Secondary "Publish" | Single "Save Recipe" + publish toggle |

Intentional divergence: the wizard does not surface paste-list / scan-
photo / URL-import affordances. Those workflows are import flows by
intent — a creator pasting an existing recipe is doing an import, not
a creation. The single-screen form keeps them because that's the
returning-power-user surface.

## Related files

- `apps/mobile/app/recipe/create.tsx` — wizard route
- `apps/mobile/components/recipe/CreateRecipeWizard.tsx` — wizard component
- `apps/mobile/app/create-recipe.tsx` — single-screen form (sibling, kept)
- `src/lib/recipes/createRecipeWizard.ts` — step machine
- `src/app/components/RecipeUpload.tsx` — web counterpart
- `apps/mobile/tests/unit/createRecipeWizard.test.ts` — step machine + structural pins
- `apps/mobile/tests/unit/createRecipeNormalisationParity.test.ts` — write-side normalise pin
- `docs/audits/2026-04-28-recipe-creation-audit.md` — customer-lens findings (CR-01 to CR-07)
