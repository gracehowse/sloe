# Gate 1.5 closeout — 2026-06-17

**Branch:** `claude/wave-4-trust-cohesion` · **PR:** [#470](https://github.com/gracehowse/Suppr/pull/470)  
**Latest commit:** `4c4459bb` (parallel slices) · **Intent:** Ship remaining agent-buildable Gate 1.5 items; document Grace-ops residuals.

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

## Partial close — acceptable for July launch

| Ticket | Status | Residual (agent-buildable) |
|--------|--------|----------------------------|
| **ENG-889** Today | L1 skeleton shipped | S5 Fresh start; populated-account screenshot wall; Layer-3 edge frames |
| **ENG-901** Paywall / win | M5 shipped | **M6** import-success overlay on web |
| **ENG-896** Recipes | Library grid shipped | Discover seamless slab cards |
| **ENG-898** Import | WORKS WITH row shipped | Recent imports wiring; caption-preview trust card |
| **ENG-897** Auth | Chooser rebuilt | Signup email-step pixel pass (`296:2`) |

These stay **open as Layer-3 polish** until closed; not all are launch blockers at Layer 2.

## Grace-ops / decisions (not code)

| Ticket | Action |
|--------|--------|
| **ENG-558** | Enable Leaked Password Protection in Supabase Auth dashboard |
| **ENG-541** | Lock Sentry Allowed Domains for `suppr-web` |
| **ENG-1158** | Decide `AI_BUDGET_ENFORCEMENT_ENABLED` before viral push |
| **ENG-859** | DMCA designated agent (Gate 0) |
| **ENG-1060 / ENG-874** | Grace device smoke (Gate 1) |
| **ENG-1128** | **Done in code** — `paraphraseInstructionsField` at persist + import route |

## Gate 1.5 bar after PR #470 merge

- **Wedge cluster:** Done (North Star, cold-open, refugee fork, paywall honesty, barcode CTA)
- **Onboarding:** Welcome + reveal + pace + projection + app-choice — conformant at copy/chrome level
- **Today trust:** WhyThisNumber + planned empty + loading skeleton live
- **Win moments:** Streak M5 live; import-success M6 web gap remains
- **Security eng:** CSRF, nutrition_entries test, FatSecret guard — done; dashboard toggles remain

**Cohesion confidence:** 8/10 post-merge (was 7/10) — pending TF58+ device verify + fresh screenshot wall.

**Companion:** Gate 0/1 agent audit → `docs/planning/2026-06-17-gate-0-1-agent-audit.md`
