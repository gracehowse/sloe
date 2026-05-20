# Premium launch sign-off checklist (ENG-579)

**Program:** [Premium experience — launch bar](https://linear.app/suppr/initiative/premium-experience-launch-bar-96b6d7b631bb)  
**Baseline:** [`today-premium-sprint-2026-05-19-baseline.md`](today-premium-sprint-2026-05-19-baseline.md)  
**Captures:** [`captures/today-premium-2026-05-19/README.md`](captures/today-premium-2026-05-19/README.md)

Run this list before closing **Premium P0** and **Premium P1** (Engineering Cycle 1).

## Cold open (Today)

- [ ] **One-meal scroll test** — iPhone 13 class sim: log one meal (~10am). Ring + macro grid + meals visible without scrolling.
- [ ] **Prompt cap** — At most two cards below meals; priority check-in → north-star → snap → nudge (`belowMealsPromptSelection`).
- [ ] **Quick add placement** — Accordion lives in **Meals** section header, not between macro grid and meals.
- [ ] **Calm date nav** — Day strip hidden; calendar + chevrons + “Today” when viewing a past day (mobile + web).
- [ ] **Neutral context cards** — Eat-again / deficit use neutral borders, not primary-tinted panels.
- [ ] **Desktop week rail** — `Last 7 days` beside 440px column at `md+` on `/today`.

## Auth & trust

- [ ] **`/signup`** — Dedicated form (not marketing hero); post sign-in → `/onboarding`.
- [ ] **`/login`** — Sign-in only; `?mode=signup` redirects to `/signup`.
- [ ] **`/signin`** — Alias for sign-in-only card.
- [ ] **Welcome** — No “Join thousands…” proof line; secondary sign-in demoted (web + mobile onboarding welcome).
- [ ] **Paywall** — When RevenueCat offerings unavailable, inline footnote + plan ladder (not broken grey error state).

## Evidence (P0)

- [ ] **State-matrix PNGs** — Six states × platforms in `docs/ux/captures/today-premium-2026-05-19/` (see README).
- [ ] **Playwright sweep** — `npx playwright test tests/e2e/screenshots/premium-bar-sweep-light.spec.ts` (and dark twin) pass locally or in CI artifacts.
- [ ] **Maestro onboarding** — `apps/mobile/.maestro/00c0_onboarding_welcome_capture.yaml` completes on sim (welcome → goal).
- [ ] **Token gates** — `npm run test -- tests/unit/todayPremiumTokenGate.test.ts` and mobile `todayLucidePolicy.test.ts` pass.

## Navigation parity

- [ ] **Progress tab** — Opens Progress only (not Settings).
- [ ] **Avatar** — Opens Settings from Today header (mobile back chevron on Settings).

## Sign-off

| Role | Verdict | Date |
|------|---------|------|
| Product (Grace) | | |
| Engineering | | |

When all boxes are checked, mark **ENG-579** Done and move **ENG-568** / **ENG-569** umbrellas to Done in Linear.
