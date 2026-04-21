# Design-system sweep — mobile icon parity (R1–R6)

**Status:** Resolved
**Area:** Design system, mobile, parity
**Decided by:** Grace, 2026-04-21

## Decision

All remaining mobile surfaces migrated from `@expo/vector-icons` (Ionicons + MaterialCommunityIcons) to `lucide-react-native`, matching the Claude Design prototype icon set and closing the web↔mobile icon-library parity gap (web already uses `lucide-react`). Scope covers the six files identified as R1–R6 in the 2026-04-21 sweep plan:

- `apps/mobile/app/paywall.tsx` (R1)
- `apps/mobile/app/(tabs)/more.tsx` (R2)
- `apps/mobile/app/(tabs)/progress.tsx`, `apps/mobile/app/progress-metric.tsx`, `apps/mobile/components/today/TodayStreakInsightCard.tsx` (R3)
- `apps/mobile/app/(tabs)/discover.tsx` (R4)
- `apps/mobile/app/(tabs)/planner.tsx` (R5)
- `apps/mobile/app/(tabs)/settings.tsx` (R6)

Icon mapping followed the table in `docs/planning/design-system-sweep-plan-2026-04-21.md` §Part 2. Stroke width 1.75 on outlined glyphs to match prototype.

## Rationale

- Carryover rule #2 (`project_prototype_carryover_rules.md`): prototype icons must be exact, not approximations — web had already adopted lucide; mobile had a mixed Ionicons/MCI set.
- Single icon vocabulary across web + mobile removes a silent tier-difference: Ionicons' filled/outline duality reads chunkier and less premium than lucide's uniform stroke.
- Parity rule (`feedback_mobile_decisions_apply_to_web.md`) — this one flows the other direction (mobile catching up to web), which is equally in-scope.

## Consequences

- `@expo/vector-icons` remains a transitive dep (used by Expo internals) but should not be imported from app code going forward. `design-system-enforcer` treats any new `Ionicons` / `MaterialCommunityIcons` import as a regression.
- Semantic overrides recorded in the sweep plan stand (e.g. Discover protein = `Beef`, Plan Dinner = `UtensilsCrossed` not `Moon`).
- Typecheck green post-migration; no behavioural change beyond visuals.

## Related

- `docs/planning/design-system-sweep-plan-2026-04-21.md` — source plan with per-file icon table.
- `project_prototype_carryover_rules.md` — project-wide carryover rules (rule #2: icons).
- `feedback_prototype_icons_exact.md` — "use lucide-react-native on mobile for prototype glyphs".
