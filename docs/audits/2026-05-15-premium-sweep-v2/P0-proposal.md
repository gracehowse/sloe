# P0 proposal table — cold-open surfaces

**Status:** **G3 APPROVED 2026-05-14** ("ok" — proceeding with default on row 8.1 = option (b) make `/onboarding` render actual flow; flagged for explicit sign-off before new-build kicks off)
**Bucket size:** 25 surfaces audited; 18 actionable implementation rows + 8 capture/verification rows
**Capture set:** `docs/audits/2026-05-15-premium-sweep-v2/captures/P0/`
**Auditor report:** `docs/audits/2026-05-15-premium-sweep-v2/P0-auditor-report.md`

---

## In-flight tripwire

- Items in this bucket: **18 actionable** (+ 8 capture-work)
- Reverts so far: **0 / 2**
- On 2nd revert: bucket pauses; mini-retro required at
  `docs/audits/2026-05-15-premium-sweep-v2/P0-tripwire-retro.md`,
  and Grace must approve resuming before any further row touches code.

---

## Refuse-to-pass (must clear before bucket close)

| RTP | Surface | Cause | Resolving row(s) |
|---|---|---|---|
| **RTP-1** | web `/signup` | renders the landing page, not a signup form | #7.1 + #7.2 |
| **RTP-2** | web `/onboarding` entry | renders the landing, not the Welcome step | #8.1 + #8.3 |
| **RTP-3** | mobile paywall "Subscriptions unavailable" card | competes with trust chips; reads as failed-load | #13.1 |
| **RTP-4** | web `/home` unauthed | redirects to `/login` (forced login wall) | #9.2 |
| **RTP-5** | `/login` + `/signin` duplicates | three URLs render the same card | #5.3 + #5.4 + #6.1 |
| **RTP-6** | mobile onboarding capture flow | Maestro never advances past Welcome | capture-fix (CF-1) |
| **RTP-7** | mobile paywall dark capture | missing | capture-fix (CF-2) |
| **RTP-8** | route name `/onboarding` | misleading if marketing handoff | #8.1 |
| **RTP-9** | web pricing inline "inc. VAT" | not in first viewport (DC15 risk) | #3.2 + #4.2 |
| **RTP-10** | web `/login` dark hero icon | stock-app-icon placeholder | #5.1 |

---

## Proposal table

`Item type`: SUBTRACT / TIGHTEN / REPLACE / NEW
`Complexity`: cleanup (<1h) / refactor (1-4h) / new build (>4h) / design-needed
`Status` lifecycle: proposed → approved → in-progress → implemented → prototype-validated → sim-validated → `[x]` (or → rejected / reverted)

### Web surface rows

| # | Surface | Item type | What changes | What it duplicates / weakens | Before pixel | Affected platforms | DC# touched | Auditor verdict | Complexity | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 1.1 | `app/(landing)/LandingPage.tsx` (top-bar wordmark) | TIGHTEN | Hairline-thicken the Suppr wordmark to match Linear's brandmark prominence | — (tightens hierarchy, no duplication) | `web-desktop-{dark,light}-landing.png` | web | — | BETTER THAN BAR | cleanup <1h | approved |
| 1.2 | `app/(landing)/LandingPage.tsx` (top-bar search) | SUBTRACT | Remove the "search" icon from top-bar nav (no site search exists) | Duplicates a search affordance the product doesn't fulfil — broken promise | `web-desktop-{dark,light}-landing.png` | web | — | BETTER THAN BAR | cleanup <1h | approved |
| 3.1 | `app/pricing/page.tsx` (hero) | TIGHTEN | Compress hero gradient panel vertical padding ~30% so Monthly/Annual toggle is visible in 900px viewport | — (subtractive: removes empty space) | `web-desktop-{dark,light}-pricing.png` | web | — | BETTER THAN BAR | cleanup <1h | approved |
| 3.2 | `app/pricing/PricingTiersGrid.tsx` | NEW | Append "inc. VAT" suffix under £7.99 / £59.99 on UK/EU surfaces (RTP-9; DC15 Stripe allowed borrow) | Adds 4-word string; does not duplicate any element | `web-desktop-{dark,light}-pricing.png` | web (UK/EU only — region-gated) | **DC15** (non-violation: makes the VAT-inclusive bet visible) | BETTER THAN BAR | refactor 1-4h | approved |
| 3.3 | `app/pricing/page.tsx` (hero badge) | SUBTRACT | Remove SUPPR mini-badge inside hero gradient (same wordmark in top-bar 60px above) | Duplicates the top-bar Suppr wordmark | `web-desktop-{dark,light}-pricing.png` | web | — | BETTER THAN BAR | cleanup <1h | approved |
| 4.1 | `app/pricing/page.tsx` (mobile viewport) | TIGHTEN | Tighten vertical padding on hero gradient panel for mobile viewport so Pro price reads in full in first viewport | — (subtractive) | `web-mobile-{dark,light}-pricing.png` | web mobile | — | BETTER THAN BAR | cleanup <1h | approved |
| 5.1 | `app/login/ui.tsx` (hero icon) | REPLACE | Replace blue clipboard placeholder icon with Suppr "S" wordmark tile (same as mobile Welcome) | Replaces a brand-incoherent placeholder with the real mark | `web-desktop-{dark,light}-login.png` | web | — (RTP-10) | AT BAR | cleanup <1h | approved |
| 5.2 | `app/login/ui.tsx` (page header) | SUBTRACT | Remove page H1 "Sign in to Suppr" + subtitle — card already carries "Welcome back / Sign in to continue" | Duplicates the card title/subtitle | `web-desktop-{dark,light}-login.png` | web | — | AT BAR | cleanup <1h | approved |
| 5.3 | `app/login/ui.tsx` (in-card toggle) | SUBTRACT | Remove in-card "Sign up / Sign in" segmented toggle; route Sign up to a dedicated page | Duplicates `/signup` route (which today is broken — see RTP-1) | `web-desktop-{dark,light}-login.png` | web | — | AT BAR | refactor 1-4h | approved |
| 5.4 | `app/login` + `app/signin` | SUBTRACT | Collapse `/login` ↔ `/signin` to one canonical URL with 301 from the other (RTP-5) | Duplicate route | `web-desktop-{dark,light}-{login,signin}.png` | web | — | AT BAR | cleanup <1h | approved |
| 6.1 | `app/signin/page.tsx` | SUBTRACT | 301-redirect `/signin` → `/login` (or pick the other as canonical). Decide based on Google indexing | Duplicate route. RTP-5. | `web-desktop-{dark,light}-signin.png` | web | — | AT BAR | cleanup <1h | approved |
| 7.1 | `app/signup/page.tsx` | REPLACE | Replace `/signup` content with actual signup form: First name / Email / Password / Apple SSO / "Create account" primary CTA / "Already have an account? Sign in" secondary | Replaces the duplicated landing variant with a real form; resolves RTP-1 + removes duplication with `/onboarding` | `web-desktop-{dark,light}-signup.png` | web | — | AT BAR | new build >4h | approved |
| 7.2 | `app/signup/page.tsx` (post-fix) | SUBTRACT | After 7.1 lands, ensure `/signup` is NOT a redirect to `/login` — needs own surface for password-manager flow | — | inherited | web | — | AT BAR | inherited | approved |
| 8.1 | `app/onboarding/page.tsx` | REPLACE | **Decide first:** is `/onboarding` (a) marketing handoff or (b) canonical flow? If (a), rename to `/start`. If (b), make this route render step 1 (goal/sex/age/etc.), mirroring mobile | Removes the route-name ↔ content mismatch | `web-desktop-{dark,light}-onboarding.png` | web | — (RTP-2 + RTP-8) | AT BAR | **design-needed** → new build >4h | **needs Grace decision** |
| 8.2 | `app/onboarding/page.tsx` (if 8.1 → b) | NEW | If 8.1 chooses (b): add progress indicator at top (1/12... 12/12 or dot-stepper). Borrow Cal AI dot pattern | Adds a missing affordance; doesn't duplicate anything | inherited | web | — | AT BAR | refactor 1-4h | conditional |
| 8.3 | `app/{signup,onboarding,(landing)}` | SUBTRACT | Whichever 8.1 choice — collapse `/signup` + `/onboarding` to single canonical entry. Three duplicated hero variants is too many | Removes triple-duplication | inherited | web | — | AT BAR | cleanup | approved |
| 9.2 | `app/home/page.tsx` or middleware | REPLACE | If unauthed users hit `/home` directly: redirect to `/` (public landing), not `/login` | Removes a forced login wall on a route that could be a deep-link target | `web-desktop-{dark,light}-home.png` | web | — | AT BAR | cleanup <1h | approved |

### Mobile surface rows

| # | Surface | Item type | What changes | What it duplicates / weakens | Before pixel | Affected platforms | DC# touched | Auditor verdict | Complexity | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 10.1 | `apps/mobile/components/onboarding/steps/welcome.tsx` | SUBTRACT | Remove "Join thousands tracking smarter" proof line above Get started CTA | Weakens DC12 calm voice (unsubstantiated claim, additive flourish) | `mobile-onb-03-goal.png` (Welcome screen) | mobile | **DC12** (non-violation: removes unsubstantiated puffery that drifts toward shouty growth copy) | BETTER THAN BAR | cleanup <1h | approved |
| 10.2 | `apps/mobile/components/onboarding/steps/welcome.tsx` | SUBTRACT | Remove the outlined "Sign in" button below Get started (OR replace with smaller bottom-of-viewport text link). Outlined button competes with primary CTA at cold-open | Competes with primary CTA; duplicates the auth path that lives in-flow at step 2 (signup with Apple SSO) | `mobile-onb-03-goal.png` (Welcome screen) | mobile | — | BETTER THAN BAR | cleanup <1h | approved |
| 11.1 | `apps/mobile/components/charts/CalorieRing.tsx` (mobile Today hero) | NEW | Apple Watch Move-ring 200ms ease-out fill animation when user logs first meal of the day. Fires once per day on ring's empty → lit transition | Adds a motion detail; does not duplicate any existing visual; explicitly listed in DC1 Allowed borrows | `mobile-today-dark.png` | mobile | **DC1** (non-violation: explicit DC1 Allowed borrow — Apple Watch Move ring fill animation) | BETTER THAN BAR | refactor 1-4h | approved |
| 11.2 | `apps/mobile/components/charts/CalorieRing.tsx` (hero kcal) | NEW | Cal AI count-up animation on hero kcal (400ms cubic ease, tabular-nums) triggered on data-update | Does not duplicate the long-press detail (which remains the disclosure for over/remaining) | `mobile-today-dark.png` | mobile | **DC1** (non-violation: DC1 Allowed borrow — Cal AI count-up) | BETTER THAN BAR | refactor 1-4h | approved |
| 11.3 | `apps/mobile/components/charts/CalorieRing.tsx` (haptic) | NEW | Withings-style light haptic on data-update (mobile only) | — (no existing haptic on this surface) | `mobile-today-dark.png` | mobile | **DC1** (non-violation: DC1 Allowed borrow — Withings light haptic) | BETTER THAN BAR | cleanup <1h | approved |
| 13.1 | `apps/mobile/app/paywall.tsx` (classifyPaywallReadiness path) | SUBTRACT | When RC offerings cannot resolve, suppress the "Subscriptions unavailable" full-width card. Replace with a small inline footnote below price. Do NOT block the Pro card render | Removes a failed-load card that competes with the actual paywall content; does not duplicate Restore | `mobile-paywall-light.png` | mobile | **DC4** (non-violation: preserves trust chips; the card being subtracted is the inverse-trust artifact) | BETTER THAN BAR | refactor 1-4h | approved (**prototype built** → `prototypes/mobile/P0/paywall.html`) |
| 15.1 | `apps/mobile/app/login.tsx` | TIGHTEN | Unify "SUPPR" caps wordmark to mixed-case "Suppr" matching landing/Welcome | Removes brand-mark drift between this screen and rest of app | code read only | mobile | — | BETTER THAN BAR | cleanup <1h | approved |
| 23.1 | `apps/mobile/app/(tabs)/settings.tsx` (Recipes + Streak tiles) | REPLACE | Replace flat-dark-grey "0 Recipes" + "0 Streak" tiles with outlined-coloured-tile pattern (DC14 Allowed borrow). Use different accents per tile (e.g. Recipes = amber, Streak = pale-indigo) | Removes a DC14 adjacency erosion; weakens nothing | `_context-mobile-settings-dark.png` | mobile dark | **DC14** (non-violation: explicit DC14 Allowed borrow — replicate outlined-coloured-tile pattern to other dark cards) | BETTER THAN BAR | cleanup 1-4h | approved |

---

## Capture / verification rows (not implementation; gates before items above can ship)

| CF # | What | Why | Blocks rows |
|---|---|---|---|
| CF-1 | Fix `00c_onboarding_v2_steps.yaml` Maestro flow to advance past Welcome and capture all 12 steps (light + dark) (RTP-6) | All 13 captured PNGs are Welcome duplicates; can't validate steps 03-15 visually | 10.1, 10.2, plus any onboarding-step rows still to surface |
| CF-2 | Re-capture mobile paywall in dark mode (RTP-7) | Only light pixel exists; DC4 trust chips need contrast verification on near-black | 13.1 G4 |
| CF-3 | Capture mobile AI paywall sheet (light + dark) | No pixel; code-read only | 14.x (TBD) |
| CF-4 | Capture mobile login.tsx (light + dark) | No pixel; 15.1 cannot be visually verified at G4 | 15.1 G4 |
| CF-5 | Capture mobile signup step (light + dark) — requires CF-1 fix first | No pixel; cannot verify handoff from Welcome to step 2 | 16.x (TBD) |
| CF-6 | Capture web checkout success `/checkout/success` (light + dark, both viewports) | No pixel; needs post-purchase fixture | 17.x (TBD) |
| CF-7 | Capture web upgrade paywall dialog + AI paywall dialog (modal overlays) | No pixel; modal overlays not surfaced by public-routes Playwright spec | 19.x (TBD) |
| CF-8 | Verify 10.3 — capture Welcome dark mode to confirm gradient damp-down still reads correctly | Verification-only; no code change unless regression surfaces | none (verification) |

---

## BETTER-THAN-BAR surfaces (no proposals — defended, intact)

These surfaces already exceed the comparable. Listed for transparency; no implementation rows touch them in P0 except where DC# is referenced for allowed borrows.

- **CARD 20 — Cookies banner** (cross-cutting, all web pages) — "Essential cookies on; analytics stay off until you accept" is the most honest cookie-banner framing the auditor has seen. DC12 calm voice intact.
- **CARD 21 — Mobile tab bar** — five-element layout (Today / Plan / FAB / Recipes / More) matches strategic direction. AT BAR.
- **CARD 22 — Mobile DayStrip** — F5/F9 revert from 2026-05-14 correctly in place. Past-day day-numbers retained + green checkmarks below day-initial. AT BAR.
- **CARD 24 — Mobile Profile dark** — DC14 load-bearing differentiator (outlined coloured macro tiles on near-black canvas) intact. BETTER THAN BAR.
- **CARD 25 — Footer cookies banner contrast (dark)** — passes WCAG AA. AT BAR.

---

## Items NOT proposed (and why)

From the auditor's restraint section + this proposal review:

- **No DC1 spine restructure.** Multi-ring nested-arc spine remains the load-bearing bet for mobile Today; only allowed-borrow interaction details (11.1, 11.2, 11.3) proposed.
- **No paywall trust-chip removal or 4th chip add.** DC4 specificity is the bet; Calm "No price hikes ever" 4th chip deferred pending Grace's long-term commitment.
- **No DayStrip changes.** F5/F9 revert from 2026-05-14 is intact; the past-day checkmarks + day-numbers pattern is the validated shape.
- **No mobile Welcome gradient changes.** Both 10.1 (proof line) and 10.2 (Sign in button) are SUBTRACT — additive flourishes from prior sweeps that drift away from DC12 calm voice.
- **No mobile tab-bar changes.** AT BAR per the strategic direction — the 4-tabs + FAB shape doesn't need re-litigation in P0.
- **No web cookies banner copy changes.** BETTER THAN BAR — Suppr's honesty framing is the bet.

---

## Defended Choices touched in P0 (preservation summary)

| DC | Surface | Status | Allowed borrows in this bucket |
|---|---|---|---|
| **DC1** Multi-ring calorie + macros spine | mobile Today CalorieRing | Intact | 11.1 ring-fill animation, 11.2 count-up, 11.3 haptic — all explicit allowed borrows |
| **DC4** Paywall trust chips | mobile paywall | Intact | 13.1 SUBTRACT broken card; trust chips moved inline adjacent to price (Stripe Checkout allowed borrow) — see prototype |
| **DC8** Calm streak pip | mobile Today (header — not directly touched in P0) | Intact, no proposals | none in P0 |
| **DC10** Calorie ring 3-state colour | mobile Today CalorieRing | Intact, no proposals | none — the F40 erasure from 2026-05-14 has been reverted |
| **DC12** Calm voice | mobile Welcome + cross-cutting | At risk via additive flourishes from prior sweeps (10.1 "Join thousands" proof line); proposed for removal | none |
| **DC14** Profile dark outlined tiles | mobile Settings dark adjacency | At risk (Settings tiles use flat-grey vs Profile outlined-coloured) | 23.1 REPLACE — explicit DC14 Allowed borrow (replicate outlined-tile pattern to other dark cards) |
| **DC15** UK/EU VAT-inclusive | web pricing | **At active risk** (RTP-9 — no "inc. VAT" line in first viewport) | 3.2 + 4.2 NEW — inline VAT line (Stripe allowed borrow) |

---

## What G3 review needs from Grace

For each row in the proposal table:

1. Strike rows you reject (mark `Status: rejected` with 1-line reason).
2. Approve rows that pass DC + subtractive lens (mark `Status: approved`).
3. **Specifically decide row 8.1** — `/onboarding` is currently route-name ↔ content mismatched. Pick (a) rename to `/start` and keep as marketing handoff, OR (b) make it render the actual flow. This decision cascades to 8.2, 8.3, 7.x (signup form scope).
4. Flag any DC concerns — every DC-touched row (3.2, 11.1-3, 13.1, 23.1) has a non-violation statement in the table; verify each.
5. Confirm capture-fix priority: CF-1 (onboarding capture) and CF-2 (paywall dark) block G4 on multiple implementation rows. I propose tackling those first while G3 is in flight.

After G3 approval, S2.5 builds prototypes for every approved row (one HTML file per surface, format per the approved `mobile/P0/paywall.html` reference).
