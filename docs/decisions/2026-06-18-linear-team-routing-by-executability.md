# Linear team routing by executability (ENG vs GROW)

**Date:** 2026-06-18  
**Status:** Resolved  
**Owner:** Grace Howse  

## Decision

Keep the **two-team Linear cap** (Engineering + Growth) but redefine ownership by **executability**, not by legacy function names.

| Team | Slug | Owns |
|------|------|------|
| **Engineering** | `ENG` | Work whose acceptance criteria include **merged code** — features, bugs, polish, tests, repo docs, infra-as-code (CI, scripts, env verification in repo). Legal/compliance **copy + UI** agents implement; counsel approves (`needs/decision` until ratified). |
| **Growth** | `GROW` | **Grace-only human work** — no PR. Vendor dashboard clicks, env var UI (Vercel/Supabase/Sentry/RC/ASC), filings, counsel/CPA calls, creator outreach, filming, content calendar execution, beta recruitment, PostHog alert wiring in dashboard. |

## Routing rule (one line)

**If AC = "Grace clicks in a vendor UI" or "Grace talks to counsel" → GROW.**  
**If AC = "merged to main" → ENG.**

## Labels

- **`grace-only`** — Growth-team issues; agents must not pick up (even if description mentions helper scripts Grace runs).
- **`needs/decision`** — Engineering parent/decision tickets until Grace resolves; then spawn child ENG issues with `ready-for-agent`.
- **`ready-for-agent`** — Engineering only; never on Growth team.

## Product decisions on Engineering

Product calls stay on **ENG** with `needs/decision` until Grace resolves. Implementation children get `ready-for-agent` + agent labels after the decision is recorded in `docs/decisions/`.

## Legal / compliance split

| Type | Team | Example |
|------|------|---------|
| Disclaimer UI, import gates, DMCA page copy in repo | ENG | ENG-857/858 import disclaimer UI |
| Register DMCA agent, book counsel, Stripe Tax dashboard | GROW | GROW-47, GROW-48, GROW-45 |

## Agent pickup

Agents filter **`team:Engineering`** + delegate/labels per `docs/planning/linear-agent-workflow.md`.  
**Never** auto-pick `team:Growth` or `label:grace-only`.

## Migration (2026-06-18)

Bulk re-home applied in Linear. Identifiers **renumber on team change** — use Linear URLs or this map when searching old IDs:

### ENG → GROW (grace-only)

| Was | Now | Title (short) |
|-----|-----|----------------|
| ENG-522 | GROW-45 | Flip STRIPE_TAX_ENABLED |
| ENG-859 | GROW-47 | Register DMCA agent |
| ENG-182 | GROW-50 | US cross-border CPA consult |
| ENG-184 | GROW-49 | Stripe $2,500 credit |
| ENG-199 | GROW-52 | VAT notes in Stripe/RC dashboards |
| ENG-513 | GROW-48 | Phase 2 compliance chain |
| ENG-198 | GROW-46 | RevenueCat offerings |
| ENG-3 | GROW-53 | Apple Small Business Program |
| ENG-4 | GROW-51 | App Store rating ≥4.6 |
| ENG-718 | GROW-54 | Decisions log sweep |
| ENG-179 | GROW-55 | Cayman immigration counsel |
| ENG-558 | GROW-60 | Supabase leaked-password protection |
| ENG-541 | GROW-56 | Sentry allowed domains |
| ENG-560 | GROW-58 | Sentry DSN-test housekeeping |
| ENG-514 | GROW-57 | Solo-founder safety net |
| ENG-670 | GROW-61 | Reel parse-rate PostHog gate |
| ENG-2 | GROW-59 | Plate-loop DAU gate |
| ENG-7 | GROW-62 | 100 Reel import batch (Grace runs audit) |

### GROW → ENG (PR work)

| Was | Now | Title (short) |
|-----|-----|----------------|
| GROW-17 | ENG-1202 | Editorial Discover seed |
| GROW-18 | ENG-1204 | Landing hero hybrid positioning |
| GROW-19 | ENG-1203 | MFP-switch merchandising (barcode/macros) |

## Follow-up

- [ ] Grace: review Growth backlog views (`team:Growth`, `label:grace-only`) weekly.
- [ ] Agents: when opening ops tickets, default to GROW + `grace-only` if no PR.
- [ ] Split mixed tickets (e.g. GROW-51 store-review code vs beta recruitment) into ENG child + GROW parent when touched.

## References

- `docs/planning/linear-agent-workflow.md` — agent pickup + grace-only
- `docs/migration/linear/notion-tasks-to-linear.md` — workspace blueprint (updated)
- `docs/planning/linear-team-routing.md` — quick reference
