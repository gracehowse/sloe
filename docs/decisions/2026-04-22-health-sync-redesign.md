# Decision: Health Sync screen redesign — no per-type permission indicators

**Date:** 2026-04-22
**Status:** Resolved
**Area:** Mobile / Health integration

## Context

The original Health Sync screen showed five rows (steps, weight, active energy, resting energy, workouts) with a circle or green tick on each row. The tick indicated the HealthKit connection had been granted — not that the individual category's read permission was on.

Apple HealthKit does not expose per-type read permission state at runtime. An app cannot query whether the user has granted read access to a specific HKQuantityType; requesting status returns "not determined" by design (privacy model). The only honest signal is whether a sync actually returned data for that category.

## Decision

Remove all per-type indicators. Replace with:

1. A single **HealthStatusPill** on the Apple Health connection card with three states: `disconnected`, `connected`, `attention`. The pill reflects connection state (something we know) not per-type permissions (something we cannot know).

2. **Per-row "last value" display** — e.g. "8,420 today", "72.4 kg · Mon". A populated number = "this category was successfully read in the last sync." A `—` em dash = "empty or not shared." This is honest: it describes observed behaviour, not asserted permission state.

3. **"Needs attention" pill state** fires only on the F-57 heuristic: body data synced but dietary data returned empty + no known-own samples skipped. This is the most reliable proxy we have for "Nutrition read permission is probably off."

## Consequences

- No element on the Health Sync screen looks like an unselected checkbox or radio button that the user could tap.
- The screen is simpler and easier to read.
- Users who want per-type permission control are directed to the Health app (Open Health app link in Utilities section).
- This rule is binding: do not add per-type permission UI without a verified HealthKit API that exposes read status.
