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
| 3 | TestFlight **1.0.7 (57)** smoke — feedback **submitted**; Grace reviews screenshots in ASC / `npm run testflight:feedback` | G |
| 4 | **ENG-874** Apple Health device matrix (In Progress) | G + E |
| 5 | **ENG-670** Reel parse-rate gate | G |
| 6 | ~~**ENG-1059** OFF search proxy~~ — **SHIPPED** `main` @ `94c90fcc` (PR #387) | E |
| 7 | ~~**ENG-772** Editable `eaten_at`~~ — **SHIPPED** (flag `editable_eaten_at`) | E |
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

**2026-06-12 ASC pull (`npm run testflight:feedback`):** success — `feedback-2026-06-12.json`. Build **57** is `VALID` in ASC; **22** screenshot threads on 2026-06-12 (F-158..F-179 in `tracker.md`). ASC API omits per-thread `buildVersion`; session timing + Grace's TF submit ⇒ build **57** smoke. **0** new crash threads. Signed screenshot URLs expire ~2026-06-18 — re-fetch if needed.

- [ ] Cold open Today — no crash *(no crash report in ASC; not device-proven)*
- [x] Log food via search — **partial PASS** *(search used; F-161 OFF / F-162 FatSecret micros gaps)*
- [ ] Import shared Reel URL → library save *(not evidenced in TF comments)*
- [ ] Plan → generate shopping list *(plan surfaces exercised; shopping list not mentioned)*
- [ ] Redeem test promo / founding code → Pro gates unlock *(not evidenced)*
- [ ] Optional: Apple Health sync (ENG-874 matrix) *(not evidenced)*

**FAIL / follow-up from screenshots:** Library tab/recipes (F-171); plan redesign cohesion (F-158–F-160, F-177–F-179); design-system drift (rings, buttons, spacing).

Record remaining pass/fail in ENG-874.

## Engineering priority read (2026-06-12)

Grace-only Gate A items (Gate0 5/5, ENG-859, ENG-670, TF screenshot triage) stay above engineering — not reordered here.

| Rank | Item | Rationale |
|------|------|-----------|
| 1 | **ENG-877** Search golden battery | Food search is the primary log path; regressions block comped-user onboarding. |
| 2 | **#8** Deep-link dismisses Log sheet | Launch-queue UX bug — sheet can stay open across tab/deep-link nav. |
| 3 | **ENG-840** Flag-force in bundled apps | TestFlight cannot QA flag-gated surfaces (`editable_eaten_at`, etc.) without bundle-safe overrides. |
| 4 | **ENG-874** Health sync (engineering tail) | Device matrix needs Grace; code/docs fixes for sync failures can proceed in parallel. |
| 5 | **ENG-772** visual parity sign-off | Shipped on `main`; confirm edit-meal / food-search time UI on web + iOS with flag on. |

## Before adding Urgent to Todo

- [ ] Blocks **first comped user**? → `launch-blocker` + Todo
- [ ] Blocks **first payment** only? → `paid-ga-blocker`, Backlog or Gate B Todo (max 3–5)
- [ ] Polish / architecture / category-leading? → Backlog
- [ ] Already shipped? → Done + commit link

## ENG-567 premium program

Through **25 Jun 2026:** Gate A only. P5 web redesign + architecture extractions are **Backlog**, not launch queue.
