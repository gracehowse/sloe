# Gate 0 / Gate 1 — agent-buildable audit (2026-06-17)

**Purpose:** Separate what agents can ship in-repo from Grace-ops / device work.  
**Authority:** `docs/planning/2026-06-14-backlog-priority-order.md` (rev 14).

## Gate 0 — pre-any-user

| Ticket | Agent-buildable? | Notes |
|--------|------------------|-------|
| **ENG-859** | **No** | DMCA designated agent — incorporation + Grace ops. Checklist: `docs/operations/eng-859-dmca-filing-checklist.md` |

**Gate 0 code path:** Clear. No remaining agent-buildable Gate 0 items.

## Gate 1 — pre-viral-launch

| Ticket | Agent-buildable? | Effort | Notes |
|--------|------------------|--------|-------|
| **ENG-1060** | **No** | — | TestFlight build-57 smoke — Grace device. Checklist: `docs/testing/testflight-build-57-smoke-checklist.md` |
| **ENG-874** | **No** | — | Apple Health MFP import verify — Grace device. Runbook: `docs/testing/health-sync-device-runbook.md` |
| **ENG-670** | **Partial** | S | Harness shipped (`npm run audit:reels`). **Grace:** curate 100 Reel URLs + three green days. |

**Gate 1 code path:** No net-new agent slices until device tests complete. Cheap follow-ups elsewhere (quick-wins queue) are fine.

## Recommended next agent slices (updated 2026-06-18)

Batch 3 Core-5 partials largely landed on `main` (#472, #475). **In flight:** PR #476 (ENG-901 trust strip + Sloe upgrade dialog; ENG-889 coach-in-hero).

| Rank | Ticket | Effort | What | Status |
|------|--------|--------|------|--------|
| — | **ENG-901** | S | Merge #476; then mobile paywall shell/hero parity | **PR #476 open** |
| — | **ENG-889** | S–M | Coach-in-hero (#476); then TD1/TD2/TD4 or L5 dark | Partial on main + PR |
| 1 | **ENG-896** | S | Next high partial on Discover or Library (see migration tracker) | Discover slabs done |
| 2 | **ENG-898** | S | Source tiles / L4 error / remaining import chrome | Recent imports done |
| 3 | **ENG-897** | S | Signed-out screenshot wall for email step | Test pin on main |
| — | **ENG-1100** | — | Empty-slot extract + partial-day rows | **Done** (#472+#475) |

Prior ranks 1–5 (M6, recent imports, email pin, Discover slabs, S5) **shipped** via #472.

## Quick-wins strategy (2026-06-17)

User direction: **burn down small open items** across ~283 ENG issues instead of strict gate-only sequencing.

**Prefer:** test pins, copy parity, CI mocks, token/spacing fixes, dead-code removal with test update.  
**Skip:** Grace-ops, legal, billing wiring, schema migrations, large refactors.  
**Queue doc:** `docs/planning/2026-06-17-quick-wins-backlog.md` (populated by triage pass).
