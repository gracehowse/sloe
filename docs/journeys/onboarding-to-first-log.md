# Onboarding → first log

A brand-new install or landing-page visit, through account creation, to a
completed profile with a seeded library and (usually) a first logged meal on
Today.

**Audience:** `(Developer)` | `(Internal)` — engineering, PM, and QA reference
for how the flow behaves today. Not user-facing copy.

**Scope**
- **In:** every step from Welcome through onboarding completion; the parallel
  Login/auth-chooser entry (magic link, password reset, auth callback); the
  routing gate that decides who sees onboarding vs the tabs; mobile-only
  re-entry and post-completion surfaces.
- **Out:** individual step visual specs (see `docs/ux/redesign/onboarding.md`
  and the Sloe v3 prototype), the API/DB contract for `profiles` (see
  `docs/api/`), Household settings (a post-onboarding **Settings** surface,
  not part of this flow — see "Open product questions" below), and the
  monetisation/paywall
  mechanics beyond the in-flow "See Pro" ask (see
  [`docs/journeys/monetisation-and-paywall.md`](./monetisation-and-paywall.md),
  which names mobile onboarding's forced-annual, trial-eligible SKU as the
  loop's single highest-volume entry point).

This is the **front door of the primary product loop**: the reveal step's
computed targets become the Today macro spine, and this journey feeds
directly into `docs/journeys/food-tracking.md` and `docs/journeys/log-sheet.md`.

---

## Journey map

```
Welcome ─▶ app-choice ─▶ Questionnaire ─▶ Reveal ─▶ Signup ─▶ Data bridges ─▶ [First log ─▶ Upgrade] ─▶ Completion ─▶ Today
             (optional         (goal…strategy,          (targets                (optional        (conversion funnel,
              pick, always      incl. pace safety-       before                   import/          default-ON, terminal)
              shown)            floor soft-warn)         account)                 target bridges)
```

Steps in `[ ]` are flag-gated and auto-skip when their flag is off (`app-choice`
had this until its `onboarding-app-choice` flag collapsed permanently ON
2026-07-22, ENG-1651 — it's unbracketed above because it's always shown now).
The canonical step order lives in `STEP_IDS`
(`src/lib/onboarding/state.ts`), shared verbatim by web and mobile.

| Step id | Web component | Mobile component |
|---|---|---|
| `welcome` | `src/app/components/onboarding/steps/welcome.tsx` | `apps/mobile/components/onboarding/steps/welcome.tsx` |
| `app-choice` | `src/app/components/onboarding/steps/app-choice.tsx` | `apps/mobile/components/onboarding/steps/app-choice.tsx` |
| `goal` … `strategy` | `src/app/components/onboarding/steps/` | `apps/mobile/components/onboarding/steps/` |
| `reveal` | `src/app/components/onboarding/steps/reveal.tsx` | `apps/mobile/components/onboarding/steps/reveal.tsx` |
| `signup` | `src/app/components/onboarding/steps/signup.tsx` | `apps/mobile/components/onboarding/steps/signup.tsx` |
| `data-bridges` | `src/app/components/onboarding/steps/data-bridges.tsx` | `apps/mobile/components/onboarding/steps/data-bridges.tsx` |
| `first-log` | `src/app/components/onboarding/steps/first-log.tsx` | `apps/mobile/components/onboarding/steps/first-log.tsx` |
| `upgrade` | `src/app/components/onboarding/steps/upgrade.tsx` | `apps/mobile/components/onboarding/steps/upgrade.tsx` |

Shell/orchestration: `src/app/components/onboarding/web-flow.tsx` (web),
`apps/mobile/components/onboarding/mobile-flow.tsx` (mobile). Both consume
the same `canAdvance` / `resolveNextStep` / `computeV2Targets` helpers from
`src/lib/onboarding/`.

---

## Entry points

There are four ways a user reaches this journey, and they matter because
they change what the user has already seen:

1. **Fresh install / first landing visit, no session.**
   Web: landing "Get started" → `/onboarding` → Welcome.
   Mobile: the tab gate sends a signed-out fresh install to `/login` first
   (auth-wall-first) **unless** `mobile_preauth_reveal_v1` is on
   (default-OFF), in which case it goes straight to Welcome — see "Onboarding
   entry gate" below, and the open parity gap it represents.

2. **Returning signed-out user.** Web and mobile both route through the
   **Login / auth chooser** (`app/login/ui.tsx` web, `apps/mobile/app/login.tsx`
   mobile) rather than onboarding. See "Parallel entry: login & auth" below.

3. **Signed-in user with an incomplete profile.** The onboarding entry gate
   (mobile: `apps/mobile/hooks/useOnboardingGate.ts`; web: `WebFlow` itself)
   routes them into `/onboarding` rather than the tabs/home.

4. **Mobile-only re-entry via Settings → "Refresh my plan."** A distinct,
   shorter re-run of the flow for existing users — see "Refresh-plan
   re-entry" below. Do not confuse this with **Reset targets**, which is
   inline and does *not* re-run onboarding.

---

## Step-by-step walkthrough

### 1. Welcome / brand screen

**Why this step exists:** a calm, brand-first first impression before asking
anything — full-bleed, no top bar or progress indicator. Tagline and trust
footer ("Private by default · About a minute") are locked copy.

**What the user does:** taps "Get started" (→ `app-choice`) or "I already
have an account" (→ `/login`).

**Parity:** identical on both platforms (copy, layout, tokens); pinned by
`tests/unit/onboardingWelcomeParity.test.tsx`. The former web/mobile welcome-copy
divergence was retired 2026-05-25.

### 2. App-choice — "Coming from another app?" (optional; always shown)

**Why this step exists:** it's the earliest credible moment to identify an
MFP/Lose It/Cronometer/MacroFactor switcher and route them toward the CSV
importer later in the flow.

**What the user does:** picks the app they're leaving, or "none." Only apps
with a live CSV import adapter are offered as named options.

**What happens next:** the choice pre-highlights the matching importer on
`data-bridges` and is emitted as `onboarding_app_choice`. The step's
`onboarding-app-choice` flag collapsed permanently ON 2026-07-22
(ENG-1651) — it's now unconditionally shown and counted in the progress
total on both platforms.

**Parity:** identical — the same shared skip logic (now unconditional for
this step) keeps step counts in lockstep across platforms.

### 3. Questionnaire — goal, why-now, sex, age, height, weight, activity, pace, diet, strategy

**Why this step exists:** feeds the TDEE/macro computation that the `reveal`
step shows. `why-now` (intent capture, flag-gated) is a calm,
body-neutral "what's bringing you here?" question. `weight` has an explicit
"skip the scale" path (an ED-recovery accommodation) that also skips `pace`.
`strategy` is an optional macro-split override.

**Pace safety-floor soft-warn:** if the chosen kg/week pace projects below
the safety floor, a warning banner appears. `info`/`warn` levels advance with
one tap; a `danger` level requires an explicit acknowledgement checkbox
before Continue enables — never a hard block. This is a deliberate compromise
between two failure modes: a silent one-tap advance past an unsafe deficit
reads as a dark pattern, but a hard block reads as clinical gatekeeping.
Fires `onboarding_pace_below_safety_floor` with `acted`/`level`/`reason`.

**Parity:** identical logic on both platforms — shared `canAdvance` danger
gate and shared `paceWarning`; pinned by `tests/unit/onboardingPaceAnalytics.test.tsx`
+ the mobile mirror.

### 4. Reveal — targets before account

**Why this step exists:** show the computed calorie + macro targets (the
"aha" moment) *before* asking the user to create an account, to lift signup
conversion among competitor refugees.

**What the user does:** sees their targets (or, if weight was skipped, a
"calibrate from your logs" message) and continues.

**Parity — the largest live divergence in this journey:** this reveal-before-
signup order is the **default on web** but is only reached on mobile when
`mobile_preauth_reveal_v1` is on (**default-OFF**). Mobile's live default is
therefore auth-wall-first: sign in, *then* see any value. This is genuinely
open, not yet resolved — see "Open product questions" below.

### 5. Signup — real account creation

**Why this step exists:** account creation comes after the reveal so the
value comes first. A 2026-05-26 fix closed a bug where a fake Apple button
advanced the flow on local state alone with no real session.

**What the user does — diverges by platform, deliberately:**
- **Web:** email + password + first name, a positive Terms/Privacy assent
  checkbox, a "Check your email" confirm interstitial. No Apple button (Apple
  JS OAuth isn't wired for the web domain).
- **Mobile:** Apple Sign-In only (real `expo-apple-authentication` +
  `signInWithIdToken` with nonce), optional first-name field, no
  email/password. Apple-only satisfies the App Store IAP guideline.

**Gate:** advancing past this step requires a **real Supabase session**
(`canAdvance("signup", …)` checks `hasSession`), not just local state — the
fix for that session-spoofing bug.

**What happens next:** `data-bridges`. Auto-skipped entirely when a session
already exists (e.g. arriving via `/signin` → `/onboarding`).

**Parity:** diverges by design, but the reasoning behind this specific split
isn't confirmed as permanent — don't read it as settled. The general
Apple/native carve-out in `_project-context.md` ("Cross-platform parity
rules") covers Apple Sign-In/Apple Health being mobile-first by nature; it
does not, on its own, explain why *web* onboarding has zero Apple option
when Apple OAuth already exists on the web `/login` chooser
(`signInWithOAuth`), just not wired into this step. Same step slot and
session-gate logic; different auth *method* per platform. Pinned by
`onboardingSessionGateParity.test.ts`. See "Open product questions" below —
this parity gap is not resolved.

### 6. Data bridges — "Bring your data with you"

**Why this step exists:** competitor refugees were bouncing day-one with no
path to bring their existing data across.

**What the user does:** independently actions any of: manual kcal/P/C/F
target paste-in (overrides computed targets when all four are set), Apple
Health connect (mobile only — native HealthKit, no web equivalent), push
notifications opt-in, a recipe-URL import, or a meal-history CSV import
(`MfpCsvImportCard` — 4th card on web, 5th on mobile after Apple Health).
`dataBridgeChosen` records the last card actioned; advancing is allowed
regardless of which card (or none) was touched.

**Named-tracker reassurance strip (inside the CSV-import card):**
`NamedTrackerReassuranceStrip` (`src/app/components/imports/NamedTrackerReassuranceStrip.tsx`
web, `apps/mobile/components/imports/NamedTrackerReassuranceStrip.tsx`
mobile) renders a small "Supported exports" pill row directly under the
CSV-import card's body copy — one pill per supported tracker (single-letter
mark tile + display name). This is a deliberate scope reduction Grace
ratified on 2026-06-28: a lightweight strip instead of the redesign
prototype's full 8-app source grid. The pill list comes live from
`namedTrackerReassuranceItems()`
(`src/lib/imports/namedTrackerReassurance.ts`, re-exported to mobile via
`@suppr/shared/imports/…`), which reads the CSV adapter registry directly
(`REGISTERED_ADAPTERS`) — so the strip can never advertise a tracker the
parser doesn't actually support. Today that resolves to MyFitnessPal, Lose
It, Cronometer, and MacroFactor — the four trackers in the mass-market group
of the competitor set.

It only shows when the card is displaying its generic, non-personalised copy
and hasn't started an upload yet
(`isFeatureEnabled("mfp_tracker_reassurance_v1") && !highlighted &&
state.kind === "idle"`) — i.e. the user reached data-bridges *without*
naming their prior app on app-choice (§2 above), so the card is making a
cold "we support your export" pitch rather than the already-personalised
"Bring your MyFitnessPal history" copy. It's absent once a file is picked
and never shown to a user who was highlighted. `mfp_tracker_reassurance_v1`
is default-on on both platforms; PostHog is the kill switch, not a ramp.

**What happens next:** `first-log` when the conversion funnel flag is on,
otherwise this step is **terminal** and runs Completion directly.

**Parity:** diverges-and-why — Apple Health card is mobile-only by nature
(native permission, no web equivalent). Manual-targets, notifications,
recipe-URL, CSV-import, and the reassurance strip inside it all match —
identical shared item list, identical gating logic, same pill-chip visual
treatment. Persist behaviour tested by `onboardingDataBridgesPersist.test.ts`;
the reassurance strip's item list and its flag/`!highlighted` gating on both
platform cards are pinned by `tests/unit/namedTrackerReassurance.test.ts`.

### 7. Conversion funnel tail — first-log then upgrade (default-ON both platforms)

**Why this step exists:** "activate first, monetise last." A guided
first-win log gives the user something real before any monetisation ask; the
trial ask sits at the very end so skipping it lands cleanly on Today with no
detour (a legal requirement to keep to a single call-to-action per screen).
The first-log-then-upgrade ordering (upgrade is the terminal step, not
first-log) reflects a 2026-07-01 product decision from Grace to lead with
activation before the monetisation ask — see "Open product questions" below
for a documentation gap around that decision.

**What the user does:**
- **`first-log`:** picks a guided chip (breakfast / coffee / search) that
  deep-links into the Log sheet on Today post-completion
  (`firstLogDeepLinkQs`) — see `docs/journeys/log-sheet.md` for what happens
  inside that sheet.
- **`upgrade`:** sees a skippable "See Pro" trial ask. "Continue on Free"
  runs Completion directly to Today. "Start free trial" persists onboarding
  first, *then* pushes the platform-appropriate paywall (Stripe checkout
  dialog on web, RevenueCat on mobile).

**What happens next:** Today (Free path), or the paywall (trial path) which
itself lands on Today after checkout. This is the point where the journey
hands off to the **Monetisation / Paywall Loop**
(`docs/journeys/monetisation-and-paywall.md`) — that doc covers the full
trigger → checkout → webhook → `profiles.user_tier` reconciliation →
manage/cancel path in detail; this doc only covers the in-flow ask itself.

**ENG-1459 (2026-07-22) — inline collapse variant, flag
`onboarding_upgrade_inline_paywall_v1` (DEFAULT-OFF):** behind the flag,
the `upgrade` step above stops being "static callout → separate paywall
modal/route" and instead renders the paywall's own sell content
(hero/features/price/trust-strip/disclosure/CTA) directly inside the step —
one screen, one scroll, one Upgrade-or-Continue-free decision, instead of
the two-surface handoff described above. Web: `UpgradePaywallContent`
(`src/app/components/paywall/UpgradePaywallContent.tsx`) renders inline in
place of opening `UpgradePaywallDialog`. Mobile: `PaywallContent`
(`apps/mobile/components/paywall/PaywallContent.tsx`), fed by
`useOnboardingInlinePaywall`, renders inline instead of
`router.push("/paywall?from=onboarding")`. Every other entry point into
the dialog/route (settings, voice_log, photo_log, trial_end, meal_planner,
recipe_import, …) is untouched — this only changes the onboarding
terminal step's own presentation. Flag-off is byte-identical to the
two-surface flow described above. See
`docs/decisions/2026-06-28-onboarding-conversion-funnel-and-plan-actions.md`
for the funnel's own history and the ENG-1459 commit for the full
legal-preservation checklist this variant carries over unchanged (CMA
auto-renewal disclosure, VAT gate, trust strip, C4 skip affordance, C10
analytics honesty, Pro-guard).

**When the flag is off:** both steps auto-skip and `data-bridges` becomes
terminal — a byte-identical legacy flow. This is the **most current**
description of the onboarding tail; it supersedes any older doc describing a
different terminal step (see "Superseded" below).

**Parity:** identical flow shape; billing rail diverges by the documented
Stripe(web)/RevenueCat(mobile) carve-out.

---

## Completion — the step that used to be "Pick 5 recipes"

**Why onboarding must end with a completed action, not just a computed
number** (the surviving rationale from the original terminal-step spec):

> "Best-in-class onboarding ends with the user having a thing, not just
> knowing a thing."

That principle is still the authority for this step — only the *mechanism*
has changed. Onboarding originally tried to satisfy it by making the user
hand-pick 5 recipes from a 15-recipe grid as the literal terminal step. That
picker was **cut from both platforms on 2026-05-30** because it had no live
call site on either platform — the mount point it was built for (a mobile
nudge queue) never materialised, and web never had an equivalent queue at
all. It was genuinely dormant code, not deferred-pending work.

The "ends with a thing" principle now plays out two ways, neither of which
requires the user to make a picker decision:

1. **The library seeds itself automatically.** `selectOnboardingSeeds`
   (`src/lib/onboarding/onboardingSeeds.ts`, shared by both platforms) always
   returns a non-empty, diet/allergen-filtered set of curated recipes when
   the user hasn't picked any (which is always, today —
   `state.pickedRecipeSlugs` has no live writer). This keeps the "what to
   eat next" north-star from ever rendering its empty state on day one.
   Gated behind a default-ON kill switch (`onboarding_default_seeds` PostHog
   flag, read via the fail-safe `isFeatureDisabled` — cold/unloaded PostHog
   resolves to "seed," never to "skip seeding").
2. **The conversion-funnel `first-log` step (§7 above) is a more literal,
   more honest version of the same principle** — the user doesn't just get a
   pre-picked library, they log a real first meal before they ever see a
   monetisation ask.

**What actually happens on terminal-step completion**, in order (identical
logic in `web-flow.tsx` `handleComplete` and mobile's
`useOnboardingCompletion.ts`):

1. Save a local profile cache first (works offline / unauthenticated).
2. Upsert the `profiles` row (targets, body stats, goal, diet, unit system).
   **If this write fails, the user stays on the step with a retry message**
   — a deliberate 2026-05-25 fix for a bug where a swallowed write bounced
   the user to Today on stale targets with no error surfaced.
3. Redeem any pending referral code.
4. Seed the library via `selectOnboardingSeeds` (see above) →
   `resolveSeedsToRecipeIds` → `saveResolvedSeeds`.
5. Build a first-week plan via `buildFirstWeekFromSeeds` → the
   `save_meal_plan` RPC. A plan-build failure is non-fatal — it's surfaced
   as a toast on landing, not a blocked completion.
6. Fire `onboarding_completed` (payload includes `recipes_picked`,
   `recipes_resolved`, `recipes_saved`, `plan_built`, `used_default_seeds`,
   `data_bridge_chosen`, `app_choice`).
7. Clear persisted onboarding state (so the next signup on the same device
   doesn't pre-fill the previous user's answers).
8. Route to `/home` (web) or the tabs (mobile), carrying the
   `onboarding_complete=1` / `plan_build=failed` / first-log deep-link query
   params as applicable.

**Parity:** identical — shared persist/seed/first-week helpers; both shells
surface write-failure and keep the user on the step. Pinned by
`onboardingPersist.test.ts` + mobile's `onboardingTrialPersistsPlan.test.ts`.

**What happens next:** Today, with the seeded library immediately available
to the north-star suggestion block, and (if the user picked a first-log chip
in §7) the Log sheet already deep-linked open. Continue the loop at
`docs/journeys/food-tracking.md` and `docs/journeys/log-sheet.md`.

---

## Parallel entry: login & auth

Not steps in this journey's linear flow, but the alternate front doors that
feed into it or bypass it entirely:

- **Login / auth chooser** (`app/login/ui.tsx` web, `apps/mobile/app/login.tsx`
  mobile) — Apple button + progressive-disclosure "Continue with email."
  Web additionally supports `/signin` and `/signup` aliases with an inline
  mode tab strip; mobile hides the Apple button when it can't provision
  Sign-in-with-Apple. A signed-in user with an incomplete profile is routed
  from here into `/onboarding` by the entry gate below.
- **Magic link + password reset request** — `signInWithOtp` /
  `resetPasswordForEmail` from the login form; both round-trip through the
  auth callback.
- **Reset-password screen** (`app/reset-password/page.tsx` web,
  `apps/mobile/app/reset-password.tsx` mobile) — confirms a recovery session,
  takes a new password (min 8 chars, must match), then routes to `/login`.
  Both platforms have a "Back to sign in" escape hatch.
- **Auth callback** (`app/auth/callback/route.ts` web,
  `apps/mobile/app/auth-callback.tsx` mobile) — exchanges the PKCE `?code=`
  for a session, then routes to a guarded next path (open-redirect guard).
  Mobile guards against double-exchange of the single-use code.

## Onboarding entry gate — who sees onboarding vs the tabs

**Mobile** (`apps/mobile/app/(tabs)/_layout.tsx` via `useOnboardingGate.ts`):
cache-aware — a locally-cached completion mounts tabs instantly (offline-safe).
A session with **no** cached completion blocks on a launch screen and routes
to `/onboarding` on timeout/error, rather than optimistically skipping onto
stale data (a fix for a bug where a slow or failed profile fetch used to
silently skip onboarding for brand-new users). A signed-out fresh install
goes to `/login` unless `mobile_preauth_reveal_v1` (default-OFF) is on.

**Web** (`WebFlow`): handles anonymous completers and auto-skips `signup`
when already authenticated.

This gate is where the **biggest live parity gap** in this journey lives:
web defaults to reveal-first (value before auth); mobile's live default is
auth-wall-first. This is open, not yet resolved — do not treat it as settled
parity.

## Refresh-plan re-entry (mobile-only)

When a signed-in user re-enters via Settings → "Refresh my plan," mobile
auto-skips `welcome` and `signup`, shows a "REFRESH PLAN" pill, drops
`data-bridges` from the step counter (**N/12** instead of N/13), and routes
`reveal` → completion directly. Detected via the
`suppr.reset-plan-pending-prompt` AsyncStorage flag. This is the documented
web-N/13-vs-mobile-N/12 step-count carve-out in `_project-context.md`
("Cross-platform parity rules") — intentional, not drift. Distinct from
**Reset targets**, which is inline and does not re-run onboarding.

## `/onboarding-v2` legacy redirect

A thin, deliberately-kept-forever redirect from the old `/onboarding-v2` URL
to canonical `/onboarding`, firing `onboarding_v2_redirect_followed` so
stale-link traffic can be monitored toward zero.

## Post-onboarding activation hand-off (mobile-only)

Two linked hooks close what's known internally as "the post-Reveal momentum
leak" — the gap between the Reveal aha moment and the user actually feeling
settled on Today. Both are mobile-only; there's no web equivalent for either
today.

1. **Notifications prompt** (`apps/mobile/app/notifications-prompt.tsx`) —
   a native push-permission explainer with a 3-bullet value ladder and an
   honest "Maybe later" skip. Suppression-gated (answered once, never
   re-nagged). Both "Notify me" and "Maybe" route to
   `/(tabs)?firstRun=1` — the `firstRun=1` query param is the signal Today
   consumes for the second hook below, so a user who dismissed this prompt
   still gets the rest of the first-run polish.

2. **Today first-run progressive disclosure** — `firstRun=1` (also set on
   the older `onboarding_complete` completion path) makes Today, on that one
   render, surface activation polish it otherwise wouldn't:
   - `PostOnboardingPushExplainer` — a second, Today-hosted push-permission
     ask shown only if the OS permission is still `undetermined` (i.e. the
     user skipped or never saw the notifications-prompt screen).
   - `FirstLogAcknowledgment` — a 2.5s toast + success haptic fired on the
     `mealsToday.length` 0→1 transition, gated by a one-time
     `suppr.first-log-acknowledged.v1` flag so a returning user never
     re-triggers it on day two. This is the "smallest possible reward" for
     the first logged meal, separate from and in addition to the
     conversion-funnel `first-log` step's deep-link (§7 above) — the
     deep-link gets the user *into* the Log sheet; this toast acknowledges
     the save that comes out of it.

   Both components live in `apps/mobile/app/(tabs)/_today/TodayScreen.tsx`.

---

## Edge cases & limits

- **Weight skipped:** `pace` is also skipped; `reveal` shows a "calibrate
  from your logs" message instead of concrete targets.
- **Diet/allergen filter empties the default seed set:** `defaultOnboardingSeeds`
  falls back to searching the full library for up to 5 rows that satisfy the
  filter — "better than empty" is the explicit design rule, never a silently
  empty library.
- **Profile write fails at completion:** user stays on the terminal step with
  a retry message; nothing downstream (seeding, plan build, analytics,
  navigation) runs. Not a silent bounce.
- **Plan-build fails after a successful profile write:** non-fatal — routes
  to Today with `plan_build=failed` and a toast; the library itself did
  still seed.
- **Anonymous user reaches the terminal step** (session expired, or a URL
  was stuffed past `signup`): web jumps them back to the `signup` step
  in-place rather than reloading `/onboarding`; their answers aren't lost.
- **PostHog cold/unloaded during completion:** `isFeatureDisabled` fails
  safe toward seeding (never toward an empty library) — see Completion §.

---

## Superseded

`docs/journeys/onboarding-final-step-2026-04-27.md` described a "Pick 5
recipes" terminal step (step 15/15) that was **removed 2026-05-30**. That
file is now a redirect stub pointing here. Do not resurrect its mechanics
without a new design decision — the rationale it carried forward is
preserved in the Completion section above.

## Open product questions

- **Reveal-before-auth parity.** Whether mobile should ramp
  `mobile_preauth_reveal_v1` to match web's reveal-before-signup default, or
  whether auth-wall-first is intended to stay mobile's permanent posture, is
  not yet decided.
- **Web signup has no Apple option; mobile signup has only Apple.** Whether
  this is the intended permanent split or a gap is unresolved — Apple OAuth
  exists on the web `/login` chooser via `signInWithOAuth`, just not inside
  the onboarding `signup` step.
- **`apps/mobile/CLAUDE.md` describes mobile auth inaccurately.** It states
  "Auth: Apple Sign In (no email/password QA form)," but
  `apps/mobile/app/login.tsx` ships a full email/password + magic-link +
  reset form. The rules file needs updating to match the shipped login
  screen.
- **Household settings is not part of this loop.** It's reached
  post-onboarding from the Plan/Progress `HouseholdBar` "Manage" or More →
  Household — a Settings surface, not an onboarding step. Household
  setup/config has its own doc:
  [`docs/journeys/household-sharing.md`](./household-sharing.md).
- **The `first-log → upgrade` step order has no dedicated decision record.**
  A `state.ts` code comment cites a decision doc for the 2026-07-01
  order-flip (first-log before upgrade) that doesn't exist on disk; the
  closest real coverage is the conversion-funnel decision doc referenced
  below, which predates the flip. The order itself is intentional (Grace's
  call) — it's the write-up that's missing, not the decision.

---

## Dev/QA harness — `/dev/primitives`

Not a journey step — a local-only preview page (`app/dev/primitives/page.tsx`)
for interacting with the three Phase 1 primitives from the onboarding
redesign (`SupprMark`/`SupprWordmark`, `OptionCard`, `RulerSlider` —
component contracts documented in `docs/ux/design-system.md` under "Brand
mark," "Selection card," and "Ruler slider") against real prop shapes and
both themes, without walking the live flow. Built during Phase 1 of the
redesign — deliberately scoped as "net-new primitives, no user-facing
change" — so the primitives could be sanity-checked before Phase 2's
onboarding rewrite landed on top of them.

**What it renders**, matching the actual Questionnaire sub-steps (§3 above)
that consume these primitives:
- **Goal** — the full-size `OptionCard` single-select list.
- **Activity** — the same primitive in `compact` mode.
- **Diet** — the multi-select chip variant (`trailing={null}`).
- **Height + Weight** — live `RulerSlider` instances with a metric/imperial
  toggle, exercising the same `formatImperialHeightInches` /
  `parseImperialHeightInches` helpers the real steps use.
- A light/dark theme toggle, plus `SupprMark`/`SupprWordmark` size variants.

**Reachability:** it 404s only on the `suppr.club` production deployment
(`VERCEL_ENV === "production"` — gated both in the page via `notFound()`
and again in `middleware.ts`'s `/dev/` `DEV_PREVIEW_PREFIXES` allowlist).
It's reachable in local dev, CI's `next start` (no `VERCEL_ENV`), and Vercel
preview deployments — the same dev-route pattern the visual-validation dev
screens use (`docs/development/mobile-visual-validation.md`), except it
isn't tied to one bundle's Maestro/Playwright capture flow: it's a standing
sandbox, not a one-off validation harness, and has no mobile equivalent
(the three primitives are mobile-native components with no comparable
`apps/mobile/app/dev/` preview screen).

**Not covered by any automated test.** It's an interaction sandbox for
Grace, not a tested contract. A stale "onboarding v2" button label on this
exact page was caught and fixed previously — that's the kind of drift this
page is actually exposed to (copy/link rot as the primitives' real call
sites evolve), not a broken flow. Treat a regression here as a design-review
finding to fix opportunistically, not a release blocker.

---

## Automated coverage

- Vitest (web): `onboardingWelcomeParity.test.tsx`,
  `onboardingPaceAnalytics.test.tsx`, `onboardingSessionGateParity.test.ts`,
  `onboardingDataBridgesPersist.test.ts`, `namedTrackerReassurance.test.ts`
  (reassurance-strip item list + web/mobile flag-and-`!highlighted` gating),
  `onboardingPersist.test.ts`, `selectOnboardingSeeds.test.ts`,
  `preauthRevealGate.test.ts`, `authCallbackRedirect.test.ts`,
  `loginChooserFigma`, `loginEmailEntryMode`, `authChooserFigma`.
- Vitest (mobile): `useOnboardingGate.test.ts`,
  `onboardingTrialPersistsPlan.test.ts`, `isFeatureDisabled.test.ts`,
  `postOnboardingPushExplainer.test.tsx`, `authDeepLinkCallback.test.ts`,
  `firstLogAcknowledgment.test.tsx`.
- Maestro: `09_onboarding.yaml`, `00c_onboarding_v2_steps.yaml`,
  `00c0_onboarding_welcome_capture.yaml`,
  `00c1_onboarding_signup_preauth_guard.yaml`, `30_login_auth.yaml`,
  `28_notifications_prompt.yaml`.

## Related documents

- `docs/journeys/log-sheet.md` — where a first-log deep-link from §7 lands.
- `docs/journeys/food-tracking.md` — the Today loop this journey feeds into.
- `docs/journeys/what-to-eat-next.md` — why the library must clear
  `NORTH_STAR_LIBRARY_MIN` on day one; the seeded library from Completion
  feeds this block directly (see its "Library threshold" section).
- `docs/journeys/monetisation-and-paywall.md` — the full trigger → checkout
  → webhook → entitlement loop the terminal "See Pro" ask (§7) hands off
  into; also documents mobile onboarding's forced-annual trial SKU as that
  loop's single highest-volume entry point.
- `docs/decisions/2026-05-30-cut-onboarding-recipe-picker.md` — why the
  picker was cut.
- `docs/decisions/2026-06-28-onboarding-conversion-funnel-and-plan-actions.md`
  — the conversion-funnel tail.
- `docs/decisions/2026-05-01-onboarding-data-bridges.md` — the data-bridges step.
- `docs/decisions/2026-04-30-activation-hooks-post-onboarding.md` — the
  post-onboarding activation hand-off (notifications prompt + Today
  first-run polish) covered above.
- `.claude/agents/_project-context.md` — "Cross-platform parity rules" for
  the documented step-count and auth-method carve-outs referenced above.
- `docs/ux/design-system.md` — component contracts for the primitives the
  `/dev/primitives` harness (above) previews: "Brand mark," "Selection
  card," "Ruler slider."
- `docs/development/mobile-visual-validation.md` — the sibling dev-route
  pattern used by per-bundle visual-validation screens on both platforms.
