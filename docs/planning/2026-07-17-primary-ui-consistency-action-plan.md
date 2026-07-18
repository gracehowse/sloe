# Primary UI consistency remediation — action plan

**Decision:** `docs/decisions/2026-07-17-primary-ui-consistency-contract.md`
**Audit date:** 2026-07-17
**Owner:** Grace; QA findings triage through Claude
**Delivery posture:** web + mobile parity, flag-gated visual changes, screenshot
evidence before rollout

## Outcome

Make the product read as one governed system without flattening Today’s distinct
ring-first identity. The programme fixes source-of-truth drift first, converges
shared chrome second, then closes navigation, empty-state, recipe-media, Log, and
semantic-hierarchy gaps.

## Ordered work

### Phase 0 — Ratify the source of truth

- Land the decision record and correct Constitution Rules 0/6, the Today
  exception, the ground violation row, and the stale sidebar claim.
- Keep `#F7F6FA` as the product canvas. Reserve oat for marketing; use warm-
  graded photography for appetite.
- Regenerate the decision index before any implementation ticket is picked up.

**Exit:** no product-shell warm/oat contradiction remains; unrelated prototype
claims are explicitly outside the ratification.

### Phase 1 — Converge composition and viewport ownership

1. Extend existing `ScreenChrome` / `ScreenSectionChrome` to the 33px-title,
   40px-circle contract on Plan, Recipes, Progress, and Settings. Today remains
   unchanged. Census search, chip, and segmented-control variants against
   ENG-1375/ENG-1532 before migrating anything. Flag:
   `primary_screen_chrome_v1`.
   The completed residual census is
   [`2026-07-18-eng-1577-primary-control-residual-census.md`](../audits/2026-07-18-eng-1577-primary-control-residual-census.md).
2. Close the bottom-chrome contract in ENG-1376: correct measured scroll
   clearance, move Settings to stack ownership, remove its tab bar, and select
   Settings—not Today—on desktop. Flag: `bottom_chrome_contract_v1`.

**Exit:** the four standard screens share one title/action treatment; every last
row is reachable; Settings has one navigation model.

### Phase 2 — Repair empty and sparse composition

1. Complete desktop Plan empty-week parity under existing `sloe_v3_plan` and
   `empty_state_grammar_v1`: render `PlanEmptyWeekCard`, hide `StatStrip` and the
   dashed week body only when the whole week has zero real meals, and preserve
   partial/populated weeks.
2. Define Library layouts for 0/1/2/many recipes and converge Discover/Library
   media failure onto one deterministic plum-duotone fallback. Flag:
   `recipe_sparse_media_v1`.

**Exit:** empty screens present one invitation; a sole recipe appears once;
valid photos win and every missing/broken URL produces the same identity on both
platforms.

### Phase 3 — Finish hierarchy and semantic roles

1. Simplify the Log sheet inside the existing `component_grammar_dedup` path:
   one entry per method, one Describe affordance, and search results take over
   while a query is active.
2. Keep sibling Progress/Settings stats ink; carry state in pills, dots, arcs,
   bars, and charts. Promote available progress above weight setup when weight
   data is absent. Use `empty_state_grammar_v1` for the no-weight composition and
   `semantic_stat_roles_v1` for colour-role changes.

**Exit:** the Log hierarchy has an unambiguous primary path and data colour is
semantic rather than decorative.

## Linear mapping

| Priority | Project | Issue | Flag / relationship |
|---|---|---|---|
| High | Design system cleanup | ENG-1574 — UI consistency remediation — 2026-07-17 primary-surface pixel review | Parent |
| High | Design system cleanup | ENG-1577 — Converge primary screen chrome on the 33/40 composition contract | `primary_screen_chrome_v1` |
| High | Design system cleanup | ENG-1376 — bottom-chrome contract | `bottom_chrome_contract_v1`; existing issue promoted to child |
| High | Plan tab | ENG-1576 — Complete desktop Plan empty-week parity | `sloe_v3_plan` + `empty_state_grammar_v1`; ENG-1547 follow-on |
| Medium | Recipes tab | ENG-1575 — Fix sparse Library composition and converge recipe no-image treatment | `recipe_sparse_media_v1`; related to ENG-1374 |
| Medium | Today tab | ENG-1579 — Simplify Log sheet method hierarchy after component-grammar dedup | `component_grammar_dedup` |
| Medium | Design system cleanup | ENG-1578 — Finish Progress and Settings data hierarchy and semantic stat roles | `empty_state_grammar_v1` + `semantic_stat_roles_v1` |

Recipes temporarily moves from 12 to 13 open issues. Do not add another polish
finding there until one issue closes or is explicitly de-scoped.

## Verification matrix

Every implementation PR includes before/after PNGs and interactive checks for
its affected rows below. ARIA trees and test output do not count as visual proof.

| Surface | Data states | Required clients/themes |
|---|---|---|
| Standard chrome | normal, long title, one/two actions, disabled/loading action | desktop web, mobile web, iOS; light + dark |
| Navigation | top, final scroll row, keyboard open, pushed Settings, sheet open | desktop web, mobile web, iOS; light + dark |
| Plan | zero week, partial week, populated week, generating | desktop web + iOS; light + dark |
| Library/Discover | 0, 1, 2, many; photo, missing URL, broken URL, loading | desktop web, mobile web, iOS; light + dark |
| Log | idle, each method, active query, no results, keyboard, async commit | desktop web, mobile web, iOS; light + dark |
| Progress/Settings | no weight, one weigh-in, established trend, sparse stats | desktop web + iOS; light + dark |

Automated coverage must assert route selection and viewport clearance, Plan
zero/partial/populated branching, deterministic media fallback, one method entry
per Log mode, and the no-coloured-sibling-stat rule. Each slice runs scoped web
and mobile lint/typecheck/tests, then full `npm run ci` before its final push.

## Rollout and closure

- New flags are registered in both web and mobile allowlists with identical
  defaults; existing flags retain their current kill-switch branches.
- Ramp one coherent slice at a time. Hold a visual/structural flag at 100% for
  two weeks without regression before removing it in a documented cleanup PR.
- The coordinating issue closes only when every child is Done, ENG-1374's
  relevant fallback slice is verified, the full screenshot matrix is attached,
  tests/docs are current, and web/mobile parity is signed off.
- These findings are not `launch-blocker` work unless Claude triage explicitly
  escalates them.

## Implementation note — ENG-1576 desktop Plan empty-week parity

When both `sloe_v3_plan` and `empty_state_grammar_v1` are enabled, a desktop
week with no real meals uses the shared `PlanEmptyWeekCard`. The card replaces
the zero stat strip, seven-day dashed-slot body, and desktop insight/tool rail.
Its generate action owns the single filled CTA and exposes the existing
generating state; while generation is in flight both empty-state choices are
disabled to prevent a second commit.

Partial and populated weeks retain the normal desktop dashboard. Disabling the
empty-state flag remains the kill switch and restores the prior stat strip and
slot grid. Generation failures remain owned by `MealPlanner`'s existing toast
path, so the empty invitation remains actionable after the request settles.

**Parity:** the web card reuses the copy, cool-plum surface, action hierarchy,
and empty-week predicate already shipped by the iOS `PlanV3Surface`. Desktop
differs only in the ghost action's destination: it opens the first meal slot
directly rather than revealing a hidden seven-day wall, preserving the desktop
single-invitation grammar.

**Verification:** render coverage pins flag-on/off zero-meal behaviour plus
partial, populated, and generating weeks. Light/dark visual evidence is
collected at parent closure alongside iOS; the card adds no new colour token.

## Implementation progress — 2026-07-17

| Issue | Implemented path | Automated evidence |
|---|---|---|
| ENG-1577 | Existing web `ScreenChrome` and mobile `ScreenSectionChrome` now own the flag-gated 33px title / 40px action treatment for Plan, Recipes, Progress and Settings. Settings uses the shared pushed-screen leading slot and the `Your account` overline; Today keeps its wordmark and ring-first exception. The [residual control census](../audits/2026-07-18-eng-1577-primary-control-residual-census.md) corrected Recipes chip border/type drift without replacing ENG-1375/ENG-1532 controls. | Shared chrome, residual-census, design-token and screen-budget suites. |
| ENG-1376 | Settings moves to root-stack ownership under `bottom_chrome_contract_v1`; the hidden legacy tab route remains the rollback path. Tab clearance now includes host breathing and desktop Settings/Profile no longer falsely select Today. | Route-selection, tab-structure, settings integration and bottom-clearance tests. |
| ENG-1576 | The desktop zero-week dashboard mounts the shared invitation card, suppresses zero stats and the dashed body, opens the first slot from the quiet alternative, and disables both choices while generation runs. The iOS initial state now applies the same single-invitation law: day strip, filters, dashed slots and tool rail appear only after `or add meals as you go`. | Flag off/on plus zero, partial, populated and generating render tests. |
| ENG-1575 | The shared composition helper defines 0/1/2/many Library states; one recipe appears only as the hero and two appear once each. Discover and Library use one deterministic plum-duotone fallback for missing, whitespace and failed image URLs. | Shared derivation, fallback determinism, image-error and platform-parity tests. |
| ENG-1579 | The existing dedup gate removes the second Describe row, preserves one entry per logging method, and hides method/barcode chrome while an inline search query owns the sheet. Clearing the query restores it. | Mirrored Log-sheet inventory, active-query, accessibility and recovery tests. |
| ENG-1578 | With empty-state grammar enabled, real weekly evidence leads when weight has fewer than two points and setup moves to slot two. Under `semantic_stat_roles_v1`, Progress equation/triad and Settings summary numerals stay ink; coloured dots carry state. | Sparse/established/opt-out hierarchy tests, equation renders and semantic-role parity assertions. |

All new structural flags remain default-off in mirrored web/mobile allowlists.
The legacy branches remain live for rollback. No API, persistence, database or
schema behavior changed.

## Visual verification — 2026-07-17

Flag-on captures were inspected at pixel level for desktop web in light mode,
mobile web in dark mode, and iOS in both light and dark modes. The pass covered
Plan, Library, Progress and Settings, plus the Log sheet at rest and with an
active search query. It confirmed the standard chrome treatment, Settings route
ownership, Plan's single-invitation empty state, data-first sparse Progress,
neutral sibling stat numerals and the query-owned Log hierarchy.

The iOS one-recipe Library capture exposed a residual composition bug: the hero
was followed by the generic empty-Library card because the grid data was empty.
The empty component now keys off the filtered recipe collection rather than the
derived grid collection, and light/dark recaptures confirm the sole recipe is
rendered exactly once with no empty-state tail. A render regression test pins
that branch.

Local evidence is retained under `/tmp/sloe-ui-consistency/web` and
`/tmp/sloe-ui-consistency/ios` for the implementation session. The mergeable
evidence is the automated coverage listed above and the PR's visual summary;
no user data, API, persistence, database or schema behavior was exercised or
changed by this remediation.

The 2026-07-18 simulator recheck also caught two residuals hidden by local
default-off flags: iOS Plan still rendered its dashed manual-entry dashboard
under the zero-week invitation, and pushed Settings omitted the standard
overline. Both are now corrected under the existing flags and covered by
render/source tests. The same pass found and fixed mobile-web equivalents:
the legacy Plan tab header duplicated `Your plan`, its empty week still mounted
the manual-entry dashboard, and Settings retained root header/tab ownership.
Light and dark recaptures now show one Plan header/invitation and pushed
Settings ownership on mobile web as well as iOS.

Desktop and mobile-web light/dark recaptures cover Plan, Library, Progress,
Settings, and the Log sheet at rest and with an active query. The Log query
screens contain results and type filters only—Photo, Voice, Describe, Quick add,
barcode, day utilities, and browse tabs correctly recede until the query clears.
Desktop Library now uses the 33px title with two 40px muted circular actions;
the one-recipe fallback appears once on every inspected client and theme.

The simulator's development-only overrides leave
`primary_screen_chrome_v1`, `bottom_chrome_contract_v1`,
`recipe_sparse_media_v1`, and `semantic_stat_roles_v1` enabled so the flag-on
paths are directly visible; production defaults are unchanged pending the
controlled PostHog ramp.
