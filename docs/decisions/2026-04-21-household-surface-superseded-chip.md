# 2026-04-21 — HouseholdBar filter chip superseded by live HouseholdCard

**Status:** Resolved.
**Area:** Plan tab, household surface.
**Decided by:** product-lead (agent call, 2026-04-21), confirmed by Grace.

## Decision

The Claude Design prototype ships a `HouseholdBar` — a horizontal chip strip at the top of the Plan tab that filters the plan's meals by household member (one chip per member; tap to view only their meals). **We will not implement this.** The live `apps/mobile/components/HouseholdCard.tsx` is the canonical household surface on Plan.

`design-system-enforcer` audits must **not** flag the absence of the chip bar as prototype drift.

## Why

1. Grace is the only TestFlight tester today. Households are a Base-tier+ feature with a small future segment. Adding a viewing filter to solve a problem no user has reported is premature.
2. The Plan tab's job is "what am I cooking this week", not "isolate one member's meals". A household user scanning a week of meals typically wants the whole plan so they can cook once for everyone.
3. The chip bar would add chrome (one selected state, one empty state, one mental model: "am I filtered right now?") that competes with the canonical workflow for zero current user value.
4. The prototype's chip bar is a **leftover** from a design round that predated the F-16 scope decision (self-only remaining macros for privacy). F-16 is the canonical scope model — the chip would live orthogonal to it, not as a replacement.

## Trade-off

Loses a minor power-user affordance: per-person meal filtering on the Plan list. If that ever matters, it can live inside `HouseholdCard` as a "view Alice's meals" affordance — not as top-of-Plan chrome.

## Reconsider on

Two or more real household users independently asking to isolate one member's meals on Plan. Until that signal, this is closed.

## Related

- F-16 household scope decision: self-only remaining macros, share-lunches-too toggle ([src/lib/household/scopeCopy.ts](../../src/lib/household/scopeCopy.ts), [tests/unit/householdJoinDisclosureCopy.test.ts](../../tests/unit/householdJoinDisclosureCopy.test.ts)).
- F-32 build-15 household card prototype-language port: [docs/testflight-feedback/resolved.md](../testflight-feedback/resolved.md).
- Prototype source: [docs/ux/claude-design-bundles/prototype/project/screens-mobile.jsx:3-39](../ux/claude-design-bundles/prototype/project/screens-mobile.jsx).
