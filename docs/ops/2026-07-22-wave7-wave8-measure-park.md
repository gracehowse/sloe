# Wave 7 measure gates + Wave 8 park notes (2026-07-22)

Pulled live from PostHog project **389168** during full-backlog execution.

## ENG-8 — voice log latency

- Event: `voice_log_api_completed` property `totalElapsedMs`
- Query: median + p95, last 30 days, test accounts filtered
- **Result: 0 events** in window (no production volume to gate on)
- **Status:** leave **Todo** — cannot close or open a latency pass without
  samples. Re-pull after TestFlight voice-log usage; targets remain p50 < 1000ms,
  p95 < 2500ms server-side.

Insight URL pattern: trends on `voice_log_api_completed` × `totalElapsedMs`.

## ENG-1 — onboarding completion ≥60%

- Insight: [KloZHpKy](https://us.posthog.com/project/389168/insights/KloZHpKy)
  (`onboarding_started` → `onboarding_completed`, 1-day window, filter test accounts)
- **Result: no data recorded for the insight time period** at pull time
- **Status:** leave **Todo** — instrumented; gate still waiting on cohort volume
  (ticket already says check four weeks after 2026-07-01 launch). ≥60% → Done;
  below → redesign sprint (not silent reopen).

## Wave 8 park / trigger tickets

| Ticket | Disposition |
|--------|-------------|
| **ENG-1481** | Spec shipped (`docs/specs/2026-07-22-auditable-math-v1.md`); implement after Grace ratifies |
| **ENG-1563** | Implemented this wave (latch + email escape) — close when PR merges |
| **ENG-1648** | Remain Backlog — trigger: `meal_share_link_created` > 0 sustained or user ask |
| **ENG-1634** | In Progress — shopping-list smart suggestions (overlap + macro-fit) behind `smart_suggestions_v1` |
| **ENG-1597** | Remain Backlog — help UI `needs/decision` then flag-gated build |
| **ENG-1644** | Parked Backlog — Apple Health per-type toggles until demand |

## ENG-1374 imagery epic

Do not treat as one PR. Continue via children only (never-white underlays →
deterministic placeholders → AI heroes). Parent stays epic umbrella / Backlog.
