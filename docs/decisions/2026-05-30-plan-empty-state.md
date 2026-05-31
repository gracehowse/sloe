# Plan tab "No plan yet" card — calm empty state at 0 recipes + primary-accent selected pills

**Date:** 2026-05-30
**Status:** Resolved (mobile implemented + tested + documented; **flag-gated** `plan_empty_state_v2`; held for Grace's sim sign-off)
**Area:** Plan tab / empty state / mobile→web visual parity
**Flag:** `plan_empty_state_v2` (mobile-effective-only — web already at the target)
**Issue:** [ENG-788](https://linear.app/suppr/issue/ENG-788)
**Prototype:** `docs/prototypes/2026-05-30-plan-empty-state/index.html` (before/after, iPhone + web frames)
**Related:** Model A/B generate-source divergence (ticketed separately — see "The deeper parity gap" below)

## The bug

Grace, on the Plan tab with an empty library (verbatim): *"I dont know
what happened here but it looks terrible."*

Two faults stacked:

1. **Dead-end at 0 recipes.** With nothing saved, the card still rendered
   the full day/start/meal **config form** — and then ended in a
   40%-opacity **disabled "Generate my plan" button** the user could not
   press. So the screen read as broken: a form you can fill in that leads
   to a button that does nothing, plus a weak buried text link ("Open
   recipe library") doing the only real job on the screen.
2. **Grey selected pills everywhere.** Every selected toggle (days /
   start / meals) used a flat grey tint (`textSecondary @ ~9%` =
   `dayBtnActive`), not the brand accent. Even once populated the form
   looked unfinished next to **web**, which already renders selected
   segments as `border-primary bg-primary/10 text-primary`.

## The decision

**Split the card by saved-recipe count, behind `plan_empty_state_v2`.**

- **0 recipes →** drop the config form entirely and render a calm
  `<PlanEmptyState>`: a book icon tile, "Add a few recipes first", one
  line of copy, and a single **solid, ENABLED** "Browse recipe library"
  CTA pointed at the actual next step — plus a quiet "Or import a plan you
  already have" secondary when `plan_import_enabled` is on. There is
  nothing to plan with an empty library, so the only honest action is "go
  build a library."
- **≥1 recipe →** keep the config form, but move selected pills from grey
  to **primary accent** (`colors.tint` border + ~10% fill + primary
  text), matching web. Title shifts from "No plan yet" to "Plan your
  week" (nothing is missing, so the title becomes the action), and the
  sub-copy becomes "{n} recipes in your library — Suppr balances them to
  your targets."

Grace approved killing the config form at 0 recipes (the prototype's open
question) rather than just enabling the link and leaving the form greyed.

### Why a flag

This is a **layout + colour-mapping change** — exactly the class
CLAUDE.md requires behind a flag (the old path stays alive in the `else`,
ramped via PostHog). It is **not** the ENG-787-style correctness fix that
ships flagless. Web's empty state already matches the target, so the flag
is **mobile-effective-only**: this is mobile coming up to web, not a
two-sided redesign.

### Decision-framework note

Top failure modes considered: (1) **routing users to a dead library** —
ruled out, `/(tabs)/library` is the live recipe surface and the CTA is the
same `router.push` the old buried text link used. (2) **the flag-on form
showing a dead button at ≥1 recipe** — impossible by construction: the
`else` (config-form) arm is only reached when `savedRecipes.length > 0`,
so `disabled={… || savedRecipes.length === 0}` is always false there;
the dead-button state exists only on the legacy flag-off path. (3) **pill
contrast regressing in dark mode** — mitigated, `colors.tint` resolves to
the theme-correct primary (light/dark) via `useThemeColors()`, and the
~10% fill (`tint + "1A"`) is the same alpha web uses. Three alternatives
weighed: **(A)** reuse `EmptyState` and extract a prop-driven
`<PlanEmptyState>` (chosen — testable in isolation, nudges the oversized
`planner.tsx` toward the 400-line bar); **(B)** a button-only fix (enable
the link, leave the greyed form) — rejected, still shows a meaningless
config form; **(C)** a full 13-prop form extraction — rejected as
over-engineering for a visual fix. Confidence: **8/10** — the visual
contract is pinned by unit tests + the prototype; the residual
uncertainty is purely the sim eyeball (does the icon tile + CTA read as
premium at device scale), which the held sim pass resolves.

## The deeper parity gap (surfaced, not silently resolved)

Beneath the visual bug is a genuine **product divergence** in *where a
plan is generated from* when the library is empty:

- **Mobile = Model A (library-first).** The generate button is hard
  `disabled` at 0 saved recipes; you must save recipes before you can
  plan. ENG-788 keeps this — the empty state *reinforces* it ("go build a
  library").
- **Web = Model B (always-generate).** `MealPlanner.tsx`'s empty state
  (`planner-empty-state`) shows an **enabled** "Generate meal plan" even
  at 0 saved, generating from the discover pool. Web never branches on
  saved-recipe count.

Both platforms pull from a `[...savedRecipes, ...discoverRecipes]` pool
once generating; they differ only on whether 0-saved is a hard gate.
**This is a pre-existing product decision, not drift introduced here, and
not mine to unilaterally pick.** ENG-788 ships the conservative mobile
visual fix (strictly better than a dead button under *either* model,
reversible, flag-protected) and **preserves** mobile's library-first
behaviour. The reconciliation — should mobile adopt web's
always-generate, or web adopt mobile's library-first gate? — is filed as
a **product-lead decision** ([ENG-790](https://linear.app/suppr/issue/ENG-790);
no silent deferral).

**Product-lead recommendation (2026-05-30, for Grace's call — not yet
actioned):** go **Model A on both** — i.e. web adopts mobile's
library-first gate, *not* the reverse. The load-bearing fact: onboarding
already **seeds 5 curated recipes into the library on both platforms**
(web wired 2026-05-30, mobile since 2026-04-30, behind a default-ON kill
switch). So "0 saved recipes" is **not a normal cold-open state** for an
onboarded user — it only happens if the seed kill-switch is off, seeding
silently failed, or the user deleted all five. That reframes 0-saved as a
**degraded state, not a designed feature**: Model B's "generate from
strangers' recipes" is solving a state the happy path doesn't produce,
and it's off-brand ("plan from *your* recipes" → "here's 5 strangers'
recipes") at the exact first-impression moment. The recommended fix is
therefore (1) **web adopts mobile's `PlanEmptyState` + gate** behind the
same flag family (parity, the direction ENG-788 already points), and (2)
treat 0-saved as a **degraded state that fires telemetry** so silent seed
failures are *visible* rather than papered over with a discover-only
plan. The agent's open question — does a `saveResolvedSeeds` failure
during onboarding emit anything, or strand the user silently at 0-saved?
— is now **confirmed and ticketed as
[ENG-792](https://linear.app/suppr/issue/ENG-792)**: it strands silently.
Both call sites (`mobile-flow.tsx:226`, `web-flow.tsx:205`) discard
`saveResolvedSeeds`'s `{savedCount, error}` result, and
`onboarding_completed` reports `recipes_resolved` (the *resolve* step),
not the actual *save* — so a save failure logs as a clean onboarding.
This is the `feedback_persist_path_guardrails` pattern that bit onboarding
before, and it is the **observability premise the Model-A recommendation
rests on** (ENG-792 must land before "0-saved is rare *and we'd know*"
holds). **The Model A/B call remains Grace's decision; ENG-788 ships
unchanged under either outcome.**

## Implementation

### Mobile — `apps/mobile/components/PlanEmptyState.tsx` (new)

Prop-driven, presentational (no analytics — the flag gate lives at the
call site). Props: `onBrowseLibrary`, `planImportEnabled`, `onImport`.
Renders a bordered card wrapping the shared `<EmptyState>` (book-open
icon, title, description) with a solid primary "Browse recipe library"
CTA and a conditional "Or import a plan you already have" secondary.
Extracted (not inline) so it is unit-testable + Storybook-able and to
nudge the oversized `planner.tsx` toward the 400-line target.

### Mobile — `apps/mobile/app/(tabs)/planner.tsx`

- `const planEmptyStateV2 = isFeatureEnabled("plan_empty_state_v2")`.
- The `{!plan && …}` block became a ternary: `planEmptyStateV2 &&
  savedRecipes.length === 0` → `<PlanEmptyState>`; otherwise the config
  form (legacy path preserved).
- New styles `dayBtnActivePrimary` / `dayBtnTextActivePrimary` (primary
  border + ~10% fill + primary text). Every selected pill (days, start,
  meals) and the slot check-icon colour switch to the primary variant
  when `planEmptyStateV2` is on, grey when off.
- Title/sub-copy switch by flag (`"Plan your week"` / "{n} recipes …
  balances them to your targets." vs legacy `"No plan yet"` / 30-second
  copy). The buried "Open recipe library" text link is hidden under the
  flag (the empty state's CTA supersedes it).

### Regenerate-settings sheet pills (ENG-791 — folded in, not deferred)

The **regenerate-settings sheet** lower in `planner.tsx` carries a second
copy of the same day/start/meal form. Originally filed as a follow-up
([ENG-791](https://linear.app/suppr/issue/ENG-791)), it is now **folded
into this same `plan_empty_state_v2` flag** so the whole Plan tab is
visually consistent in one ramp — leaving one form grey while the other
went primary-accent would itself read as drift. All three regenerate
rows (days, start-from, meals) plus the meals check-icon colour now use
the same `planEmptyStateV2 ? styles.dayBtnActivePrimary :
styles.dayBtnActive` ternary as the empty-state form. A grep confirms no
bare `&& styles.dayBtnActive` / `&& styles.dayBtnTextActive` remain — the
grey selected-pill is fully gone under the flag.

### Web

No change — web's `planner-empty-state` already renders the icon-tile +
calm copy + solid enabled CTA the mobile "after" pulls up to. The only
web-touching question is the Model A/B reconciliation above, which is a
decision, not an edit.

## Tests

- `apps/mobile/tests/unit/planEmptyState.test.tsx` (new, 4/4): renders
  title + an **enabled** "Browse recipe library" CTA; CTA press fires
  `onBrowseLibrary`; import affordance hidden when `planImportEnabled`
  false; shown + wired to `onImport` when true.
- `apps/mobile/tests/unit/plannerMicrocopyDc12.test.ts` (updated): the
  title source-pin now matches the flag ternary
  `{planEmptyStateV2 ? "Plan your week" : "No plan yet"}`, pinning both
  arms so neither copy can silently drift.
- Full mobile suite: **1951/1951 green**; mobile typecheck clean.

## Parity

Web is the reference and is unchanged. Mobile's flag-on empty state and
selected-pill accent match web's existing `planner-empty-state` +
`border-primary bg-primary/10 text-primary`. The one remaining genuine
divergence (Model A library-first vs Model B always-generate) is
explicitly **not** closed here — it is surfaced and ticketed as a
product-lead call.

## Rollout

Flag `plan_empty_state_v2`, mobile-effective-only. Held local-only for
Grace to confirm in the iOS sim that (1) the 0-recipe card now reads as a
calm single-action empty state, not a broken form, and (2) the populated
form's selected pills read primary-accent. Forced on for the sim via
`EXPO_PUBLIC_FLAG_FORCE_PLAN_EMPTY_STATE_V2=true`. Once she signs off it
ramps via PostHog; after two weeks at 100% with no regression the gate +
legacy form arm can be removed in a cleanup PR.
