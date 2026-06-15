# Launch queue — 2026-07-01 free founding cohort

**Updated:** 2026-06-15  
**Canonical Linear filters:** `docs/planning/linear-views-launch-2026-07-01.md`  
**Monetisation gates:** `docs/ux/research/2026-06-11-launch-monetisation-sequencing.md`  
**Full backlog order:** `docs/planning/2026-06-14-backlog-priority-order.md`

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
| ENG-1103, ENG-1106, ENG-1108 | Gate 0 migrations + RPC — **`6f2eebe1`** · **applied on prod** (2026-06-15) |
| ENG-771, 932, 973, 931 | MFP logging loop — loud barcode + paywall chip + quick-log (branch) |
| ENG-1109, 1111, 1177, 1179, 1112, 670 | Gate 1 code: contrast, measured TDEE, meal slots, StoreKit harness, VOC refresh, reel audit scripts (branch) |

**Live verify:** `npm run verify:gate0:live` → **8/8** (needs `GATE0_VERIFY_PASSWORD` in `.env.local` for throwaway account). Last prod pass: 2026-06-15.

## Gate A — Todo queue (order)

| # | Issue / task | Owner |
|---|----------------|-------|
| 1 | Gate0 live **8/8** on prod | Done (2026-06-15) |
| 2 | **ENG-859** DMCA designated agent | G — `docs/operations/eng-859-dmca-filing-checklist.md` |
| 3 | TestFlight **1.0.7 (57)** smoke — checklist `docs/testing/testflight-build-57-smoke-checklist.md` | G |
| 4 | **ENG-874** Apple Health device matrix (In Progress) | G + E |
| 5 | **ENG-1099** Today tracker tier (In Progress — M1–M3 on branch) | E |
| 6 | ~~Gate 0 remainder — 1104, 1105, 1107, 1110, 1102~~ | Done |
| 7 | ~~Logging loop tail — **ENG-931, 932, 973**~~ | Done on branch (ENG-771) |
| 8 | **ENG-670** Reel parse-rate gate — harness done; **Grace:** 100 URLs + 3 green days | G |

*Previously shipped (still on list for traceability): ENG-1059 (`94c90fcc`), ENG-772 (`editable_eaten_at`), deep-link Log sheet dismiss (PR #389 + #391).*

## Gate A — In Progress (keep)

- **ENG-874** — Health sync device proof
- **ENG-1099** — Today tracker tier (M1–M3 on branch; finish + close in Linear)
- ~~**ENG-877**~~ — Search golden battery — **SHIPPED** [PR #392](https://github.com/gracehowse/Suppr/pull/392); UK retailer provider-recall gaps tracked in issue comment
- ~~**ENG-840**~~ — Flag-force in bundled apps — **SHIPPED** (runtime `?__force_flags` web + DevFlagOverrides mobile)

## Gate B — `paid-ga-blocker` (parallel track)

| Issue | Note |
|-------|------|
| ENG-3 | Enrol SBP **before first paid iOS sub** (not before free cohort) |
| ENG-33 | Stripe Tax — Blocked, Grace |
| ENG-101 | RevenueCat IAP — Blocked, Grace |
| ENG-198 | RC offerings — Todo, Grace |
| ~~ENG-667~~ | **Done** — EUR SKU + region-aware checkout (`26933dda`) |
| ~~ENG-123~~ | **Done** — Base→Free migration script (`26933dda`; run on prod when ready) |
| ~~ENG-49~~ | **Done** (webhook floor half) — `lifetime_pro` never downgraded by Stripe (`26933dda`); creator lifetime comps still future |

Founding cohort comp: `lifetime_pro` via `redeem_promo_code` (ENG-1043) — **not** RC offer codes.

## TestFlight 57 smoke checklist (Grace, physical iPhone)

Use **TestFlight build 57** (1.0.7), not Expo dev client / tunnel.

**2026-06-12 ASC pull (`npm run testflight:feedback`):** success — `feedback-2026-06-12.json`. Build **57** is `VALID` in ASC; **22** screenshot threads on 2026-06-12 (F-158..F-179 in `tracker.md`). ASC API omits per-thread `buildVersion`; session timing + Grace's TF submit ⇒ build **57** smoke. **0** new crash threads. Signed screenshot URLs expire ~2026-06-18 — re-fetch if needed.

- [ ] Cold open Today — no crash *(no crash report in ASC; not device-proven)*
- [x] Log food via search — **partial PASS → ENG-1062** *(F-161/F-162: merged [PR #390](https://github.com/gracehowse/Suppr/pull/390); preview surfaces scaled OFF/FatSecret micros beyond fibre/sugar/sodium; TF58 verify)*
- [ ] Import shared Reel URL → library save *(not evidenced in TF comments)*
- [ ] Plan → generate shopping list *(plan surfaces exercised; shopping list not mentioned)*
- [ ] Redeem test promo / founding code → Pro gates unlock *(not evidenced)*
- [ ] Optional: Apple Health sync (ENG-874 matrix) *(not evidenced)*

**2026-06-12 evening:** [#397](https://github.com/gracehowse/Suppr/pull/397) merged — full nutrient panel sort (deficiencies first); audit P2 #9 closed.

**FAIL / follow-up from screenshots:** Library tab/recipes (F-171); plan redesign cohesion (F-158–F-160, F-177–F-179); design-system drift (rings, buttons, spacing).

Record remaining pass/fail in ENG-874.

## Engineering priority read (2026-06-12)

Grace-only Gate A items (Gate0 5/5, ENG-859, ENG-670, TF screenshot triage) stay above engineering — not reordered here.

| Rank | Item | Rationale |
|------|------|-----------|
| 1 | ~~**ENG-877** Search golden battery~~ | **SHIPPED** PR #392; provider-recall gaps (Tesco/Sainsbury) in issue comment. |
| 2 | ~~**#8** Deep-link dismisses Log sheet~~ | **SHIPPED** PR #389 + #391. |
| 3 | ~~**ENG-840** Flag-force in bundled apps~~ | **SHIPPED** — runtime `?__force_flags` web + DevFlagOverrides mobile. |
| 4 | **ENG-874** Health sync (engineering tail) | Device matrix needs Grace; code/docs fixes for sync failures can proceed in parallel. |
| 5 | ~~**ENG-772** visual parity sign-off~~ | **DONE** — iOS sim **PASS** 2026-06-12 (PR #396 `suppr:///dev/edit-meal-states` + Maestro `eng_772_editable_eaten_at.yaml`); web **PASS** 2026-06-12 (`/today?__force_flags=editable_eaten_at&openLog=1` → food-search preview `Time eaten` + `input[type=time]` at desktop 1440px + mobile-web 390px); web edit-meal modal **N/A** (mobile-only); live TestFlight flag path still ENG-840 |

## Before adding Urgent to Todo

- [ ] Blocks **first comped user**? → `launch-blocker` + Todo
- [ ] Blocks **first payment** only? → `paid-ga-blocker`, Backlog or Gate B Todo (max 3–5)
- [ ] Polish / architecture / category-leading? → Backlog
- [ ] Already shipped? → Done + commit link

## ENG-567 premium program

Through **25 Jun 2026:** Gate A only. P5 web redesign + architecture extractions are **Backlog**, not launch queue.
