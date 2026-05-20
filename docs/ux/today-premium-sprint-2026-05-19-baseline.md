# Today premium sprint — baseline (2026-05-19)

**Authority:** Plan "Today premium — plan of attack" (paired mobile + web).

## Prototype reference

- HTML: `docs/ux/claude-design-bundles/prototype/project/Suppr Prototype.html`
- Mobile Today: `screens-mobile.jsx` → `TodayScreen`
- Intent chat: `docs/ux/claude-design-bundles/prototype/chats/`

## State matrix (sim capture — Grace)

Capture in iOS sim + mobile-web (390×844), dark + light into `docs/ux/captures/today-premium-2026-05-19/`:

1. Empty day, brand-new
2. One meal logged (~10am)
3. Active fast
4. Eat-again
5. Deficit insight
6. Over-budget day

## Code changes shipped

- Above meals: date → hero → one context (fasting active / eat-again / deficit) → macro grid only.
- Below meals: north-star, weekly check-in, onboarding nudge, snap shortcut, first-meal empty (max 2 via `belowMealsPromptSelection`).
- Quick add: accordion inside **Meals** section header (not between macro grid and meals).
- Calm date header: calendar button + tappable date title when day strip hidden; “Today” when viewing a past day.
- Desktop (`lg+`): **Last 7 days** week rail beside the 440px Today column (`TodayWeekSidebar`).
- Idle "Start fast" removed from context slot (Fasting screen only).
- Macro tiles: quieter nutrients link, icon-only tile header (no chevron).
- Eat-again + deficit context: neutral `cardBorder` / `border` surfaces; eat-again eyebrow muted (primary reserved for Log CTA).
- Sim captures: drop PNGs in [`docs/ux/captures/today-premium-2026-05-19/`](captures/today-premium-2026-05-19/) per README (Grace sign-off).

## Navigation (same release branch)

- **Progress** is a dedicated bottom-tab destination (mobile + mobile-web + desktop sidebar label).
- **Settings** opens from the Today header avatar (not a Progress sub-tab). Mobile: back chevron on Settings.

## Prototype HTML

- First-render reference: `docs/audits/2026-05-15-premium-sweep-v2/prototypes/mobile/P0/today-first-render.html`

## Regression pins

- `apps/mobile/tests/unit/todayAboveMealsCap.test.ts` (17 tests)
- `tests/unit/todayAboveMealsCap.test.ts` (web)
- `tests/unit/todayDateHeaderSettingsEntry.test.ts` (web avatar → settings)

## Sign-off checklist (Grace)

Executable copy: [`premium-launch-sign-off-checklist.md`](premium-launch-sign-off-checklist.md) (ENG-579).

- [x] No prompts between macro grid and meals; quick add lives in Meals header (code + unit tests)
- [x] Past-day navigation: calendar + chevrons + “Today” jump (strip hidden) — browser pass 2026-05-20 on `/today`
- [x] Eat-again / deficit cards use neutral chrome (not primary-tinted panels)
- [x] Desktop week rail (`Last 7 days`) beside 440px column at `md+` — browser pass 2026-05-20
- [x] Auth: `/signup`, `/login` → `/signup`, `/signin` sign-in-only (see `tests/unit/authRoutesPremium.test.ts`)
- [x] Paywall soft-fail when RC unavailable (mobile `paywall.tsx`)
- [ ] Cold-open: one meal logged → ring + macros + meals visible without scroll (iPhone 13 class) — **Grace sim**
- [ ] Progress tab opens Progress only; avatar opens Settings — **Grace sim**
- [ ] State-matrix PNGs in `docs/ux/captures/today-premium-2026-05-19/`
