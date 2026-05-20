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
| `docs/ux/teardown-2026-04-28-daily-loop.md` | Editorial discipline (≤4 blocks above meals) |
| `docs/decisions/2026-05-14-premium-audit-sweep-retro.md` | Subtractive-first; sim validation |
| `docs/planning/premium-bar-systematic-followups-2026-05-12.md` | May audit checklist (mostly shipped) |

## Process rules

1. **Subtractive-first** — no additive flourishes without sim proof  
2. **Visual validation** — fill `docs/ux/captures/today-premium-2026-05-19/` before visual PRs ship  
3. **Flag structural changes** — PostHog until Grace signs captures  

## Phase projects

| Project | Target | Umbrella | Focus |
|---------|--------|----------|--------|
| [Premium P0 — Evidence & enforcement](https://linear.app/suppr/project/premium-p0-evidence-and-enforcement-18741f53e7ec) | 2026-06-02 | [ENG-568](https://linear.app/suppr/issue/ENG-568) | Captures, CI, token/lint gates |
| [Premium P1 — Cold open & trust](https://linear.app/suppr/project/premium-p1-cold-open-and-trust-9fbddca567bb) | 2026-06-16 | [ENG-569](https://linear.app/suppr/issue/ENG-569) | Today header, below-meals cap, auth/paywall |
| [Premium P2 — Daily loop excellence](https://linear.app/suppr/project/premium-p2-daily-loop-excellence-71e9fa0f010b) | 2026-06-30 | [ENG-570](https://linear.app/suppr/issue/ENG-570) | Log sheet, meals, north-star, motion |
| [Premium P3 — Food & plan surfaces](https://linear.app/suppr/project/premium-p3-food-and-plan-surfaces-b059031ea76b) | 2026-07-01 | [ENG-571](https://linear.app/suppr/issue/ENG-571) | Discover, cook, import, plan, web routes |
| [Premium P4 — Progress, settings & membership](https://linear.app/suppr/project/premium-p4-progress-settings-and-membership-2dedeb10da86) | 2026-07-01 | [ENG-572](https://linear.app/suppr/issue/ENG-572) | Settings DC14, Progress hero, paywall dark |
| [Premium P5 — Architecture enablers](https://linear.app/suppr/project/premium-p5-architecture-enablers-de2d5a11d2a3) | 2026-07-15 | [ENG-573](https://linear.app/suppr/issue/ENG-573) | `useToday`, `nutrition-core`, App Router (also [Platform foundations](https://linear.app/suppr/initiative/platform-foundations)) |

## Issue map (ENG-567 → ENG-622)

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

## First cycle scope (P0 + P1)

1. ~~Triage legacy audit (ENG-203)~~ — **Done** ([ENG-574](https://linear.app/suppr/issue/ENG-574))  
2. State-matrix captures ([ENG-575](https://linear.app/suppr/issue/ENG-575))  
3. Today header subtract + below-meals cap ([ENG-584](https://linear.app/suppr/issue/ENG-584), [ENG-585](https://linear.app/suppr/issue/ENG-585))  
4. Auth signup/onboarding/login bundle ([ENG-586](https://linear.app/suppr/issue/ENG-586))  
5. Paywall soft-fail ([ENG-588](https://linear.app/suppr/issue/ENG-588))  

Everything else stays **Backlog** in phase projects until P0 sign-off.

## Cycle assignment (Engineering)

Linear currently has **two** scheduled cycles; all program issues (ENG-567 → ENG-622) are assigned — none sit outside a cycle.

| Cycle | Dates | Issues |
|-------|--------|--------|
| **Cycle 1** (current) | 18 May → 1 Jun 2026 | **P0 + P1** — ENG-567–583, ENG-569, ENG-584–599 |
| **Cycle 2** (next) | 15 Jun → 29 Jun 2026 | **P2 + P3 + P4 + P5** — ENG-570–573, ENG-600–622 |

**Intended split once Cycles 3–5 exist:** P2 → Cycle 2; P3 → Cycle 3 (Jul 1 target); P4 → Cycle 4 (Jul 1); P5 → Cycle 5 (Jul 15). Re-assign P3–P5 when those cycles are created in Linear team settings.
