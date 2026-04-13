# Decision: intermittent fasting — web vs mobile (2026-04)

**Status:** active  
**Backlog:** T13 in `docs/planning/sweep-2026-04-executor-backlog.md`

## Decision

The **fasting timer** (start/end fast, live duration, session history) is **mobile-only** for now. It reads and writes `profiles.fasting_sessions` and `profiles.fasting_window` from the Expo app.

The **web app** does not ship an equivalent timer UI in this phase. Web users who care about fasting are directed to the **mobile app** via Help copy.

## Rationale

Fasting is a focused, glanceable experience that fits native timers and notifications; building parity on web was deferred to reduce scope. Profile fields remain shared so data is not lost when users use both clients later.

## Related

- In-app copy: [`app/help/page.tsx`](../../app/help/page.tsx) (Intermittent fasting timer)

## Revisit when

Product chooses to add a minimal web fasting page, or when notification/reminder requirements justify a single cross-platform surface.
