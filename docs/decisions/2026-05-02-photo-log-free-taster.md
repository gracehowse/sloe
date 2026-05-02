# Photo-log free taster — 3 free taps/day before the paywall

**Date:** 2026-05-02
**Area:** Monetisation / Mobile / Web / Funnels
**Status:** Resolved (shipped)
**Owners:** product-lead (call), monetisation-architect (review),
sync-enforcer (parity)

## Context

PR #17 (photo-log itemized) gated the entire flow on Pro tier. The
server (`app/api/nutrition/photo-log/route.ts:47-52`) returned 403
`upgrade_required` for any non-Pro user, and the mobile + web entry
points showed the AI paywall before the user could tap the camera even
once.

Cal AI's runaway growth model is built on giving every user one free
shot of the AI before asking for money. We have the better feature
— kcal ranges, add-on chips, USDA / Open Food Facts / FatSecret
verified nutrition — and we were gating it before the user could taste
it. Two final audits confirmed: gate the SECOND photo, not the first.

## Decision

**Free + Base users get 3 free photo logs per rolling 24h. The 4th
attempt returns 403 and routes to the in-flow AI paywall.**

Concretely:

1. **Server** (`app/api/nutrition/photo-log/route.ts`):
   - Removed the blanket `tier !== "pro"` gate.
   - Added a separate `rateLimit` bucket (`api:photo-log:free-quota`)
     with `limit: FREE_PHOTO_LOG_DAILY_LIMIT (= 3)` and `windowMs:
     24*60*60_000` for non-Pro users.
   - On exhaustion: returns 403 `upgrade_required` with
     `freeQuotaRemaining: 0`.
   - Pro users skip the free-quota bucket entirely; the existing
     `api:photo-log` 100/day bucket still applies.
   - Successful 200 responses include `freeQuotaRemaining: number |
     null` (null for Pro).

2. **Mobile** (`apps/mobile/components/PhotoLogSheet.tsx` +
   `apps/mobile/app/(tabs)/index.tsx`):
   - `handleOpenPhotoLog` no longer checks tier — always opens the
     sheet.
   - Photo-entry chip in `LogSheet` no longer renders a lock badge.
   - `PhotoLogSheet` accepts `userTier` + `onUpgradeRequired` props.
   - When `userTier !== "pro"`: renders a thin "X free logs remaining
     today" line under the sheet caption (optimistic
     `FREE_PHOTO_LOG_DAILY_LIMIT` until first response, then
     authoritative `freeQuotaRemaining`).
   - On 403: calls `onUpgradeRequired`, which closes the sheet and
     opens `AiPaywallSheet { feature: "photo_log" }`. The
     `ai_photo_log_paywalled` event still fires at the gate so existing
     funnels keep reporting; semantics shifted from "first-tap gate"
     to "quota-exhausted gate".

3. **Web** (`src/app/components/suppr/photo-log-dialog.tsx` +
   `src/app/components/NutritionTracker.tsx`):
   - Same shape as mobile. `handlePhotoLogClick` always opens the
     dialog. `PhotoLogDialog` accepts the same two new props. The
     LogSheet photo entry no longer locks. On 403, the
     `AiPaywallDialog` opens.

## Why 3/day (not 1, not 5)

- **1 (Cal AI's number)** under-estimates how many photos a curious
  new user takes on day 1 — the typical evaluator pattern is "snap
  breakfast, then test it on lunch, then test a doubt-case (e.g. a
  takeaway photo)." A single shot frequently lands on a low-confidence
  case (poor lighting, complex plate) and the user concludes the
  feature doesn't work for them.
- **5+** moves the paywall too far down the funnel and we lose the
  monetisation pressure that makes the taster work.
- **3** = breakfast, lunch, dinner. Covers a realistic first-day eval
  loop without giving away the feature outright.

This is a calibration — re-visit on real funnel data once we have a
week of post-launch numbers.

## Why rolling 24h (not midnight in user TZ)

The `rateLimit` infrastructure runs sliding windows on Upstash. A
true "midnight in user TZ" reset would require either a separate
counter table keyed on the user's TZ-bucketed date or a Postgres
function that exposes the count to the route. Both add complexity
that's not worth shipping at v1 — a rolling 24h is fair, predictable,
and doesn't punish edge-case users (e.g. someone burning all 3 at
11:55pm and then wanting one more at 00:05).

If post-launch feedback shows users misreading the 24h window as
"calendar day," revisit with a TZ-aware counter table.

## Why a separate rate-limit bucket (not just lowering the existing 100/day cap)

The existing `api:photo-log` bucket caps Pro at 100/day. Dropping it
to 3 for free would punish Pro accidentally during the tier check.
Two buckets (one capped at 3 for non-Pro, one capped at 100 for
everyone) drain independently:

- Non-Pro: free-quota bucket is the binding cap (3 < 100).
- Pro: bypasses free-quota; only the 100/day bucket applies.

Defence-in-depth bonus: an attacker who somehow defeats the free-quota
check still hits the 100/day cap.

## Parity (web vs mobile)

Identical behaviour across both:

| Surface | Free user 0-2 logs | Free user 3 logs (4th attempt) | Pro |
|---|---|---|---|
| Photo entry icon | Open dialog/sheet | Open dialog/sheet | Open dialog/sheet |
| In-flow caption | "X free logs remaining today" | "X free logs remaining today" (then 403) | (none) |
| Lock badge on chip | none | none | none |
| 403 routing | n/a | `AiPaywallSheet/Dialog { feature: "photo_log" }` | n/a |
| Server bucket | `api:photo-log:free-quota` (3/24h) | (returns 403) | `api:photo-log` (100/24h) |

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

## Tests

- `tests/integration/photoLogRoute.test.ts` — six scenarios:
  unauthenticated, free-with-quota-remaining, free-quota-exhausted,
  base-tier-treated-as-free, pro-bypasses-free-quota, pro-hits-100-cap.
- `tests/unit/photoLogDialogFreeTaster.test.tsx` — web dialog
  renders quota line for non-Pro, hides for Pro, defaults to Pro
  back-compat.
- `apps/mobile/tests/unit/photoLogSheetFreeTaster.test.tsx` —
  mobile sheet mirror of the same five render assertions plus a
  source-level pin on the `onUpgradeRequired` route.

## Risks / follow-ups

- **Real funnel numbers** — calibrate the 3/day floor after one week
  of installs once we have a control vs hold-out cohort. Owner:
  monetisation-architect.
- **Abuse vector — multi-account farming** — a determined free user
  could create N accounts to get 3N free logs/day. Per-IP cap on the
  same bucket would close this; not shipped at v1 because (a) we have
  one tester (memory: solo tester on TestFlight) and (b) the bucket
  key already includes IP via the `userId + ip` composition in
  `lib/server/rateLimit.ts`. Re-evaluate before broader release.
- **TZ-aware reset** — see "rolling 24h" rationale above. Owner:
  product-lead, only if user feedback flags the window confusion.
