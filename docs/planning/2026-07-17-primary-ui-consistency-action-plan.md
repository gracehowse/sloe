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
