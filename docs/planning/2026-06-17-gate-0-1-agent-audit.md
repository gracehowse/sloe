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

## Recommended next agent slices (post–Gate 1.5 batch `4c4459bb`)

Ranked by S effort + launch cohesion impact:

| Rank | Ticket | Effort | What |
|------|--------|--------|------|
| 1 | **ENG-901 M6** | S | Web import-success win-moment overlay (mobile has it; `RecipeUpload.tsx` + `useWebWinMoment`) |
| 2 | **ENG-898** | S | Remaining import partials — recent imports list, caption-preview trust card |
| 3 | **ENG-897** | S | Auth signup email-step pixel (`app/login/ui.tsx` vs Figma `296:2`) |
| 4 | **ENG-896** | S | Discover seamless slab cards (`DiscoverFeed.tsx`) |
| 5 | **ENG-889** | S–M | S5 Fresh start verify; screenshot wall checklist |

## Quick-wins strategy (2026-06-17)

User direction: **burn down small open items** across ~283 ENG issues instead of strict gate-only sequencing.

**Prefer:** test pins, copy parity, CI mocks, token/spacing fixes, dead-code removal with test update.  
**Skip:** Grace-ops, legal, billing wiring, schema migrations, large refactors.  
**Queue doc:** `docs/planning/2026-06-17-quick-wins-backlog.md` (populated by triage pass).
