# Plan tab "Plan from" source selector — library / library + discovery / discovery

**Date:** 2026-05-31
**Status:** Resolved (web + mobile implemented + tested + documented; **flag-gated** `plan_source_selector`; held for Grace's sim sign-off)
**Area:** Plan tab / generate flow / web ↔ mobile parity
**Flag:** `plan_source_selector` (web + mobile)
**Issue:** [ENG-790](https://linear.app/suppr/issue/ENG-790)
**Prototype:** `docs/prototypes/2026-05-31-plan-source-selector/index.html` (iPhone + web frames, canonical light tokens)
**Supersedes:** the "deeper parity gap" / Model A-vs-B reconciliation section of
`docs/decisions/2026-05-30-plan-empty-state.md` (ENG-788), and folds ENG-788's
empty state into this control.

## Grace's call (verbatim)

> "for 790 i guess we can and should give them options, so give them the option
> to generate from the disovery pool. we should probably always give these
> options — plan from library only, library & discovery, only discovery"

Two red-lines she set (via the prototype review):

1. **Default = "Library & discovery."** Broadest pool, works even at 0 saves.
2. **"Fold into one."** Rebuild the held ENG-788 empty state so the selector +
   discovery escape hatch are baked in — one flag (`plan_source_selector`)
   supersedes `plan_empty_state_v2`; ENG-788's calm empty card becomes the
   "My library is empty" *sub-case*, not the whole screen.

## What was actually there before (correcting the ENG-788 framing)

ENG-788 framed the gap as "mobile = Model A (library-first gate), web = Model B
(always-generate from the discover pool)." Reading the committed code at HEAD,
**that was not accurate** — and the corrected picture is what justifies the
selector:

- **Web generated from the saved library ONLY, and was itself hard-gated at 0
  saved.** `AppDataContext.generateMealPlan` opened with
  `if (savedRecipes.length === 0) { toast.error(…); return; }` and then called
  `generatePlanFromLibrary({ savedRecipes })` — **discover was never pooled into
  generation, even at ≥1 saved.** The `MealPlanner` button looked enabled at 0
  saved (`disabled={isGenerating}` only), but pressing it hit the toast-return,
  so web was *effectively* library-first too — just with a worse affordance (an
  enabled-looking button that leads to an error toast).
- **Mobile pooled saved + discover as a fallback.**
  `recipePool = savedPool.length >= 6 ? savedPool : fullPool` (where
  `fullPool = [...savedPool, ...discoverPool]`) — i.e. discover was mixed in
  whenever fewer than 6 recipes were saved, with a separate disabled-button gate
  at 0 saved.

So the real divergence was **discover-as-silent-fallback (mobile, < 6 saved) vs
saved-only-always (web)** — an *implicit* pool difference neither platform
surfaced to the user. ENG-790 replaces both ad-hoc behaviours with **one explicit
choice**, so the pool source is a decision the user makes, not a hidden heuristic
that differs by platform.

## The decision

Add a **"Plan from" selector** at the top of the generate form on **both**
platforms, behind `plan_source_selector`, with three modes:

| Mode | Pool | Subtitle |
| --- | --- | --- |
| `library` | saved recipes only | "Only recipes you've saved" |
| `library_and_discovery` *(default)* | saves + Suppr's discover picks (de-duped) | "Your saves plus Suppr's recipe picks" |
| `discovery` | discover picks only | "Just Suppr's recipes" |

The generate action is allowed whenever the **chosen** source has ≥1 recipe
(`canGenerateFromSource`). Because Discovery always has Suppr's curated seeds,
**"0 saved" stops being a dead end** — the default source still generates a good
plan. The only blocked combination is `library` at 0 saves, which disables the
button and shows a hint pointing back at the selector (Discovery is one tap away).

### Folding in ENG-788's empty state

Since 0-saved is no longer a dead end, the held `<PlanEmptyState>` is **no longer
the whole screen**. Under `plan_source_selector`:

- **Mobile** always renders the config form with the selector on top. When
  `planSource === "library" && savedRecipes.length === 0`, an inline
  "My library is empty" hint replaces the days/start/meals + generate button
  (the selector stays visible above as the discovery escape hatch). The
  standalone `<PlanEmptyState>` now renders **only** on the legacy
  `!planSourceSelector` arm.
- **Web** renders the selector above the existing Days / Slots / Start controls;
  the `planner-empty-state` card keeps its calm copy and its generate button
  stays live (default source works), disabling only for the `library`-at-0 case
  with the same hint.

ENG-788's primary-accent selected-pill fix carries over unchanged via
`primaryPills = planSourceSelector || planEmptyStateV2`.

## Why one shared helper

The implicit pool divergence above is exactly the class of bug that recurs when
each platform builds its own pool inline. So the pool maths, the row copy, the
default, and the generate-gate all live in **one** module —
`src/lib/planning/planSource.ts` (`@suppr/shared/planning/planSource` on mobile,
`@/lib/planning/planSource` on web):

- `PLAN_SOURCE_MODES`, `DEFAULT_PLAN_SOURCE_MODE` (`library_and_discovery`)
- `selectPlanPool(mode, { library, discover })` — flattens to the single pool the
  plan algos already accept, **de-duping discover against the library** in
  combined mode (mobile already did this; web didn't — now unified)
- `canGenerateFromSource(mode, { libraryCount, discoverCount })`
- `PLAN_SOURCE_ROW_META` + `planSourceCount(mode, counts)` — the row titles /
  subtitles / empty-subtitles and the count badge maths, consumed by **both**
  `PlanSourceSelector` components so the wording can't drift

## Why a flag

This is a **layout + behaviour change** to the generate flow — the class
CLAUDE.md requires behind a flag. The old path stays alive in the `else` on both
platforms (web: saved-only + toast-gate; mobile: `>= 6 ? saved : full`), ramped
via PostHog. Not the flagless correctness class.

## Decision-framework note

**Top failure modes considered:** (1) **discover pool empty → "Discovery only"
becomes a dead end of its own.** Mitigated: `canGenerateFromSource` gates on the
*chosen* source's count, the button disables with a hint, and the default
(`library_and_discovery`) only needs the *sum* > 0. Discovery is backed by the
curated seed set, which is non-empty by construction. (2) **double-counting a
recipe that's both saved and discoverable** (inflated badge / duplicate in the
candidate pool). Mitigated: `selectPlanPool` de-dupes discover against library
ids, and the callers pass a `discoverCount` already filtered against saves, so
`planSourceCount` (`lib + dis`) is correct. (3) **the two platforms drift on copy
or pool maths again.** Mitigated: every user-visible string and the pool/gate
logic come from the one shared module; web + mobile component tests assert the
same testIDs / labels / counts.

**Three alternatives weighed:** **(A)** expose the choice as a selector *(chosen
— matches Grace's "always give these options")*; **(B)** pick Model A on both
(web adopts mobile's library-first gate) — rejected, it removes a capability
("plan from discovery") Grace explicitly wants; **(C)** pick Model B on both
(always fold discover in silently) — rejected, it keeps the pool source hidden
and off-brand at 0 saves ("plan from *your* recipes" silently becoming
"strangers' recipes"). Exposing the choice resolves the off-brand worry from the
ENG-788 recommendation: discover is opt-in and labelled, not a silent fallback.

**Confidence: 8/10.** The pool/gate/copy contract is pinned by unit tests on both
platforms and the prototype; residual uncertainty is the sim/browser eyeball
(does the radio-row control read premium at device scale, and does the empty-case
hint read as helpful rather than scolding), which the held sim pass resolves.

## Implementation

### Shared — `src/lib/planning/planSource.ts`

Added `PLAN_SOURCE_ROW_META` (title / subtitle / emptySubtitle per mode) and
`planSourceCount`; rewired `planSourceLabel` to read the row meta so the short
label and the row title can't diverge. `selectPlanPool` / `canGenerateFromSource`
/ `DEFAULT_PLAN_SOURCE_MODE` unchanged.

### Mobile — `apps/mobile/components/plan/PlanSourceSelector.tsx`

Presentational three-row radio control; now consumes the shared
`PLAN_SOURCE_ROW_META` + `planSourceCount` (dropped its inline copy). testIDs
`plan-source-selector` / `plan-source-row-${mode}`, `accessibilityRole="radio"`,
label `"{title}, {n} recipe(s)"`.

### Mobile — `apps/mobile/app/(tabs)/planner.tsx`

`planSourceSelector` flag + `planSource` state (default
`library_and_discovery`); `discoverCount` memo (de-duped); pool built via
`selectPlanPool` when the flag is on; `generateDisabled` /
`libraryEmptySubcase` drive the folded empty state; the selector is also exposed
in the regenerate "Plan setup" sheet. `primaryPills` widens the ENG-788
primary-accent pills to either flag.

### Web — `src/app/components/PlanSourceSelector.tsx` (new)

Web twin of the mobile control — same shared helper, same testIDs / aria /
copy, Tailwind tokens (`border-primary bg-primary/10 text-primary` selected).

### Web — `src/app/components/MealPlanner.tsx`

`planSourceSelector` flag + `planSource` state; `discoverCount` /
`sourceCanGenerate` derived; the selector renders above Days / Slots / Start;
`handleRegenerate` threads `...(planSourceSelector ? { source: planSource } : {})`;
the empty-state card + bottom CTA disable on `!sourceCanGenerate` with a hint.

### Web — `src/context/AppDataContext.tsx`

`generateMealPlan` options gained `source?: PlanSourceMode`. When set, it builds
`discoverPool = [...seedsToRecipeCards(SEED_RECIPES_V2), ...uploadedRecipes]`,
gates via `canGenerateFromSource`, and resolves `pool = selectPlanPool(source,
{ library: savedRecipes, discover })`; the generate call, the leftover-servings
map, and the `poolSize` telemetry all read `pool`. Omitting `source` keeps the
legacy saved-only + 0-saved toast-gate.

### Contrast (a11y) — selector + planner pills

The Storybook `addon-a11y` axe run on `PlanSourceSelector.stories.tsx` failed
5/5 stories: the first draft coloured the *selected* row's title + count badge
`text-primary` (mobile `colors.tint`) on the `bg-primary/10` tint fill, which
measures **2.89:1 — below WCAG AA**. Fixed by adopting the canonical LogSheet
slot-pill pattern: soft tint fill + **`text-foreground` label** (mobile
`colors.text`). The same fix was applied to the four selected-segment pills that
are the selector's direct visual peers in the generate form — `MealPlanner.tsx`
slot chip / day-count / slot-toggle / start-date, and mobile
`dayBtnTextActivePrimary` — so the whole form reads consistent and AA-passing on
both platforms. The wider `bg-primary/10` + `text-primary` class (badges, chips,
paywall, etc. across other tabs) is tracked for a deliberate audited sweep in
**[ENG-828](https://linear.app/suppr/issue/ENG-828)** — not fixed blind here.

## Tests

- `tests/unit/planSource.test.ts` (web shared helper) — 12/12 green
  (`planSourceLabel`/`PLAN_SOURCE_ROW_META`/`planSourceCount` covered).
- `tests/unit/planSourceSelectorWeb.test.tsx` (new) — 9/9: component contract
  (3 rows, counts, selected radio, onChange, singular label, empty subtitle) +
  source-pins on the MealPlanner flag/thread/render and the AppDataContext
  pool-via-helper wiring.
- `apps/mobile/tests/unit/planSourceSelector.test.tsx` — 5/5 (unchanged after
  the shared-copy refactor; copy identical).
- `apps/mobile/tests/unit/planSourceParity.test.ts` — 3/3.
- `apps/mobile/tests/unit/plannerMicrocopyDc12.test.ts` — 4/4 (`primaryPills`
  title source-pin).
- `src/app/components/PlanSourceSelector.stories.tsx` (new) — 5 stories
  (Default / Library / Discovery / ZeroSavedLibrary / DefaultDark) under the
  Storybook `addon-a11y` axe runner, 5/5 green **after** the contrast fix
  (caught the 2.89:1 selected-label defect; see Contrast note above). This is
  the visual proof path for web, which has no dev flag-override to screenshot
  the flag-ON selector from a live authed session.
- Web + mobile typecheck clean.

## Parity

One control, one shared helper, both platforms, default `library_and_discovery`.
The pre-existing implicit divergence (mobile folded discover < 6 saved; web
saved-only + toast-gate) is closed: under the flag both build the pool through
`selectPlanPool` from the user's explicit choice. The legacy `else` arms remain
platform-specific only until the flag reaches 100% and the gate is removed.

## Rollout

Flag `plan_source_selector`, web + mobile. Held local-only for Grace's sim +
browser sign-off (does the selector read premium; does the 0-saved `library`
hint read helpful). Forced on for the sim via
`EXPO_PUBLIC_FLAG_FORCE_PLAN_SOURCE_SELECTOR=true`. Once signed off it ramps via
PostHog; after two weeks at 100% with no regression the gate + both legacy arms
(and `plan_empty_state_v2`, now subsumed) can be removed in a cleanup PR.
