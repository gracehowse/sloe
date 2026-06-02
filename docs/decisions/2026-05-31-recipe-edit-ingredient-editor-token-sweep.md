# Recipe edit sheet + ingredient editor — token sweep to one design language (web + mobile)

**Date:** 2026-05-31
**Status:** Resolved (implemented both platforms; flag-gated OFF pending sim + browser sign-off)
**Area:** Recipes / Brand consistency / Design system
**Flag:** `design_system_elevation` (surface) — visual change → flag-gated per CLAUDE.md. No colour repaint needed (`design_system_colours` not required here — see below).
**Issue:** [ENG-821](https://linear.app/suppr/issue/ENG-821)
**Initiative:** Redesign — Design Direction 2026
**Direction:** [`2026-05-31-design-director-review-and-direction.md`](2026-05-31-design-director-review-and-direction.md)

## The gap

The design-director review read the recipe edit sheet + ingredient editor as
"imported from a different design system" — the deepest-tier surfaces drop to
"competent tracker" while Today/Recipes home already beat the comps. Concretely:

- **Mobile `RecipeEditSheet`** used a hardcoded `#00000066` backdrop scrim, a
  1px-border-as-depth sheet panel (no real shadow), and an off-token dashed
  add-ingredient outline (`Accent.primary + "50"` string-concat alpha).
- **Mobile recipe detail** answered an ingredient tap with a raw iOS
  `Alert.alert` info popup — grey, system-font, off-brand — and the review
  separately flagged that "tapping an ingredient shows only an info alert, not
  what users expect."
- **Web `recipe-edit-dialog` / `override-ingredient-dialog` /
  `add-ingredient-dialog`** all sat on a pure-white `bg-card` (#fff) surface
  with a hairline border standing in for depth, against the product's
  warm-cream (`--background: #fbfaf6`) canvas — a bright-white box in a warm
  product.

## The decision

Align all of these to the one elevation model + one surface, behind
`design_system_elevation`, with **today's flat/white path kept alive in the
`else`** (CLAUDE.md non-negotiable). No green→blue repaint was needed — the
commit CTAs were already blue on both platforms (`Accent.primary` on mobile,
the default `bg-primary-solid` Button on web), so `design_system_colours` is
not used in this lane (asserted by test, not assumed).

### Mobile

- `RecipeEditSheet` consumes the shared `useCardElevation()` hook (the
  spreadable form of the SupprCard branching). Flag ON → the sheet panel takes
  the real `Elevation.sheet` shadow and **drops** the redundant
  border-as-depth (tonal lift on dark); flag OFF → today's hairline panel. The
  backdrop now uses the `colors.overlay` scrim token instead of `#00000066`.
- The add-ingredient affordance moves from the off-token dashed outline to the
  same chip language as the meal-type chips above it (`Accent.primarySoft` fill
  + solid `Accent.primary` edge) — one consistent affordance grammar inside the
  sheet.
- `IngredientEditRow` was already fully tokenised (`colors.border`,
  `colors.inputBg`, `Radius.sm`, `Accent.destructive`) — left as-is bar a dead
  `Text` import removed.
- **`IngredientInfoSheet`** (new) — a branded read-only bottom sheet
  (`SavedMealPortionSheet` grammar: cream surface, grabber, `Elevation.sheet`,
  tokenised type/colour) that replaces the `Alert.alert` ingredient-info popup.
  It is **delivered ready-to-wire, not yet wired into `app/recipe/[id].tsx`**:
  that screen file is being actively rewritten by the ENG-818/819 detail-card
  lane, and strict file-lane discipline (edit sheet + ingredient editor are
  this lane; the detail screen is not) means the one-line host wiring is handed
  off rather than raced. The host gates it on `design_system_elevation` with the
  existing `Alert.alert` kept in the `else`; both paths share one
  `ingredientExplanation` string so they can never drift.

### Web

- `recipe-edit-dialog`, `override-ingredient-dialog`, and
  `add-ingredient-dialog` gate their `DialogContent` surface on
  `design_system_elevation`: flag ON → `bg-background` warm cream +
  `shadow-[var(--elev-card-soft)]` + `border-transparent`; flag OFF → today's
  `bg-card border-border` white dialog. Form fields already use `border-input`
  on the `Input`/`Textarea` primitives — no hardcoded borders to fix. The inner
  "Manual macros" `<details>` card in add-ingredient keeps its white `bg-card`
  as a legitimate elevated sub-surface against the now-cream dialog.

## Why one flag, surface-only

`design_system_elevation` is the canonical redesign elevation flag already in
use by `useCardElevation` and `--elev-card-soft`. Gating the surface (warm
cream + soft shadow) on it keeps the recipe-edit surfaces ramping in lockstep
with the rest of the product's depth model. There is no behaviour change when
the flag is off — it is a clean either/or.

## Tests

- `apps/mobile/tests/unit/recipeEditTokenSweep.test.tsx` — 9 cases:
  source-assertions that `RecipeEditSheet` has no hardcoded hex / no
  `Accent.x + "<alpha>"` concat, uses `colors.overlay`, takes `Elevation.sheet`
  with flag-gated border, uses the chip-language add button, keeps the blue
  commit CTA, and that `IngredientEditRow` stays tokenised; plus a render test
  of `IngredientInfoSheet` (name / status / source / macro read-out /
  explanation; confidence-percent only when unverified; nothing mounted when
  closed).
- `tests/unit/recipeEditDialogTokenSweep.test.ts` — 7 cases across all three
  web dialogs: each gates on `design_system_elevation`, flag-ON surface is
  warm-cream + soft shadow + border-transparent, flag-OFF white/hairline path
  survives; recipe-edit keeps the shared persistence helpers and has no
  `bg-success` green CTA.
- Existing `recipeEditMobileParity.test.ts` (4) + `recipeEditWebParity.test.ts`
  (2) still green — the persistence wiring is untouched.

All green. Web typecheck + lint clean; mobile typecheck + lint clean on all
lane files.

## Parity

Web and mobile both move the same surfaces onto the warm-cream + soft-shadow
treatment behind the same `design_system_elevation` flag — no new divergence.
The `IngredientInfoSheet` is intentionally mobile-only: it replaces a
mobile-only raw-iOS `Alert.alert`; web already shows ingredient detail inline
on `RecipeDetail`, so there is nothing to add there (documented carve-out, not
drift).

## Follow-ups / handoffs

- **Wire `IngredientInfoSheet` into `app/recipe/[id].tsx`** — one-line host
  state + flag-gated tap branch, owned by the ENG-818/819 detail-card lane (or
  a follow-up once that lane lands), per the wiring note in the component
  header. Until then the branded sheet ships dormant and the Alert path stays
  live.
- The standalone mobile **yield/servings edit modal** is inline in
  `app/recipe/[id].tsx` (same screen-file lane) — its token alignment travels
  with the ENG-818/819 detail-card sweep, not this lane. The web yield/servings
  editor lives inside `recipe-edit-dialog` and is covered here.

## Rollout

Flag OFF in PostHog. Grace validates the edit sheet (mobile sim) + the three
dialogs (browser) at flag-on; once confirmed, ramp via the PostHog dashboard.
After two weeks at 100% with no regression, remove the gates in a follow-up
cleanup PR.
