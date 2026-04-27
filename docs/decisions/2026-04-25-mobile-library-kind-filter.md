# Decision log: mobile library kind filter — already shipped (P2-22, 2026-04-25)

**Date:** 2026-04-25
**Status:** Resolved — was already shipped before P2-22 surveyed it
**Trigger:** P2-22 in [Opus 4.7 codebase review](./2026-04-25-opus47-codebase-review.md). Audit said the mobile library "only sorts (recent/calories/protein); no kind filter" while web exposed both filter + sort.

---

## Decision

**No code change required.** Mobile library already ships the kind filter (Saved / Created / Imported) plus an "All" + nutrition/time/diet pill at `apps/mobile/app/(tabs)/library.tsx:99` (state) + line 119 (filter logic) + the rendered pill row. The "Pass 6" web-parity work shipped 2026-04-18; the prototype port refined it on 2026-04-20.

The shared filter shape lives at `src/lib/recipes/libraryFilters.ts`. Mobile and web both use the same `LibraryFilterPillId` enum and the same `entryKindForCard` derivation. No drift.

The audit's claim is stale. Updating §6 of the audit to reflect actual state.

## Rationale

This is an audit correction rather than a code change. The kind-filter feature was tracked under "Pass 6 / web parity" months before the Opus 4.7 review and has been live in TestFlight for weeks.

## Audit correction

`docs/audits/2026-04-25-opus47-codebase-review.md` UX-agent §6 row #4 ("Library filter + sort — sort only on mobile") is stale. Mobile has both. Updating the row.

## Related artefacts

- [Mobile library](../../apps/mobile/app/\(tabs\)/library.tsx)
- [Shared filter shape](../../src/lib/recipes/libraryFilters.ts)
- [Web library](../../src/app/components/Library.tsx)
- [Opus 4.7 codebase review](../audits/2026-04-25-opus47-codebase-review.md)

## Revisit when

- A new filter pill ships on web → port to `LibraryFilterPillId` so mobile picks it up via the shared shape.
- The filter UI grows past five pills → consider a dropdown / sheet pattern instead of a horizontal pill row (the prototype-port work flagged scrunching at small viewports).
