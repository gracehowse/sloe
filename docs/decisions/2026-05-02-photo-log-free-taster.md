# Photo-log free taster — 5 free logs per rolling 7 days before the paywall

**Date:** 2026-05-02
**Area:** Monetisation / Mobile / Web / Funnels
**Status:** Resolved (shipped)
**Owners:** product-lead (call), monetisation-architect (review),
sync-enforcer (parity), engineer (this PR)

## Context

PR #17 (photo-log itemized) gated the entire flow on Pro tier. The
server (`app/api/nutrition/photo-log/route.ts`) returned 403
`upgrade_required` for any non-Pro user, and the mobile + web entry
points showed the AI paywall before the user could tap the camera
even once.

Cal AI's runaway growth model is built on giving every user free shots
of the AI before asking for money. We have the better feature — kcal
ranges, add-on chips, USDA / Open Food Facts / FatSecret verified
nutrition — and we were gating it before the user could taste it. Two
final audits confirmed: gate the SECOND photo, not the first. PR #46
proposed 3/day; monetisation-architect's revised spec (this PR)
calibrated the window to 5/week instead.

## Decision

**Free + Base users get 5 free photo logs per rolling 7-day window
(168 hours). The 6th attempt returns 403 and routes to the in-flow AI
paywall.** Pro keeps the existing per-user 100/day cap, untouched.

Concretely:

1. **Server** (`app/api/nutrition/photo-log/route.ts`):
   - Removed the blanket `tier !== "pro"` gate.
   - Added a separate `rateLimit` bucket (`api:photo-log:free-quota`)
     with `limit: FREE_PHOTO_LOG_WEEKLY_LIMIT (= 5)` and
     `windowMs: FREE_PHOTO_LOG_WINDOW_MS (= 168h)` for non-Pro users.
   - On exhaustion: returns 403 `upgrade_required` with
     `freeQuotaRemaining: 0` so the client can hand off to the
     paywall and render the right copy.
   - Pro users skip the free-quota bucket entirely; the existing
     `api:photo-log` 100/day bucket still applies (unchanged).
   - Successful 200 responses include `freeQuotaRemaining: number |
     null` (null for Pro) so the client's quota line is authoritative
     after the first analyse.

2. **Mobile** (`apps/mobile/components/PhotoLogSheet.tsx` +
   `apps/mobile/app/(tabs)/index.tsx`):
   - `handleOpenPhotoLog` no longer checks tier — always opens the
     sheet.
   - Photo-entry chip in `LogSheet` no longer renders a lock badge
     (`locked: false`).
   - `TodaySnapShortcut` no longer renders a lock badge.
   - `PhotoLogSheet` accepts new `userTier` + `onUpgradeRequired`
     props.
   - When `userTier !== "pro"`: renders a thin "X free logs remaining
     this week" line under the sheet caption (optimistic
     `FREE_PHOTO_LOG_WEEKLY_LIMIT` until first response, then
     authoritative `freeQuotaRemaining`).
   - On 403 from the server: fires `ai_photo_log_paywalled` (so
     existing funnels keep reporting), calls `onUpgradeRequired` —
     the host closes the sheet and opens `AiPaywallSheet { feature:
     "photo_log" }`.

3. **Web** (`src/app/components/suppr/photo-log-dialog.tsx` +
   `src/app/components/NutritionTracker.tsx`):
   - Same shape as mobile. `handlePhotoLogClick` always opens the
     dialog. `PhotoLogDialog` accepts the same two new props. The
     `LogSheet` photo entry no longer locks. The `TodaySnapShortcut`
     no longer locks. On 403, the `AiPaywallDialog` opens.

4. **Paywall copy** (`AiPaywallDialog` web + `AiPaywallSheet` mobile):
   - `photo_log` `FEATURE_COPY` updated to "Get unlimited photo logs
     with Pro" / "You've used all 5 of your free photo logs this
     week. Pro unlocks unlimited AI photo logging (100/day) — …" so
     the conversion moment names the experience the user just had.
     Both platforms ship identical strings.

## Why 5/week (not 1, not 3/day)

- **1 (Cal AI's number)** under-estimates how many photos a curious
  new user takes on day 1 — the typical evaluator pattern is "snap
  breakfast, then test it on lunch, then test a doubt-case (e.g. a
  takeaway photo)." A single shot frequently lands on a low-confidence
  case (poor lighting, complex plate) and the user concludes the
  feature doesn't work for them.
- **3/day** (PR #46's original calibration) ran out too quickly when
  evaluators came back the next morning to test breakfast — they hit
  the cap on day 1, churned, and never got the "second-day" usage
  signal that drives habit-formation.
- **5/week** = enough for a realistic week-long trial (snap a couple
  meals on day 1, two more later in the week, one wildcard) without
  giving the feature away. Specifically, evaluators get to experience
  the feature both on a clean plate AND on a doubt-case AND on a
  re-test, which is the loop monetisation-architect's spec
  prioritised.
- **5+/week** moves the paywall too far down the funnel and we lose
  the monetisation pressure that makes the taster work.

This is a calibration — re-visit on real funnel data once we have a
cohort week of post-launch numbers.

## Why rolling 7 days (not midnight in user TZ)

The shared `rateLimit` infra (`src/lib/server/rateLimit.ts`) runs
**Upstash sliding windows** when configured (production +
preview environments) and falls back to in-memory buckets in dev. Both
honour the `windowMs` param we pass.

A true "midnight in user TZ" reset would require either a separate
counter table keyed on the user's TZ-bucketed date or a Postgres
function that exposes the count to the route. Both add complexity
that's not worth shipping at v1 — a rolling 7-day window is fair,
predictable, and doesn't punish edge-case users (e.g. someone burning
all 5 at the end of a Friday and then wanting one more on Saturday
morning, an hour later).

If post-launch feedback shows users misreading the rolling window as
"calendar week" (e.g. "I should get more on Monday"), revisit with a
TZ-aware counter table.

### Sliding-window vs fixed-7d implementation note

We pass `windowMs: 7 * 24 * 60 * 60_000` to the existing
`rateLimit()` helper. When `UPSTASH_REDIS_REST_URL` is set the helper
constructs a `Ratelimit.slidingWindow(5, "604800 s")` limiter — every
request looks back 7 days from "now," so the user's quota refills
gradually as old taps age out (which matches how a human reads "5 per
week"). When Upstash isn't configured the helper falls back to an
in-memory fixed-7d window keyed by `(userId, ip)`. Dev parity is
sufficient — the production behaviour is sliding.

## Why a separate rate-limit bucket (not just lowering the existing 100/day cap)

The existing `api:photo-log` bucket caps Pro at 100/day. Dropping it
to 5 for free would punish Pro accidentally during the tier check.
Two buckets (one capped at 5/week for non-Pro, one capped at 100/day
for everyone Pro) drain independently:

- Non-Pro: free-quota bucket is the binding cap (5 < 100).
- Pro: bypasses free-quota; only the 100/day bucket applies.

Defence-in-depth bonus: an attacker who somehow defeats the
free-quota check still hits the Pro 100/day cap (and won't get the
freeQuotaRemaining signal that tells them they're being limited).

## Quota burn on upstream error

Known v1 limitation: the free-taster bucket increments **before** we
call OpenAI. This means a transient OpenAI 5xx, network drop, or
parse failure consumes one of the user's 5 weekly free logs without
returning useful data. We chose this over post-flight increment
because:

- The pre-flight increment closes the abuse vector "exhaust the
  bucket while ignoring 502s to drain our OpenAI budget" — without
  it, a determined attacker could call N times for free as long as
  they keep getting upstream errors.
- For legitimate users on flaky networks, a 1-in-5 burn is
  uncomfortable but recoverable (`/api/nutrition/photo-log` retries
  the OpenAI call once before returning 502). Real-world flake rates
  in our region are <1%.

If the cohort week shows user-visible friction on this (we'll see it
in a `ai_photo_log_burn_on_error` ratio query), revisit with a credit-
on-error counter table that decrements the bucket when the upstream
fails. Owner: monetisation-architect.

## Parity (web vs mobile)

Identical behaviour across both:

| Surface | Free user 0–4 logs | Free user 5 logs (6th attempt) | Pro |
|---|---|---|---|
| Photo entry icon (LogSheet) | Open dialog/sheet | Open dialog/sheet (then 403) | Open dialog/sheet |
| TodaySnapShortcut | Open dialog/sheet | Open dialog/sheet (then 403) | Open dialog/sheet |
| Lock badge on chip | none | none | none |
| In-flow caption | "X free logs remaining this week" | "X free logs remaining this week" → 403 | (none) |
| 403 routing | n/a | `AiPaywallSheet/Dialog { feature: "photo_log" }` with quota-exhausted copy | n/a |
| Server bucket | `api:photo-log:free-quota` (5/168h) | (returns 403, no Pro bucket touched) | `api:photo-log` (100/24h) |
| `freeQuotaRemaining` on 200 | integer 0–4 | n/a (403) | `null` |

Sync-enforcer carve-out: none needed; web + mobile are 1:1.

## Analytics

- `ai_photo_log_paywalled` — still fires at the gate. Semantics
  shifted from "first-tap" to "quota-exhausted." No event rename
  because dashboards already consume the existing name and the
  funnel measure (paywall-impressions per active free user) is
  unchanged in shape.
- `ai_paywall_sheet_viewed { feature: "photo_log" }` — fires on the
  AiPaywallSheet/Dialog mount as before.
- `ai_photo_log_started`, `ai_photo_log_committed` — unchanged.
- `paywall_viewed { from: "photo_log" }` — unchanged. The
  `PaywallViewedFrom` union already contains `"photo_log"`; the
  attribution wiring (`normalisePaywallFrom` on web `app/pricing/
  page.tsx` + mobile `apps/mobile/app/paywall.tsx`) already routes
  the `?from=photo_log` query into the right slice. The
  `paywallAttribution` test at `tests/unit/paywallAttribution.test.ts`
  pins this contract.

## Tests

- `tests/integration/photoLogRoute.test.ts` — 8 scenarios:
  unauthenticated, free-with-quota-remaining (passes gate),
  free-quota-exhausted (403), base-tier-treated-as-free,
  pro-bypasses-free-quota, pro-hits-100-cap (429), no
  `OPENAI_API_KEY`, non-multipart body. Pinned at
  `FREE_PHOTO_LOG_WEEKLY_LIMIT` so a future drift in the 5/week
  number fails CI at the rate-limit-call assertion.
- `tests/unit/photoLogDialogFreeTaster.test.tsx` — web dialog
  renders quota line for non-Pro, hides for Pro, defaults to Pro
  back-compat, hidden when `open=false`.
- `apps/mobile/tests/unit/photoLogSheetFreeTaster.test.tsx` —
  mobile sheet mirror of the same 5 render assertions plus a
  source-level pin on the `onUpgradeRequired` 403-handoff contract.
- `tests/unit/landingParity.test.tsx` and
  `tests/unit/paywallAttribution.test.ts` — unchanged but
  re-validated to ensure they stay green after the pricing-tier copy
  + paywall changes.

## Risks / follow-ups

- **Real funnel numbers** — calibrate the 5/week floor after one week
  of installs once we have a control vs hold-out cohort. Owner:
  monetisation-architect.
- **Quota burn on upstream error** — see "Quota burn on upstream
  error" above. Revisit with a credit-on-error counter table if
  cohort numbers show real friction.
- **Abuse vector — multi-account farming** — a determined free user
  could create N accounts to get 5N free logs/week. Per-IP cap on the
  same bucket would close this; not shipped at v1 because (a) we have
  one tester (memory: solo tester on TestFlight) and (b) the bucket
  key already includes IP via the `userId + ip` composition in
  `lib/server/rateLimit.ts`. Re-evaluate before broader release.
- **TZ-aware reset** — see "rolling 7 days" rationale above. Owner:
  product-lead, only if user feedback flags the window confusion.
