# Launch queue — 2026-07-01 free founding cohort

**Updated:** 2026-06-12  
**Canonical Linear filters:** `docs/planning/linear-views-launch-2026-07-01.md`  
**Monetisation gates:** `docs/ux/research/2026-06-11-launch-monetisation-sequencing.md`

## Two gates (do not conflate)

| Gate | Meaning | Label in Linear |
|------|---------|-----------------|
| **Gate A** | Safe to onboard first **comped** user (founding 100) | `launch-blocker` |
| **Gate B** | Safe to charge the **first paid** sub | `paid-ga-blocker` |

July 2026 viral push is gated by **Gate A only**. Billing (Stripe Tax, IAP, VAT) is **Gate B** — parallel, not a July blocker.

## WIP limits

| State | Cap | Contents |
|-------|-----|----------|
| In Progress | ≤ 4 | Active Gate A + one engineering lane |
| Todo | ≤ 12 | Ordered queue below |
| Backlog | everything else | Default High/Medium |

## Gate A — shipped in repo (mark Done in Linear)

| Issue | Notes |
|-------|--------|
| ENG-1035 | BEFORE INSERT tier lockdown |
| ENG-1036 | Recipe view RLS lockdown |
| ENG-1043 | Promo RPC GUC bypass |
| ENG-857 | Import `description: null` |
| ENG-858 | Import source disclaimer |
| ENG-1038–1041, ENG-1044 | Vendor cache, goal timeline, shopping parity, fiber, nav parity |
| ENG-1042 | Duplicate of ENG-858 — Done |

**Live verify:** `node --import tsx scripts/verify-gate0-db.mts` → **5/5** (needs `GATE0_VERIFY_PASSWORD` in `.env.local` for throwaway account).

## Gate A — Todo queue (order)

| # | Issue / task | Owner |
|---|----------------|-------|
| 1 | Gate0 live **5/5** | G + E |
| 2 | **ENG-859** DMCA designated agent | G |
| 3 | TestFlight **1.0.7 (57)** smoke — see checklist below | G |
| 4 | **ENG-874** Apple Health device matrix (In Progress) | G + E |
| 5 | **ENG-670** Reel parse-rate gate | G |
| 6 | **ENG-1059** OFF search proxy + cache — **implemented locally** (`/api/off/search`, web + mobile clients); needs commit + deploy | E |
| 7 | **ENG-772** Editable `eaten_at` | E |
| 8 | Deep-link dismisses Log sheet (file if no ENG) | E |

## Gate A — In Progress (keep)

- **ENG-874** — Health sync device proof
- **ENG-877** — Search golden battery
- **ENG-840** — Flag-force in bundled apps

## Gate B — `paid-ga-blocker` (parallel track)

| Issue | Note |
|-------|------|
| ENG-3 | Enrol SBP **before first paid iOS sub** (not before free cohort) |
| ENG-33 | Stripe Tax — Blocked, Grace |
| ENG-101 | RevenueCat IAP — Blocked, Grace |
| ENG-198 | RC offerings — Todo, Grace |
| ENG-667 | VAT inclusive + EUR SKU — Backlog, Grace |
| ENG-123 | Base→Free collapse only — Backlog |
| ENG-49 | Creator lifetime comps only — Backlog |

Founding cohort comp: `lifetime_pro` via `redeem_promo_code` (ENG-1043) — **not** RC offer codes.

## TestFlight 57 smoke checklist (Grace, physical iPhone)

Use **TestFlight build 57** (1.0.7), not Expo dev client / tunnel.

- [ ] Cold open Today — no crash
- [ ] Log food via search (chicken breast) — ring updates
- [ ] Import shared Reel URL → library save
- [ ] Plan → generate shopping list (portion-scaled qty spot-check)
- [ ] Redeem test promo / founding code → Pro gates unlock
- [ ] Optional: Apple Health sync (ENG-874 matrix)

Record pass/fail in ENG-874 or a TestFlight comment.

## Before adding Urgent to Todo

- [ ] Blocks **first comped user**? → `launch-blocker` + Todo
- [ ] Blocks **first payment** only? → `paid-ga-blocker`, Backlog or Gate B Todo (max 3–5)
- [ ] Polish / architecture / category-leading? → Backlog
- [ ] Already shipped? → Done + commit link

## ENG-567 premium program

Through **25 Jun 2026:** Gate A only. P5 web redesign + architecture extractions are **Backlog**, not launch queue.
