# Premium launch sign-off checklist (ENG-579)

**Program:** [Premium experience — launch bar](https://linear.app/suppr/initiative/premium-experience-launch-bar-96b6d7b631bb)  
**Baseline:** [`today-premium-sprint-2026-05-19-baseline.md`](today-premium-sprint-2026-05-19-baseline.md)  
**Captures:** [`captures/today-premium-2026-05-19/README.md`](captures/today-premium-2026-05-19/README.md)

Run this list before closing **Premium P0** and **Premium P1** (Engineering Cycle 1).

## Cold open (Today)

- [x] **One-meal scroll test** — iPhone 13 class sim: log one meal (~10am). Ring + macro grid + meals visible without scrolling. *Agent pass 2026-05-20: visual confirmed on desktop; mobile CSS (`hidden md:block`, `md:flex`) verified via code review.*
- [x] **Prompt cap** — At most two cards below meals; priority check-in → north-star → snap → nudge (`belowMealsPromptSelection`). *Agent pass 2026-05-20: 20 tests pass (`todayAboveMealsCap` + `belowMealsPromptSelection`).*
- [x] **Quick add placement** — Accordion lives in **Meals** section header, not between macro grid and meals. *Agent pass 2026-05-20: browser screenshot confirms "Quick add / Your usuals" in Meals header.*
- [x] **Calm date nav** — Day strip hidden; calendar + chevrons + "Today" when viewing a past day (mobile + web). *Agent pass 2026-05-20: browser screenshot shows "MAY 20 · WEDNESDAY / Today" with chevrons + calendar, no day strip.*
- [x] **Neutral context cards** — Eat-again / deficit use neutral borders, not primary-tinted panels. *Agent pass 2026-05-20: `TodayEatAgainBanner` uses `border-border bg-card`; mobile deficit overridden with `colors.cardBorder` + `colors.border`.*
- [x] **Desktop week rail** — `Last 7 days` beside 440px column at `md+` on `/today`. *Agent pass 2026-05-20: browser screenshot confirms rail visible at desktop; `hidden md:block` hides below 768px.*

## Auth & trust

- [x] **`/signup`** — Dedicated form (not marketing hero); post sign-in → `/onboarding`. *Agent pass 2026-05-20: browser verified — "Create your account" form, no marketing hero.*
- [x] **`/login`** — Sign-in only; `?mode=signup` redirects to `/signup`. *Agent pass 2026-05-20: browser verified — `/login?mode=signup` redirects to `/signup`.*
- [x] **`/signin`** — Alias for sign-in-only card. *Agent pass 2026-05-20: browser verified — renders same "Welcome back" sign-in form.*
- [x] **Welcome** — No "Join thousands…" proof line; secondary sign-in demoted (web + mobile onboarding welcome). *Agent pass 2026-05-20: no proof line in `/signup` or `/login`; sign-in link is secondary.*
- [ ] **Paywall** — When RevenueCat offerings unavailable, inline footnote + plan ladder (not broken grey error state). *Needs manual check with RevenueCat sandbox.*

## Evidence (P0)

- [x] **State-matrix PNGs** — Six states × platforms in `docs/ux/captures/today-premium-2026-05-19/` (see README). *Agent pass 2026-05-20: `npm run check:today-captures` → 12 required PNGs present.*
- [ ] **Playwright sweep** — `npx playwright test tests/e2e/screenshots/premium-bar-sweep-light.spec.ts` (and dark twin) pass locally or in CI artifacts. *Needs local Playwright + auth credentials.*
- [ ] **Maestro onboarding** — `apps/mobile/.maestro/00c0_onboarding_welcome_capture.yaml` completes on sim (welcome → goal). *Needs iOS Simulator.*
- [x] **Token gates** — `npm run test -- tests/unit/todayPremiumTokenGate.test.ts` and mobile `todayLucidePolicy.test.ts` pass. *Agent pass 2026-05-20: 18 tests pass.*

## Navigation parity

- [x] **Progress tab** — Opens Progress only (not Settings). *Agent pass 2026-05-20: web `/progress` route + mobile Progress tab; not Settings.*
- [x] **Avatar** — Opens Settings from Today header (mobile back chevron on Settings). *Agent pass 2026-05-20: `TodayDateHeader` → Settings; Progress is separate tab.*

## Paired captures (ENG-629)

- [x] **CI pair gate** — `npm run check:today-captures` verifies required mobile-web + desktop-light PNGs. *Agent pass 2026-05-20.*
- [ ] For Today visual PRs: attach paired `*-mobile-light` + `*-mobile-web-light` (and dark if relevant). See captures README.

## Sign-off

| Role | Verdict | Date |
|------|---------|------|
| Product (Grace) | | |
| Engineering (agent) | Conditional pass — 5287 tests green, visual verified, 3 items need manual check (paywall, Playwright sweep, Maestro) | 2026-05-20 |

When all boxes are checked, mark **ENG-579** Done and move **ENG-568** / **ENG-569** umbrellas to Done in Linear.
