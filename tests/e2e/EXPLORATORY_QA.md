# Exploratory QA (human)

Automation covers breadth, regressions, and many accessibility issues. It does **not** replace judgment on flow, copy, and polish. Use this charter for a short pass before release.

## Timebox

30–60 minutes per release (or after large UI changes).

## Charter: first-time → core loop

1. Open the app signed out: confirm `/` sends you to login; legal links from login work if present.
2. Sign up or sign in (or use a test account): complete or skip onboarding as your scenario requires.
3. **Discover**: scroll feed, open a recipe, go back; try search or filters if visible.
4. **Library**: confirm saved recipes appear; open one.
5. **Tracker**: add a meal (recipe or search path), confirm day totals update.
6. **Planner** (if paid / applicable): generate or view plan; note any empty states.
7. **Shopping**: add or generate items if your tier allows.
8. **Settings / Profile**: change one preference or target, save; open Privacy policy and Terms from Settings.

While doing this, note **confusing**, **broken**, or **delightful** moments in your tracker (no fixed template).

## Release checklist (sign-off)

Use as a quick human gate; check when verified for this release.

- [ ] Auth: sign in, sign out, password reset page loads (`/reset-password`).
- [ ] Onboarding: new user can finish without dead ends.
- [ ] Core views load: Discover, Library, Tracker, Settings (match `/?view=` matrix in Playwright).
- [ ] Legal: `/privacy`, `/terms` readable and linked from product where expected.
- [ ] Mobile width: primary shell usable at ~390px (see Playwright “Unauthenticated app shell” project).
- [ ] Payments / tier upsell: if you ship billing changes, smoke the upgrade path you care about.

## Automation pointers

- Logged-in matrix: `tests/e2e/journeys/authenticated-views.spec.ts` (needs `E2E_EMAIL` / `E2E_PASSWORD`).
- Public journeys + axe: `tests/e2e/journeys/auth-and-public.spec.ts`.
- Midscene (optional): `npm run test:e2e:ai` with model env + same E2E credentials.
