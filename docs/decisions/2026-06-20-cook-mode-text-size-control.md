# Cook-mode text size control (A−/A+)

**Date:** 2026-06-20
**Area:** Recipes / Cook mode
**Status:** Resolved
**Linear:** ENG-949
**Flag:** `cook_text_size_control_v1` (default-OFF)

## Context

"The step text is tiny — I have to lean over the counter and squint while
something's boiling" is one of the most repeated cook-mode complaints across
the recipe-app category. A cook screen is read from ~60 cm away, hands busy,
often steamed-up glasses. Glanceability is the whole job, and our base step
text (web `text-2xl sm:text-3xl`; mobile overlay 22 px) was sized for a normal
reading distance, not a kitchen.

## Decision

Add a first-class **A−/A+ text-size control** in the cook header (web) and the
cook overlay header (mobile). It scales only the step instruction text — the
part you read mid-task — and persists the choice **per user** (not per recipe):
someone who wants large cook text wants it for every recipe, so the preference
follows the cook.

- Discrete steps: `0.9 / 1 / 1.15 / 1.3 / 1.5×` (`COOK_TEXT_SCALE_STEPS`). 1× is
  the historical size; 1.5× is the practical ceiling before steps wrap past a
  comfortable line count. Controls disable at the bounds.
- Shared pure helper `src/lib/nutrition/cookTextScale.ts` (re-exported via
  `@suppr/nutrition-core`) owns the presets, clamp/snap, stepping, the
  per-user storage key, and the `cookStepFontSize(base, scale)` calc, so web
  and mobile derive identical sizes from one source of truth.
- Persistence: `localStorage` (web) / `AsyncStorage` (mobile), keyed
  `suppr-cook-text-scale-v1:<userId|anon>`.
- Mobile base nudged 22 → 24 px when the flag is on, to match the standalone
  `/cook` screen (the overlay had drifted smaller).

## Flag posture

Per the non-negotiable feature-flag rule (structural/layout UI ships gated),
the control is behind `cook_text_size_control_v1`, **default-OFF**:

- Flag-OFF resolves `isFeatureEnabled(...)` to `false` on a cold/missing
  client, so cook mode is **byte-identical** to before — no control rendered,
  the mobile step text stays at the legacy `22 / 32`, and a previously
  persisted size is **not** re-applied (clean revert).
- Flag-ON renders the control, applies the persisted size, and uses the 24 px
  mobile base.

Ramp: validate in iOS sim + web (light/dark, small + large sizes) → flip to
100% for the single tester → remove the gate after two clean weeks (keep as an
emergency kill switch). See `docs/operations/posthog-rollout.md`.

## Alternatives considered

- **System text-size only (Dynamic Type / browser zoom).** Honest, but it
  scales the entire app chrome, not just the step you're reading, and most
  users never change it. An in-context control at the moment of need converts
  far better. We still respect system scaling on top of this.
- **A continuous slider.** More precise but fiddly with wet hands; discrete
  steps with big tap targets are the right kitchen ergonomics.
- **Per-recipe size.** Rejected — the need is about the user's eyes, not the
  recipe; per-user is the correct scope and matches how `recipeScale` is
  deliberately the opposite (per-recipe serving size).

## Analytics

`cook_text_scale_changed` — fires on each commit (not first render) with
`{ scale, direction: "up" | "down", platform: "web" | "ios" }`. Same event
name web ↔ mobile, so adoption and the most-used size are queryable across
platforms. No `recipeId` (the pref is global per user).

## Parity

Identical behaviour on web and mobile from the shared helper. Intentional
differences: web drives the step font inline only when scaled (keeping the
responsive `text-2xl/3xl` classes for the 1× default); mobile drives it
numerically with a proportional `lineHeight`. Mobile base is 24 px (flag-ON)
to match `/cook`; web base remains the responsive class ramp (~30 px).
