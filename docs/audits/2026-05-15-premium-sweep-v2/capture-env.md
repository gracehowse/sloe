# Canonical capture environment — premium-sweep-v2

Every capture run for this sweep MUST use this environment. Captures
taken against different environments are not comparable and cannot be
diffed against in `G4` per-item review.

If any of the constants below need to change mid-sweep, the change
must be documented inline (add a dated entry below) and **all
in-flight `before` captures in the active bucket must be re-captured**
before any new `after` is taken against them.

---

## Device targets

| Target | Spec | Why |
|---|---|---|
| **iOS sim** | iPhone 17 Pro Max running latest stable iOS (or fallback iOS 26.4 per `feedback_sim_supabase_unreachable.md` — NOT iOS 18) | Mirrors Grace's physical TestFlight device class; iOS 18 sim has the HTTP/3 wedge that blocks Supabase / PostHog |
| **Web desktop viewport** | 1440 × 900 | Default for `premium-bar-sweep-dark.spec.ts`; matches MacBook 14" effective |
| **Web mobile viewport** | iPhone 13 device profile in Playwright (390 × 844) | Default for the existing dark-mode spec |
| **Web tablet viewport** | Not in scope for this sweep | Single-tablet QA pass after sweep close |

Android is explicitly out of scope per `project_ios_only_no_android.md`.

---

## Status bar lock (mobile)

Locked by `apps/mobile/scripts/maestro-screenshot-tour.mjs` to:

- Time: `9:41`
- Battery: `charged` / `100`
- Network: `wifi` / `active` / `3 bars`
- Cellular: `notSupported`

Any Maestro flow that produces a screenshot must invoke the same
status-bar override before capture. The wrapper script handles this
for `00_screenshot_tour.yaml` automatically; for new flows added in
this sweep, include the same lock at the top of the flow or wrap
invocation in the same script.

---

## Theme matrix

Each P0/P1/P2 surface is captured in **both** light and dark mode.

- **Web:** `premium-bar-sweep-dark.spec.ts` covers dark today; S0
  authors `premium-bar-sweep-light.spec.ts` to mirror it for light.
- **Mobile:** Maestro flows pass `theme=dark` or `theme=light` via
  the Settings → Appearance toggle. The existing
  `00z_premium_bar_dark.yaml` is the dark-mode reference; a `_light`
  sibling will be added at the start of each bucket capture pass.

Light captures and dark captures live in the same `before/after`
folder, distinguished by filename suffix (`-light.png` / `-dark.png`).

---

## Fixture user

**Authentication:** uses `E2E_EMAIL` + `E2E_PASSWORD` env from repo-root
`.env.local` (also picked up by `apps/mobile/.env`). Same fixture user
runs every Maestro auth flow and every Playwright authed spec.

**Fixture user requirements** (verified at S1 capture start):
- `onboarding_completed = true` on the Supabase profile so authed
  surfaces (Today, Plan, etc.) render immediately
- At least 7 days of meal history so Eat Again, weight chart 2-point
  state, and digest variants populate
- One saved meal + one custom food (logged once) so the saved meal
  + recents states render
- At least 3 weigh-ins logged across the past 7 days (forces the
  2-point chart state, not the 1-point sparse state)
- One shopping-list item checked off, one unchecked (so the checkbox
  state renders)
- Pro tier active (so Pro-only surfaces capture correctly); paywall
  captures happen against a separate `E2E_FREE_*` fixture (TBD —
  authored before P0 capture if needed)

---

## Feature flag state

PostHog feature flags resolved at capture time:

| Flag | Value during capture | Reason |
|---|---|---|
| `onboarding-v2` | `true` (canonical onboarding) | Per `project_v2_rename_pending.md` — v2 is canonical |
| `premium-sweep-v2-*` | `false` until implementing that specific item | Captures must show *pre-change* state for `before` |
| All other flags | Production default | Audit baseline = what real users see |

If a flag is mid-rollout (not 0% or 100%), document it explicitly in
the capture batch fingerprint (see below) and prefer the production-
default branch unless the audit row is specifically about that flag's
branch.

---

## Time-of-day & data state

- All captures: morning state in the app's logical clock (i.e.,
  Today is the current calendar day; "Yesterday's gone" banner does
  NOT show; meals across breakfast/lunch/dinner are all loggable for
  today).
- Mobile uses `9:41` status-bar lock so the app clock reads "9:41".
- Fixture user's last meal was logged "yesterday" (the day before
  capture) so Eat Again surfaces yesterday's entries.

---

## Capture batch fingerprint

Every capture pass writes a fingerprint file to its bucket folder:

```
docs/audits/2026-05-15-premium-sweep-v2/captures/P0/before/_fingerprint.json
```

Schema:

```json
{
  "bucket": "P0",
  "batchType": "before",
  "capturedAt": "2026-05-15T10:00:00Z",
  "fixtureUserId": "<supabase user id>",
  "iosSimVersion": "iOS 26.4",
  "iosSimDevice": "iPhone 17 Pro Max",
  "webViewports": ["1440x900", "390x844 (iPhone 13)"],
  "themes": ["light", "dark"],
  "flagsResolved": {
    "onboarding-v2": true
  },
  "appBuildSha": "<git short sha at capture>",
  "notes": "free-form text for anything unusual"
}
```

This file is what makes the captures comparable. Any `after`
capture must list the same `iosSimDevice` + `webViewports` +
`themes` + `appBuildSha` of the implementation commit (NOT the
capture-time sha — the build-shipped sha).

---

## Capture commands (canonical run order)

For each bucket's `before` capture pass:

```bash
# 1. Mobile - bring up sim with iOS 26.4 (verify before capturing)
# (manual — open Simulator.app, pick the right device)

# 2. Mobile - boot Expo with the right env
npm run mobile:dev:maestro

# 3. Mobile - run the bucket-specific Maestro suite (light + dark)
#    See per-bucket section in P<n>-proposal.md for flow list.

# 4. Web - bring up dev server
npm run dev   # in another terminal

# 5. Web - run the bucket-specific Playwright sweep (light + dark)
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
  npx playwright test tests/e2e/screenshots/premium-bar-sweep-dark.spec.ts
PLAYWRIGHT_BASE_URL=http://127.0.0.1:3000 \
  npx playwright test tests/e2e/screenshots/premium-bar-sweep-light.spec.ts

# 6. Stage captures into the bucket folder
#    (the assistant moves them in; flow-by-flow naming is documented
#    per-bucket — see P0-proposal.md "Capture map" section)
```

After-captures (per-item) re-run only the specific Maestro flow /
Playwright spec for that surface, NOT the whole bucket pass.

---

## Change log

| Date | Change | Reason |
|---|---|---|
| 2026-05-15 | Initial environment specified | S0 prep |
