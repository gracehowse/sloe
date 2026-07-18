# ENG-1577 primary-control residual census

**Date:** 2026-07-18
**Scope:** authenticated Plan, Recipes, Progress, Settings, and Log controls
**Decision:** `docs/decisions/2026-07-17-primary-ui-consistency-contract.md`

## Result

The ENG-1375/ENG-1532 control work is retained. The census found one visual
residual—not a need for another control system: Recipes category/provenance
chips used the sanctioned soft-tint selection but carried a mobile hairline and
different label sizes between Library and Discover. Under
`primary_screen_chrome_v1`, both clients now use the small shared chip type role
and borderless treatment. Their flag-off branches preserve the prior rendering.

No unexplained search, chip, or segmented-control variant remains on the primary
surfaces in scope.

## Census

| Surface | Control | Web owner | iOS owner | Ruling |
|---|---|---|---|---|
| Plan | Meal filters | `PlanMealFilterChipsV3` → `FilterChip` | `PlanMealFilterChipsV3` → `FilterChip` | Converged; retained. |
| Plan | Named-plan selector | local plan-slot row | local plan-slot row | Intentional management selector, not a filter: selection switches stored plan state and long-press exposes rename/delete. It remains visually distinct from query filters. |
| Recipes | Cookbook/Discover switch | `RecipesTabChrome` → `SegmentedTrack` | `RecipesTabChrome` → `SegmentedTrack` | Converged under `component_grammar_dedup`; legacy `SubTabPill` remains the kill switch. |
| Recipes | Category/provenance chips | local horizontal host using §7 tokens | local horizontal host using §7 tokens | Residual corrected under `primary_screen_chrome_v1`: 12px small-chip role, no border, soft-tint selection. The host stays local to preserve 36pt minimum height, Dynamic Type clamp, scroll padding, and stable analytics/test IDs. |
| Progress | Period and metric selectors | `SegmentedTrack` | `SegmentedTrack` | Converged; retained. |
| Settings | Preference selectors | `SettingsSegmented` | `SegmentedTrack` | Intentional specialised wrapper for two/three-column setting values; both implement the §8 rail/thumb grammar ratified by ENG-1532. |
| Log | Search row and method grid | canonical `LogSheet` | canonical `LogSheet` | Converged. An active query owns results and suppresses secondary method/barcode chrome under `component_grammar_dedup`. |
| Recipes | Library/Discover search | local host inputs over shared persisted query state | local host inputs over shared persisted query state | Intentional: distinct data scopes and placeholders, identical token geometry. Not a segmented/chip variant and no replacement primitive is warranted. |
| Settings | Settings search | route-index search | route-index search | Intentional pushed-screen index search with direct routing; not interchangeable with recipe or food-result search. |

## Acceptance evidence

- `tests/unit/primaryControlResidualCensus.test.ts` pins the shared owners,
  flag-gated Recipes correction, and the Log active-query suppression.
- `tests/unit/libraryFilterPillPadding.test.ts` preserves the iOS clipping fix
  while allowing the flag-on shared small-chip role.
- Visual closure is recorded in
  `docs/planning/2026-07-17-primary-ui-consistency-action-plan.md`.
