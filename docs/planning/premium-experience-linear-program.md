# Premium experience — Linear program

**Initiative:** [Premium experience — launch bar](https://linear.app/suppr/initiative/premium-experience-launch-bar-96b6d7b631bb) (`30550be5-85e6-461d-a062-4cf79f37f6a7`)  
**Aligned with:** [Launch 2026-07-01](https://linear.app/suppr/initiative/launch-2026-07-01-c1ef54a1a247)

**Duplicate initiative (ignore):** A second initiative with the same name was created when the first `save_initiative` failed (Enterprise sub-initiative). It is marked **Completed** and unlinked from all phase projects: `d4966476-59bd-4f55-a3e3-b26a684a704a` ([old URL](https://linear.app/suppr/initiative/premium-experience-launch-bar-55c0fb315d93)).  
**Program coordination:** [ENG-567](https://linear.app/suppr/issue/ENG-567/premium-launch-bar-program-coordination)

Replaces checklist-driven [ENG-203](https://linear.app/suppr/issue/ENG-203) / [Premium bar audit (2026-05-12)](https://linear.app/suppr/project/premium-bar-audit-2026-05-12-590c209f5acb) for **active** tracking. Historical audit issues and PR links (`Fixes ENG-xxx`) are preserved.

Tab polish (Today tab, Recipes, Onboarding + Auth, etc.) stays under [Surface polish](https://linear.app/suppr/initiative/surface-polish-03a1613c2077). New work lives in **phase projects** below; link tab issues via `relatedTo`, not dual project membership.

## Repo anchors

| Doc | Role |
|-----|------|
| `docs/ux/today-premium-sprint-2026-05-19-baseline.md` | Sprint baseline + sign-off checklist |
| `docs/ux/captures/today-premium-2026-05-19/README.md` | State-matrix capture instructions |
| `docs/ux/color-direction-noom-lifesum-2026-05.md` | Noom/Lifesum palette |
| `docs/ux/brand-tokens.md` | Canonical hex (sync via ENG-631) |
| `docs/product/web-mobile-parity-scope.md` | Parity policy (Today colour → ENG-639) |
| `docs/ux/teardown-2026-04-28-daily-loop.md` | Editorial discipline (≤4 blocks above meals) |
| `docs/decisions/2026-05-14-premium-audit-sweep-retro.md` | Subtractive-first; sim validation |
| `docs/planning/premium-bar-systematic-followups-2026-05-12.md` | May audit checklist (mostly shipped) |

## Process rules

1. **Subtractive-first** — no additive flourishes without sim proof  
2. **Visual validation** — fill `docs/ux/captures/today-premium-2026-05-19/` before visual PRs ship  
2b. **Automated captures** — regenerate matrix from `scripts/e2e-seed-today-premium-matrix.ts` + Playwright/Maestro; do not rely on ad-hoc sim shots ([ENG-628](https://linear.app/suppr/issue/ENG-628))  
3. **Flag structural changes** — PostHog until Grace signs captures  
4. **Colour parity** — Today macro hues and surfaces must match web ↔ mobile at a glance ([ENG-623](https://linear.app/suppr/issue/ENG-623)–625, [ENG-639](https://linear.app/suppr/issue/ENG-639)); paired captures required on visual PRs ([ENG-629](https://linear.app/suppr/issue/ENG-629))  

## Phase projects

| Project | Target | Umbrella | Focus |
|---------|--------|----------|--------|
| [Premium P0 — Evidence & enforcement](https://linear.app/suppr/project/premium-p0-evidence-and-enforcement-18741f53e7ec) | 2026-06-02 | [ENG-568](https://linear.app/suppr/issue/ENG-568) | Captures, CI, token/lint gates |
| [Premium P1 — Cold open & trust](https://linear.app/suppr/project/premium-p1-cold-open-and-trust-9fbddca567bb) | 2026-06-16 | [ENG-569](https://linear.app/suppr/issue/ENG-569) | Today header, below-meals cap, auth/paywall |
| [Premium P2 — Daily loop excellence](https://linear.app/suppr/project/premium-p2-daily-loop-excellence-71e9fa0f010b) | 2026-06-30 | [ENG-570](https://linear.app/suppr/issue/ENG-570) | Log sheet, meals, north-star, motion |
| [Premium P3 — Food & plan surfaces](https://linear.app/suppr/project/premium-p3-food-and-plan-surfaces-b059031ea76b) | 2026-07-01 | [ENG-571](https://linear.app/suppr/issue/ENG-571) | Discover, cook, import, plan, web routes |
| [Premium P4 — Progress, settings & membership](https://linear.app/suppr/project/premium-p4-progress-settings-and-membership-2dedeb10da86) | 2026-07-01 | [ENG-572](https://linear.app/suppr/issue/ENG-572) | Settings DC14, Progress hero, paywall dark |
| [Premium P5 — Architecture enablers](https://linear.app/suppr/project/premium-p5-architecture-enablers-de2d5a11d2a3) | 2026-07-15 | [ENG-573](https://linear.app/suppr/issue/ENG-573) | `useToday`, `nutrition-core`, App Router (also [Platform foundations](https://linear.app/suppr/initiative/platform-foundations)) |

## Issue map (ENG-567 → ENG-645)

### P0 — Evidence & enforcement ([ENG-568](https://linear.app/suppr/issue/ENG-568))

| Issue | Notes |
|-------|--------|
| [ENG-574](https://linear.app/suppr/issue/ENG-574) | Triage legacy ENG-203 (**Done** 2026-05-20) |
| [ENG-575](https://linear.app/suppr/issue/ENG-575) | Today state-matrix captures |
| → [ENG-582](https://linear.app/suppr/issue/ENG-582), [ENG-580](https://linear.app/suppr/issue/ENG-580), [ENG-581](https://linear.app/suppr/issue/ENG-581) | Mobile sim / mobile-web / web desktop |
| [ENG-576](https://linear.app/suppr/issue/ENG-576) | Playwright premium-bar sweep CI |
| [ENG-577](https://linear.app/suppr/issue/ENG-577) | Maestro onboarding capture (replaces ENG-416) |
| [ENG-578](https://linear.app/suppr/issue/ENG-578) | Design token enforcement |
| → [ENG-583](https://linear.app/suppr/issue/ENG-583) | Lucide-only policy |
| [ENG-579](https://linear.app/suppr/issue/ENG-579) | Premium launch sign-off checklist |

### P1 — Cold open & trust ([ENG-569](https://linear.app/suppr/issue/ENG-569))

| Issue | Notes |
|-------|--------|
| [ENG-584](https://linear.app/suppr/issue/ENG-584) | Today header subtract chrome |
| → [ENG-591](https://linear.app/suppr/issue/ENG-591), [ENG-592](https://linear.app/suppr/issue/ENG-592) | Mobile / web |
| [ENG-585](https://linear.app/suppr/issue/ENG-585) | Below-meals prompt cap (max 2) |
| → [ENG-594](https://linear.app/suppr/issue/ENG-594), [ENG-596](https://linear.app/suppr/issue/ENG-596) | Quick-add move / priority order |
| [ENG-587](https://linear.app/suppr/issue/ENG-587) | Hero ring polish (keep DC1) |
| → [ENG-593](https://linear.app/suppr/issue/ENG-593) | Haptic + first-log fill |
| [ENG-586](https://linear.app/suppr/issue/ENG-586) | Auth cold-open bundle |
| → [ENG-595](https://linear.app/suppr/issue/ENG-595)–[ENG-599](https://linear.app/suppr/issue/ENG-599) | Signup, onboarding, login, mark |
| [ENG-588](https://linear.app/suppr/issue/ENG-588) | Paywall soft-fail (relates ENG-101, ENG-486) |
| [ENG-589](https://linear.app/suppr/issue/ENG-589) | Welcome subtractive pass |
| [ENG-590](https://linear.app/suppr/issue/ENG-590) | Desktop Today week sidebar — `lg` flex rail in `NutritionTracker` (relates ENG-74) |
| [ENG-595](https://linear.app/suppr/issue/ENG-595) | `/signup` dedicated form + post-sign-in → `/onboarding` |

### P2 — Daily loop ([ENG-570](https://linear.app/suppr/issue/ENG-570))

| Issue | Notes |
|-------|--------|
| [ENG-600](https://linear.app/suppr/issue/ENG-600) | Log sheet search-first |
| → [ENG-609](https://linear.app/suppr/issue/ENG-609), [ENG-610](https://linear.app/suppr/issue/ENG-610) | Mobile / web |
| [ENG-601](https://linear.app/suppr/issue/ENG-601) | Meals food-forward rows |
| [ENG-602](https://linear.app/suppr/issue/ENG-602) | North-star + Eat Again editorial |
| → [ENG-612](https://linear.app/suppr/issue/ENG-612), [ENG-611](https://linear.app/suppr/issue/ENG-611) | Thumbs/titles / fit chip |
| [ENG-603](https://linear.app/suppr/issue/ENG-603) | Motion v1 (`premium_motion_v1`) |
| → [ENG-613](https://linear.app/suppr/issue/ENG-613), [ENG-614](https://linear.app/suppr/issue/ENG-614) | Reanimated / Framer |

### P3 — Food & plan ([ENG-571](https://linear.app/suppr/issue/ENG-571))

| Issue | Notes |
|-------|--------|
| [ENG-604](https://linear.app/suppr/issue/ENG-604) | Discover editorial |
| [ENG-605](https://linear.app/suppr/issue/ENG-605) | Cook mode (relates ENG-466) |
| [ENG-606](https://linear.app/suppr/issue/ENG-606) | Import verify skeleton |
| [ENG-607](https://linear.app/suppr/issue/ENG-607) | Plan + Shopping (relates ENG-384) |
| [ENG-608](https://linear.app/suppr/issue/ENG-608) | Web routes (relates ENG-374, ENG-346) |

### P4 — Progress, settings ([ENG-572](https://linear.app/suppr/issue/ENG-572))

| Issue | Notes |
|-------|--------|
| [ENG-615](https://linear.app/suppr/issue/ENG-615) | Settings DC14 tiles (replaces ENG-252) |
| [ENG-616](https://linear.app/suppr/issue/ENG-616) | Progress single hero metric |
| [ENG-617](https://linear.app/suppr/issue/ENG-617) | Paywall dark capture |
| [ENG-618](https://linear.app/suppr/issue/ENG-618) | Landing hero dark gradient (relates ENG-270) |

### P5 — Architecture ([ENG-573](https://linear.app/suppr/issue/ENG-573))

| Issue | Notes |
|-------|--------|
| [ENG-619](https://linear.app/suppr/issue/ENG-619) | Extract `useToday()` |
| [ENG-620](https://linear.app/suppr/issue/ENG-620) | `@suppr/nutrition-core` |
| [ENG-622](https://linear.app/suppr/issue/ENG-622) | App Router migration |
| [ENG-621](https://linear.app/suppr/issue/ENG-621) | 400-line rule in AGENTS.md |

### Cycle 1 gap / parity backlog (2026-05-20 audit)

Created after state-matrix captures (28 PNGs) and colour-parity audit. **Do not close** [ENG-568](https://linear.app/suppr/issue/ENG-568) / [ENG-569](https://linear.app/suppr/issue/ENG-569) until [ENG-641](https://linear.app/suppr/issue/ENG-641) / [ENG-645](https://linear.app/suppr/issue/ENG-645) checklists pass.

| Issue | Cycle | Priority | Theme |
|-------|--------|----------|--------|
| [ENG-623](https://linear.app/suppr/issue/ENG-623) | 1 | Urgent | `theme.css` ↔ `Colors` parity test (CI) |
| [ENG-624](https://linear.app/suppr/issue/ENG-624) | 1 | Urgent | Over-budget ring → amber (web + mobile) |
| [ENG-625](https://linear.app/suppr/issue/ENG-625) | 1 | Urgent | Over-budget macro captions → amber |
| [ENG-626](https://linear.app/suppr/issue/ENG-626) | 1 | Urgent | Branded boot splash + `AppLaunchScreen` (+ dev-client rebuild) |
| [ENG-627](https://linear.app/suppr/issue/ENG-627) | 1 | High | Matrix Playwright CI + stabilize auth |
| [ENG-628](https://linear.app/suppr/issue/ENG-628) | 1 | High | Capture harness docs + empty-day seed purge |
| [ENG-629](https://linear.app/suppr/issue/ENG-629) | 1 | High | Paired side-by-side capture gate for Today PRs |
| [ENG-630](https://linear.app/suppr/issue/ENG-630) | 1 | Medium | Desktop `deficit-insight` capture missing |
| [ENG-631](https://linear.app/suppr/issue/ENG-631) | 1 | Medium | Sync `brand-tokens.md` + color-direction |
| [ENG-632](https://linear.app/suppr/issue/ENG-632) | 1 | High | Milestone modal discipline on Today |
| [ENG-633](https://linear.app/suppr/issue/ENG-633) | 1 | High | Dismiss toast + cookie on mobile-web Today |
| [ENG-634](https://linear.app/suppr/issue/ENG-634) | 1 | High | Manual Progress tab vs avatar → Settings |
| [ENG-635](https://linear.app/suppr/issue/ENG-635) | 1 | Medium | Empty-day: hide quick-add usuals |
| [ENG-636](https://linear.app/suppr/issue/ENG-636) | 1 | Medium | Date header truncation at 390px |
| [ENG-637](https://linear.app/suppr/issue/ENG-637) | 1 | Medium | Dark mode: align or document intentional delta |
| [ENG-638](https://linear.app/suppr/issue/ENG-638) | 4 | Low | `TodayAtAGlance` legacy `#df7a4e` hex |
| [ENG-639](https://linear.app/suppr/issue/ENG-639) | 1 | High | `web-mobile-parity-scope.md` — Today colour enforced |
| [ENG-640](https://linear.app/suppr/issue/ENG-640) | 1 | Medium | Rescope cycles 3–5 (P3–P5 only); Cycle 2 = P2 |
| [ENG-641](https://linear.app/suppr/issue/ENG-641) | 1 | Urgent | ENG-568 umbrella close criteria |
| [ENG-642](https://linear.app/suppr/issue/ENG-642) | 1 | Medium | Verify `active-fast` capture shows fasting pill |
| [ENG-643](https://linear.app/suppr/issue/ENG-643) | 2 | Medium | Eat-again card density (P2) |
| [ENG-644](https://linear.app/suppr/issue/ENG-644) | 1 | Medium | Cycle 1 retrospective + this doc sync |
| [ENG-645](https://linear.app/suppr/issue/ENG-645) | 1 | Urgent | ENG-569 umbrella close criteria |

#### Colour parity findings (reference)

| Area | Status | Fix |
|------|--------|-----|
| Light bg / ink / macro hues | Aligned in code | Enforce via ENG-623 |
| Over-budget ring + captions | Red on both platforms | ENG-624–625 → `overBudgetFg` |
| Dark surfaces | Mobile `#0a0a0f` vs web `#101014` | ENG-637 product call |
| Docs | Dinner slot + carbs hex stale | ENG-631 |
| Charts | `#df7a4e` in `TodayAtAGlance` | ENG-638 |

#### Capture verdict (2026-05-20)

- **Shipped:** 28 PNGs under `docs/ux/captures/today-premium-2026-05-19/`
- **Gaps:** no `deficit-insight-desktop-light.png` (ENG-630); milestone modal in sim shots (ENG-632); web toast/cookie (ENG-633); paired PR gate not yet process (ENG-629)
- **Code in repo, uncommitted:** boot splash (`ENG-626`), activity-bonus migration, household/settings touch-ups — commit when ready

## Legacy triage (ENG-203)

**2026-05-20 pass:** 32 formerly-open children closed or migrated.

| Bucket | Action | Examples |
|--------|--------|----------|
| **Migrate** | `relatedTo` new epic; legacy **Canceled** | ENG-374/346 → ENG-608; ENG-74 → ENG-590; captures → ENG-575–581 |
| **Done** | Shipped in May sprint | ENG-359 (`/today`) |
| **Canceled** | Obsolete / superseded | ENG-217 (eat-again scroller), DC1 chip reverts |
| **Defer** | Out of launch scope | ENG-401, ENG-397, ENG-391, ENG-392, ENG-376, ENG-399 |
| **External** | Stay **Blocked**; relate only | ENG-486 (RevenueCat) → ENG-588 |

**ENG-203** and project **Premium bar audit (2026-05-12)** are **Completed** — do not add new work there.

## Cross-links (Surface polish tab projects)

| Tab project | Related new work |
|-------------|------------------|
| [Today tab](https://linear.app/suppr/project/today-tab-cb3c23bdf67f) | P1 header, below-meals; P2 log/meals/north-star |
| [Onboarding + Auth](https://linear.app/suppr/project/onboarding-auth-e758a0759cbd) | P1 auth bundle |
| [Recipes tab](https://linear.app/suppr/project/recipes-tab-6d4e523c0b0d) | P3 discover/cook/import |
| [Plan tab](https://linear.app/suppr/project/plan-tab-1cd29261d9ee) | P3 plan/shopping |
| [Progress tab](https://linear.app/suppr/project/progress-tab-00bde6e5dbf9) | P4 progress hero |
| [Design system cleanup](https://linear.app/suppr/project/design-system-cleanup-fccff493a723) | P0 token enforcement (coordinate) |
| [Landing + Marketing](https://linear.app/suppr/project/landing-marketing-site-a210848579fb) | P4 landing gradient |

## Cycle 1 status (wrapped 2026-05-20)

**Shipped:** P1 editorial (header, below-meals, auth, paywall, week rail), 28 state-matrix captures, over-budget amber (ENG-624–625), cross-platform token test (ENG-623), empty-day quick-add hidden until first log (ENG-635), `AppLaunchScreen` (ENG-626), boot/splash config.

**Carryover (still Cycle 1 umbrellas — do not block Cycle 2 start):**

| Issue | Why open |
|-------|----------|
| [ENG-627](https://linear.app/suppr/issue/ENG-627) | Matrix Playwright CI flake |
| [ENG-630](https://linear.app/suppr/issue/ENG-630) | Desktop deficit-insight PNG |
| [ENG-631](https://linear.app/suppr/issue/ENG-631) | Doc hex sync |
| [ENG-632](https://linear.app/suppr/issue/ENG-632)–[634](https://linear.app/suppr/issue/ENG-634) | Milestone modal, toast/cookie, manual nav |
| [ENG-637](https://linear.app/suppr/issue/ENG-637) | Dark surface parity decision |
| [ENG-629](https://linear.app/suppr/issue/ENG-629) | Paired capture PR gate (process) |
| [ENG-641](https://linear.app/suppr/issue/ENG-641) / [645](https://linear.app/suppr/issue/ENG-645) | Umbrella close checklists |

[ENG-568](https://linear.app/suppr/issue/ENG-568) / [ENG-569](https://linear.app/suppr/issue/ENG-569) stay open until carryover + checklist pass; **Cycle 2 work proceeds in parallel.**

## Cycle 2 active (started 2026-05-20)

| Issue | Status |
|-------|--------|
| [ENG-570](https://linear.app/suppr/issue/ENG-570) | In Progress (umbrella) |
| [ENG-600](https://linear.app/suppr/issue/ENG-600)–[610](https://linear.app/suppr/issue/ENG-610) | **Done** — search-first log sheet (already shipped) |
| [ENG-601](https://linear.app/suppr/issue/ENG-601) | **Done** — food-forward meal rows (`046fb22`) |
| [ENG-602](https://linear.app/suppr/issue/ENG-602) | **In Progress** — north-star + Eat Again editorial |
| → [ENG-612](https://linear.app/suppr/issue/ENG-612), [ENG-611](https://linear.app/suppr/issue/ENG-611) | Thumbs / fit chip (under 602) |
| [ENG-643](https://linear.app/suppr/issue/ENG-643) | Eat-again density (under 602) |
| ENG-603–614 | Backlog |

## First cycle scope (P0 + P1) — historical

1. ~~Triage legacy audit (ENG-203)~~ — **Done** ([ENG-574](https://linear.app/suppr/issue/ENG-574))  
2. ~~State-matrix captures~~ — **Done** ([ENG-575](https://linear.app/suppr/issue/ENG-575))  
3. ~~Today header subtract + below-meals cap~~ — **Done**  
4. ~~Auth bundle~~ — **Done**  
5. ~~Paywall soft-fail~~ — **Done**  

## Cycle assignment (Engineering)

Five two-week cycles on **Engineering** (created 2026-05-20 via `cycleCreate`; P3–P5 reassigned from Cycle 2).

| Cycle | Dates (UTC start) | Scope |
|-------|-------------------|--------|
| **Cycle 1** (current) | 18 May → 1 Jun 2026 | **P0 + P1 + gap backlog** — ENG-567–583, ENG-584–599, **ENG-623–642, ENG-639–641, ENG-644–645**, [ENG-640](https://linear.app/suppr/issue/ENG-640) |
| **Cycle 2** (next) | 15 Jun → 29 Jun 2026 | **P2 only** — [ENG-570](https://linear.app/suppr/issue/ENG-570), ENG-600–614, ENG-643 |
| **Cycle 3** | 29 Jun → 13 Jul 2026 | **P3** — [ENG-571](https://linear.app/suppr/issue/ENG-571), ENG-604–608 (Jul 1 phase target) |
| **Cycle 4** | 13 Jul → 27 Jul 2026 | **P4** — [ENG-572](https://linear.app/suppr/issue/ENG-572), ENG-615–618, ENG-638 |
| **Cycle 5** | 27 Jul → 10 Aug 2026 | **P5** — [ENG-573](https://linear.app/suppr/issue/ENG-573), ENG-619–622 (Jul 15 phase target) |

**Note:** Linear MCP has `list_cycles` only — use GraphQL `cycleCreate` to add future cycles (same team id `e72181eb-19be-40ab-96e6-36230cc8352e`).
