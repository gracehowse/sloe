# Gate 1.5 closeout — 2026-06-17

**Branch:** merged to `main` via [#472](https://github.com/gracehowse/Suppr/pull/472) (2026-06-18).  
**Follow-up PRs:** [#475](https://github.com/gracehowse/Suppr/pull/475) ENG-1100 extract · [#476](https://github.com/gracehowse/Suppr/pull/476) ENG-901/889 **merged**.

## Shipped in this batch

| Ticket | Commit / PR | Change |
|--------|-------------|--------|
| **ENG-1184** | `4320800f` | Status chip on Today → inline `WhyThisNumber` / sheet (web + mobile) |
| **ENG-1065** | `4320800f` | `today_planned_empty_state` default-on; Planned empty card |
| **ENG-895** | `4320800f` | Welcome Figma copy; reveal sage check; shared `figmaCopy.ts` |
| **ENG-889 L1** | `f04779fd` | Today-shaped web loading skeleton; `nutritionJournalHydrated` gate |
| **ENG-901 M5** | `4c4459bb` | Streak win-moment: milestone numeral + `days consistent.` (web + mobile) |
| **ENG-896** | `4c4459bb` | Library unified `library-recipe-grid` (retired desktop prototype grid) |
| **ENG-898** | `4c4459bb` | Web WORKS WITH trust chips on import (replaced fake Import-from router) |
| **ENG-1124** | `main` | Already shipped (PR #463) |
| **ENG-964/965/932** | `main` | Backlog reconciled |

## Partial close — acceptable for July launch (updated 2026-06-18)

| Ticket | Status on `main` | Residual |
|--------|------------------|----------|
| **ENG-889** Today | L1 + S5 (#472); coach-in-hero + mobile L1 skeleton (#476) | TD1–TD4, L5 dark, pixel deltas, populated-account screenshot wall |
| **ENG-901** Paywall / win | M5 + M6 (#472); trust strip + Sloe upgrade dialog + pricing dedupe (#476) — **Done** | — |
| **ENG-896** Recipes | Discover slabs (#472); library L2 loading skeleton (#483) | Library + 8 other partials on parent |
| **ENG-898** Import | Recent imports + WORKS WITH + caption (#472); action-sheet Pro lock (#483) | Source tiles, L4 error, 5 other partials |
| **ENG-897** Auth | Chooser + email-step test pin (#472); signed-out screenshot captured (#483) | Fresh screenshot wall pass |
| **ENG-1100** Plan slots | **Done** — extract (#475) + partial-day canonical rows (#472) | — |

These stay **open as Layer-3 polish** until closed; not all are launch blockers at Layer 2.

## Grace-ops / decisions (not code)

| Ticket | Action |
|--------|--------|
| **GROW-60** (was ENG-558) | Enable Leaked Password Protection in Supabase Auth dashboard |
| **GROW-56** (was ENG-541) | Lock Sentry Allowed Domains for `suppr-web` |
| **ENG-1158** | Decide `AI_BUDGET_ENFORCEMENT_ENABLED` before viral push |
| **GROW-47** (was ENG-859) | DMCA designated agent (Gate 0) |
| **ENG-1060 / ENG-874** | Grace device smoke (Gate 1) |
| **ENG-1128** | **Done in code** — `paraphraseInstructionsField` at persist + import route |

Team routing: `docs/decisions/2026-06-18-linear-team-routing-by-executability.md` (on branch `docs/linear-team-routing-executability`, ENG-1209).

## Gate 1.5 bar after PR #470 merge

- **Wedge cluster:** Done (North Star, cold-open, refugee fork, paywall honesty, barcode CTA)
- **Onboarding:** Welcome + reveal + pace + projection + app-choice — conformant at copy/chrome level
- **Today trust:** WhyThisNumber + planned empty + loading skeleton live
- **Win moments:** Streak M5 + web import-success M6 live (#472)
- **Security eng:** CSRF, nutrition_entries test, FatSecret guard — done; dashboard toggles remain

**Cohesion confidence:** 8/10 post-merge (was 7/10) — pending TF58+ device verify + fresh screenshot wall.

**Companion:** Gate 0/1 agent audit → `docs/planning/2026-06-17-gate-0-1-agent-audit.md`
