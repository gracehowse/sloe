# API Reference

**Audience:** Developers

All API routes are Next.js Route Handlers at `app/api/`.

## Route index

Canonical implementation paths live under `app/api/**/route.ts`. Detail for heavily used routes is below; every row is implemented.

| Path | Methods | Auth | Purpose |
|------|---------|------|---------|
| `/api/recipe-import` | POST | Bearer (see route) | URL / social recipe import (structured-schema extraction + flagged ingredients) |
| `/api/recipe-import/image` | POST | Bearer + tier | Multipart image → structured recipe (Claude vision, OpenAI fallback) with per-ingredient parse confidence; Free tier **403** |
| `/api/nutrition/scan-label` | POST | Bearer | Multipart nutrition-label photo → per-100g macros (vision OCR) + Atwater plausibility flag; pre-fills custom-food form |
| `/api/nutrition/verify-recipe` | POST | Bearer | Ingredient verification pipeline |
| `/api/recipes/claim-official` | POST | Bearer + origin | Owner marks published recipe macros official (service-role write after JWT ownership + eligibility checks) |
| `/api/nutrition/voice-log` | POST | Bearer + **Pro** | Transcript → parsed items; **403** if not Pro; daily rate limit |
| `/api/nutrition/photo-log` | POST | Bearer + **Pro** | Multipart photo → items; **403** if not Pro |
| `/api/nutrition/adaptive-tdee` | GET | Bearer | Static vs adaptive TDEE snapshot for user |
| `/api/nutrition/coach` | POST | Bearer | "What to eat next" — AI-ranked from the user's own library, deterministic fallback |
| `/api/nutrition/coach-day-narrative` | POST | Bearer + origin | Coach screen "Today's read" — AI phrasing Pro-only (template for Free, never 403), template fallback |
| `/api/nutrition/coach-ask` | POST | Bearer + origin | Coach screen "Ask the coach" chip answers — AI Pro-only (template for Free, never 403), template fallback |
| `/api/nutrition/digest-narrative` | POST | Bearer | Grounded weekly-digest narrative (coach voice), deterministic template fallback |
| `/api/nutrition/analyze-recipe` | POST | Bearer | Edamam full-recipe analysis |
| `/api/usda/search` | GET | Bearer | USDA FDC search |
| `/api/usda/food` | GET | Bearer | USDA FDC food detail |
| `/api/edamam/search` | GET | Bearer | Edamam parser search (`q`, optional `mode`) |
| `/api/edamam/food` | GET | Bearer | Edamam `/nutrients` food detail (per-100g micros) |
| `/api/off/barcode` | GET | Bearer (see route) | OFF barcode lookup |
| `/api/barcode-mapping` | GET/POST | See route | Community barcode mapping |
| `/api/stripe/checkout` | POST | Bearer | Checkout session |
| `/api/stripe/webhook` | POST | Stripe signature | Subscription webhooks |
| `/api/account/delete` | DELETE | Bearer + origin | Full account deletion (service role) |
| `/api/household` | GET, POST | Bearer | Household read / owner create-reset |
| `/api/household/join` | POST | Bearer | Join via invite code |
| `/api/household/leave` | POST | Bearer | Leave household |
| `/api/household/meals` | GET, POST, DELETE | Bearer | Shared household meals |
| `/api/user-foods` | GET, POST | Bearer | Community custom foods search / submit |
| `/api/user-foods/vote` | POST | Bearer | Vote on pending food |
| `/api/custom-foods` | POST | Bearer + origin | Create a personal custom food; server-side Atwater plausibility gate (**422** unless `acknowledgeImplausible`) — ENG-1420 |
| `/api/push/weekly-recap` | POST | `X-Cron-Secret` | Cron fan-out to Expo push (mobile) + Web Push (browser) |
| `/api/push/weigh-in-reminder` | POST | `X-Cron-Secret` | ENG-955 hourly cron — gentle, opt-in weigh-in reminder (anti-nag); default-ON `weigh_in_reminder_v1` (ENG-1279) |

## Recipe Import

### `POST /api/recipe-import`

Import a recipe from any URL (recipe site, Instagram, TikTok, Pinterest).

**Rate limit:** 20 requests/minute per IP

**Request:**
```json
{
  "url": "https://downshiftology.com/recipes/chicken-stir-fry/"
}
```

**Response (success):**
```json
{
  "ok": true,
  "recipe": {
    "title": "Chicken Stir Fry",
    "description": "...",
    "ingredients": ["1 lb chicken breast", "2 tbsp soy sauce", ...],
    "instructions": ["Step 1...", "Step 2..."],
    "servings": 4,
    "imageUrl": "https://...",
    "sourceUrl": "https://...",
    "sourceName": "Downshiftology",
    "calories": 350,
    "protein": 35,
    "carbs": 20,
    "fat": 14,
    "fiberG": 3.2,
    "sugarG": 5.1,
    "sodiumMg": 680,
    "siteNutrition": { ... },
    "ingredientMacros": [
      {
        "name": "chicken breast",
        "amount": "1",
        "unit": "lb",
        "calories": 445,
        "protein": 93,
        "carbs": 0,
        "fat": 6,
        "fiberG": 0,
        "source": "USDA"
      },
      ...
    ],
    "primarySource": "USDA"
  }
}
```

**Error responses:**
- `400` — Missing URL
- `422` — URL didn't return HTML or no Recipe JSON-LD found
- `429` — Rate limited
- `502` — Fetch failed (site blocked/down)
- `504` — Timeout (20s limit)

**Behaviour:**
- Pinterest URLs are resolved to the actual recipe source
- Instagram/TikTok URLs use OpenAI to parse captions (requires `OPENAI_API_KEY`)
- HTML entities are decoded in all text fields
- `recipeYield` handles arrays and ranges (e.g. `["4 servings"]`, `"4-6"`)
- Site-declared nutrition is preserved when available; API estimates are used only as fallback
- Meal type is auto-classified from title/ingredients/calories

---

## Nutrition Verification

### `POST /api/nutrition/verify-recipe`

Verify ingredient macros against USDA, OFF, and FatSecret databases.

**Rate limit:** 10 requests/minute per IP

**Request:**
```json
{
  "ingredients": [
    { "name": "chicken breast", "amount": "2", "unit": "breast" },
    { "name": "broccoli", "amount": "200", "unit": "g" }
  ],
  "servings": 4,
  "provider": "auto"
}
```

**Response:**
```json
{
  "ok": true,
  "verified": [
    {
      "input": { "name": "chicken breast", "amount": "2", "unit": "breast" },
      "resolved": { "name": "chicken breast meat raw", "amount": "2", "unit": "breast" },
      "matchedName": "Chicken, breast, boneless, skinless, raw",
      "confidence": 0.85,
      "source": "USDA",
      "macros": { "calories": 660, "protein": 124, "carbs": 0, "fat": 14, "fiberG": 0, "sugarG": 0, "sodiumMg": 152 }
    },
    ...
  ],
  "totals": { ... },
  "perServing": { ... },
  "primarySource": "USDA",
  "sourceCounts": { "USDA": 2 }
}
```

---

## USDA Food Search

### `GET /api/usda/search?q={query}`

Search USDA FoodData Central.

**Rate limit:** 60 requests/minute per IP

**Response:**
```json
{
  "ok": true,
  "hits": [
    {
      "fdcId": 171077,
      "description": "Chicken, breast, boneless, skinless, raw",
      "dataType": "SR Legacy",
      "calories": 120,
      "protein": 22.5,
      "fat": 2.6,
      "carbs": 0,
      "servingSize": 230,
      "servingSizeUnit": "g",
      "householdServingFullText": "1 SANDWICH",
      "foodPortions": [
        { "gramWeight": 120, "amount": 1, "portionDescription": "1 cup, sliced" }
      ]
    }
  ]
}
```

`servingSize` / `servingSizeUnit` / `householdServingFullText` are present on Branded foods; `foodPortions[]` is present on Foundation / Survey / SR Legacy. Both are optional. The display layer uses them to show a per-portion primary line alongside the /100g reference (TestFlight `APo0qS9vcFvmBJEJJ_-61YA`, 2026-04-19).

---

## USDA Food Detail

### `GET /api/usda/food?fdcId={id}`

Get full nutrition data and portion options for a specific USDA food.

**Rate limit:** 60 requests/minute per IP

**Response:**
```json
{
  "ok": true,
  "fdcId": 171077,
  "description": "Chicken, breast, boneless, skinless, raw",
  "macrosPer100g": {
    "calories": 120,
    "protein": 22.5,
    "carbs": 0,
    "fat": 2.6,
    "fiberG": 0,
    "sugarG": 0,
    "sodiumMg": 54
  },
  "portions": [
    { "label": "1 breast", "gramWeight": 174, "amount": 1 },
    { "label": "1 RACC", "gramWeight": 114, "amount": 1 }
  ]
}
```

**Cache + account-level quota guard (ENG-1117):** like `/api/usda/search`, this
on-tap detail fetch shares USDA FDC's account-wide ~1,000/hr key budget, so it is
quota-counted (it was previously unguarded). Flow:

1. **Per-`fdcId` cache hit** → returns the stored detail payload with `cached: true`,
   no USDA call, **no quota spend**. Repeat taps of the same food are free. Key:
   `pm_vdc:usda:{fdcId}`, 24h TTL (`getCachedDetail`/`setCachedDetail` in
   `src/lib/server/vendorSearchCache.ts`).
2. **Account-wide quota exhausted** → skips USDA and returns the same degraded
   envelope shape the search route uses: `{ ok: true, fdcId, degraded: true,
   degradedReason: "quota_exhausted" }` — never an unguarded vendor call.
3. **Cache miss + quota OK** → `consumeQuota("usda")` immediately before the live
   call, then caches the genuine success. Upstream failures (`502`) and `not_found`
   (`404`) are **not** cached.

**Errors:** `401`; `429`; `400` invalid_fdcId; `404` not_found; `502` usda_failed; `503` when USDA not configured.

---

## Stripe

### `POST /api/stripe/checkout`

Create a Stripe Checkout session for subscription.

**Auth required:** Yes (Bearer token in Authorization header)

**Request:**
```json
{
  "plan": "base"
}
```

### `POST /api/stripe/webhook`

Handle Stripe webhook events (subscription created/updated/deleted).

**Auth:** Stripe webhook signature verification

---

## Barcode

### `GET /api/off/barcode?code={barcode}`

Look up a product by barcode via Open Food Facts.

### `GET/POST /api/barcode-mapping`

Community barcode correction mapping.

---

## Push — Weekly recap fan-out

### `POST /api/push/weekly-recap`

Server-to-server cron endpoint that fans out the weekly recap push to
every opted-in user on **whatever delivery rail(s) they have** — a mobile
Expo push token (APNs/FCM via the Expo push API) and/or a browser Web
Push subscription (VAPID via the `web-push` library). Shipped 2026-04-19
(Expo) — see `docs/testflight-feedback/resolved.md` entry "Server-side
weekly recap push fan-out" for rationale.

**ENG-748 #7 (2026-05-27) — web-only subscribers now covered.** The route
used to filter the profile select on a non-null `expo_push_token`, so
users who only subscribed to Web Push in the browser (no app install)
never received the recap even though they opted in via the same
`weekly_recap_push_enabled` flag. The select no longer filters on the
token; the rail is now chosen per-user after cross-referencing
`web_push_subscriptions`. A user with both rails gets the recap on both
and is stamped once. Web Push uses the same title/body as the mobile push
and deep-links to `/home?view=progress`.

**Auth:** shared-secret header, NOT user auth.

- Header: `X-Cron-Secret: <SUPPR_CRON_SECRET>` — must match
  `process.env.SUPPR_CRON_SECRET` exactly. `401` on missing/wrong.
- No Supabase session needed. Vercel crons are configured in
  `vercel.json` at the repo root; each cron invocation must carry the
  secret header.

**Query parameters:**

- `weekStartDay` *(optional)* — `monday` | `sunday`. When present, the
  fan-out is filtered to profiles matching that cohort. Any other value
  is ignored and the route fans out to both cohorts. The shipped Vercel
  config runs one cron per cohort at 18:00 UTC on their respective
  end-of-week days (Sunday for Monday-start, Saturday for Sunday-start).

**Behaviour:**

- Selects `profiles` where `weekly_recap_push_enabled = true`, capped at
  5000 rows per invocation. (ENG-748 #7: the `expo_push_token IS NOT NULL`
  filter was removed so web-only subscribers survive the select.)
- Skips rows whose `last_weekly_recap_push_sent_at` is within the last
  6 days (dedupe across back-to-back cron runs).
- Cross-references `web_push_subscriptions` for the candidate set, then
  drops any candidate with **neither** rail (no Expo token AND no web
  subscription) before paying for the per-user recap compute.
- **Mobile rail:** fans out via the Expo push API in batches of 100, with
  a single retry on 5xx / network failure. No retry on 4xx. If every
  eligible user is web-only the Expo POST is skipped entirely (not an
  error).
- **Web rail:** sends the identical title/body to every browser
  subscription via `web-push` (VAPID). `404`/`410` responses mark a
  subscription dead and the row is deleted. If VAPID env is unset the web
  rail short-circuits (`webVapidUnset`) and those users are NOT stamped
  so the next cron retries once keys are configured.
- For every user who got a real delivery on **either** rail, stamps
  `last_weekly_recap_push_sent_at = now()` (deduped union of the two
  rails). Stamping after the web fan-out is what stops web-only users
  being re-pushed every hourly cron inside their tz window.
- For every Expo ticket returned with
  `details.error === "DeviceNotRegistered"` the route nulls the offending
  `profiles.expo_push_token` so we stop pushing to dead installs.
- Per-user outcomes (`sent` / `deregistered` / `ticket_error` /
  `send_failed` / `invalid_token`) are emitted as
  `weekly_recap_push_attempted` for both rails — no delivery failure is
  silent.
- Copy is aligned with the mobile local-push fallback in
  `apps/mobile/lib/weeklyRecapPush.ts` — title `"Your week in Suppr"`,
  body composed per-user from the recap, deep link `/progress` (mobile) /
  `/home?view=progress` (web).

**Response (success):**

```json
{
  "ok": true,
  "attempted": 128,
  "succeeded": 124,
  "deregistered": 3
}
```

(`attempted - succeeded - deregistered` covers rows that came back with
other `status: "error"` tickets — e.g. `MessageTooBig` — which are not
stamped so the next cron re-tries them.)

**Error responses:**

- `401` — missing/wrong `X-Cron-Secret`
- `503` — `SUPPR_CRON_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` unset on
  the server
- `500` — Supabase select failed
- `502` — Expo push API failed after the single retry

**Env vars (production):**

- `SUPPR_CRON_SECRET` — 32-byte random value, shared with Vercel cron
  config. Generate with `openssl rand -hex 32`.
- `SUPABASE_SERVICE_ROLE_KEY` — existing server-only key. The route
  uses service-role access because the fan-out needs to read every
  opted-in profile (RLS would hide other users' rows) and to write
  back to `profiles` without a user session.

### `POST /api/push/weigh-in-reminder`

ENG-955 — gentle, **opt-in** weekly weigh-in reminder push (anti-nag).
Mirrors the weekly-recap delivery rail (same `X-Cron-Secret` auth, same
service-role select, same Expo + Web Push fan-out, same DeviceNotRegistered
/ dead-endpoint cleanup, same 5000-row cap, same structured log line) but
fires a calm, trend-framed nudge instead of the recap. **Gated behind the
`weigh_in_reminder_v1` flag (default-ON since 2026-06-30, ENG-1279)** — the cron only ever pushes users
who toggled the feature ON in Settings, and the toggle UI only renders when
the flag is enabled.

**Auth:** shared-secret header — `X-Cron-Secret: <SUPPR_CRON_SECRET>`,
`401` on missing/wrong, `503` when unset. Configured as an **hourly** Vercel
cron (`0 * * * *` in `vercel.json`) because the user's chosen weigh-in hour
can be any of 24.

**Eligibility (the consequential, headless-tested core
`src/lib/push/weighInReminder.ts`):**

- **Opt-in gate** — the user must have `notification_prefs.weighInReminder.enabled === true`. No pref → skipped.
- **Window gate** — fires only when the user's *local* time is their chosen weekday + hour (DST-correct via IANA; unrecognised/null tz falls back to UTC, never silently dropped).
- **Anti-nag #1** — SKIP if a weigh-in already exists this period (any non-zero entry in `weight_kg_by_day` in the trailing 7-day window ending on the user's local today). No reminder lands on top of a fresh weigh-in.
- **Anti-nag #2** — dedupe via `last_weigh_in_reminder_sent_at`: never re-fire inside a 6-day window (protects against the hourly cron double-firing inside the chosen hour, and against a tz shift mid-week).

**Behaviour:** selects `profiles` with a non-null `notification_prefs`
(capped 5000/invocation), applies the four gates in-memory, cross-references
`web_push_subscriptions`, drops candidates with neither rail, fans out the
warm copy on each rail, then stamps `last_weigh_in_reminder_sent_at` for
every user delivered on **either** rail. DeviceNotRegistered tickets null
the Expo token; `404`/`410` web subscriptions are deleted. Per-user outcomes
emit `weigh_in_reminder_push_attempted` (`sent` / `deregistered` /
`ticket_error` / `send_failed`, with `rail`) — no delivery failure is silent.

**Copy (warm, never a streak/badge/threat):** title `"Weekly weigh-in"`,
body `"Ready for a quick weigh-in? Mornings give the steadiest trend."`,
deep link `/progress` (mobile) / `/home?view=progress` (web).

**Pref + schema:** the opt-in + cadence (`{ enabled, weekday, hour }`) live
inside the freeform `profiles.notification_prefs` JSONB under the
`weighInReminder` key (no new column). The only schema change is the
`last_weigh_in_reminder_sent_at timestamptz` dedupe stamp
(`supabase/migrations/20260702120500_profiles_weigh_in_reminder_dedupe.sql`).

**Response (success):** `{ ok: true, attempted, succeeded, deregistered }`.
**Errors:** `401` (auth), `503` (secret/service-role unset), `500` (select
failed), `502` (Expo API failed after retry).

---

## Nutrition — Voice log

### `POST /api/nutrition/voice-log`

**Auth:** Bearer session required. **Tier:** **Pro only** — `403` with `upgrade_required` for `free` / `base`.

**Rate limit:** 100 requests / 24h per user (`voice_log_${userId}`).

**Body:** JSON `{ transcript: string }`.

**Errors:** `401` unauthorized; `403` upgrade_required; `429` rate_limited; `400` invalid_body / missing_transcript; `503` `openai_not_configured` when `OPENAI_API_KEY` unset.

**Runtime:** `nodejs`. Implementation: [app/api/nutrition/voice-log/route.ts](../../app/api/nutrition/voice-log/route.ts).

---

## Nutrition — Photo log

### `POST /api/nutrition/photo-log`

**Auth:** Bearer. **Tier:** **Pro only** — same pattern as voice-log.

**Body:** `multipart/form-data` (image file).

**Errors:** `401`; `403` upgrade_required; `429` rate_limited; `400` expected_multipart / invalid image; `503` OpenAI not configured.

**Runtime:** `nodejs`. Implementation: [app/api/nutrition/photo-log/route.ts](../../app/api/nutrition/photo-log/route.ts).

---

## Nutrition — Adaptive TDEE

### `GET /api/nutrition/adaptive-tdee`

**Auth:** Bearer. Uses **service-role** client scoped to the authenticated `userId`.

**Returns:** Static Mifflin–St Jeor TDEE vs adaptive TDEE, active choice, confidence (see route JSON).

**Errors:** `401`; `404` profile_not_found; `503` server_misconfigured / missing service role.

Implementation: [app/api/nutrition/adaptive-tdee/route.ts](../../app/api/nutrition/adaptive-tdee/route.ts).

---

## Nutrition — Coach ("what to eat next")

### `POST /api/nutrition/coach`

The north-star engine. Ranks the user's **own** saved library against the
macros they have left and returns a small set of suggestions, each with a
one-line WHY.

**Contract — the LLM never invents food or numbers.** The deterministic
scorer (`src/lib/nutrition/mealCoach.ts` → `assembleCandidates`, built on
`northStarSuggestion.ts`) assembles + ranks the candidates from verified
data. Only that pre-scored, pre-filtered set is handed to the model
(Claude Haiku), which may **only** re-order it and phrase a grounded
reason for each. The model's output is schema-validated
(`parseCoachRanking`): invented ids are dropped, duplicates collapsed,
reasons that make health/diet-culture claims or run over-length are
rejected. `applyCoachRanking` folds the model's ranking back onto **our**
candidates — numbers stay ours, no candidate is ever lost.

**Auth:** Bearer. Uses **service-role** client scoped to the authenticated
`userId` (reads `saves` + `recipes`).

**Request body:**
```json
{
  "remaining": { "calories": 1200, "protein": 60, "carbs": 120, "fat": 40, "dailyCalorieTarget": 2000 },
  "slot": "dinner",
  "excludeIds": ["..."],
  "recentlySuggestedIds": ["..."],
  "limit": 4
}
```

**Returns:** `{ ok: true, candidates: CoachCandidate[], source: "ai" | "deterministic" }`.
`candidates` is empty when no recipe fits the remaining budget (not an
error — the surface shows its no-fit state).

**Fallback (surface never empties):** any AI failure — provider error,
timeout, budget exceeded (`AiBudgetExceededError`), unparseable output, or
the `kill_meal_coach_ai` flag — returns the deterministic candidate order
with `source: "deterministic"`. The AI call is also skipped when fewer than
two candidates fit (nothing to re-rank).

**Errors:** `401`; `400` invalid_body / invalid_remaining; `429`
rate_limited (120/hr); `503` server_misconfigured.

Implementation: [app/api/nutrition/coach/route.ts](../../app/api/nutrition/coach/route.ts).
Client hooks: [src/lib/today/useCoach.ts](../../src/lib/today/useCoach.ts) (web) ·
[apps/mobile/lib/useCoach.ts](../../apps/mobile/lib/useCoach.ts) (mobile).

### `POST /api/nutrition/coach-day-narrative`

"Today's read" paragraph for the full Coach screen (`/coach` on web,
`suppr:///coach` on mobile — behind `coach_screen_v1`). The client passes
its **already-computed** day totals; the model may only phrase over those
facts (`buildCoachDayFacts` → `parseCoachDayNarrative` schema validation —
same grounding contract as the digest narrative).

**Auth:** Bearer + origin check. **Tiering (ENG-1292):** the AI phrasing is
Pro-only, server-enforced. Free/Base users get the grounded template
narrative in the **same 200 response shape** with `source: "template"` —
never a 403 (the Coach screen itself is free; only the AI voice is Pro).

**Request body:** `{ dateLabel, caloriesLogged, calorieTarget,
proteinLogged, proteinTarget, mealsLoggedCount, nextMealSlot }`
(`dateLabel` required).

**Returns:** `{ ok: true, narrative: string, source: "ai" | "template" }`.

**Fallback (never empties):** kill flag `kill_coach_day_narrative_ai`,
non-Pro tier, provider error, budget exceeded, or off-contract output →
the deterministic template narrative, still `200`.

**Analytics (ENG-1288):** `coach_day_narrative_api_completed` on every 200
with `{ latency_ms, source: "ai" | "template" | "error", tier }` —
`"error"` = AI attempted but failed, template shipped.

**Errors:** `401`; `400` invalid_body / missing_date_label; `429`
rate_limited (90/hr).

Implementation: [app/api/nutrition/coach-day-narrative/route.ts](../../app/api/nutrition/coach-day-narrative/route.ts).

### `POST /api/nutrition/coach-ask`

Bounded "Ask the coach" chip answers on the Coach screen — a **closed set
of chip prompts** (`COACH_ASK_CHIPS`), not free-text chat. Grounded in the
same day facts as the narrative plus the current top coach candidate.

**Auth:** Bearer + origin check. **Tiering (ENG-1292):** AI answers are
Pro-only, server-enforced; Free/Base get the grounded template answer,
same 200 shape, `source: "template"` — never a 403.

**Request body:** `{ chipId, dateLabel, caloriesLogged, calorieTarget,
proteinLogged, proteinTarget, mealsLoggedCount, nextMealSlot,
topCandidateTitle, topCandidateCalories, topCandidateProtein }`
(`chipId` must be a known chip id; `dateLabel` required).

**Returns:** `{ ok: true, answer: string, source: "ai" | "template" }`.

**Fallback (never empties):** kill flag `kill_coach_ask_ai`, non-Pro tier,
provider error, budget exceeded, or off-contract output → the
deterministic template answer, still `200`.

**Analytics (ENG-1288):** `coach_ask_api_completed` on every 200 with
`{ latency_ms, source: "ai" | "template" | "error", tier }`.

**Errors:** `401`; `400` invalid_body / invalid_chip / missing_date_label;
`429` rate_limited (60/hr).

Implementation: [app/api/nutrition/coach-ask/route.ts](../../app/api/nutrition/coach-ask/route.ts).

---

## Nutrition — Digest narrative

### `POST /api/nutrition/digest-narrative`

Takes the already-computed weekly-digest payload and returns a warm 2–3
sentence coach narrative — including the adaptive-TDEE move story when the
maintenance estimate changed this week.

**Strict grounding contract.** The model receives **only** computed facts
(`buildNarrativeFacts` in `src/lib/nutrition/digestNarrative.ts`) and is
instructed to invent no numbers and make no claims. Output is
schema-validated (`parseNarrative`): any multi-digit number not present in
the facts, any banned health/diet-culture phrase, or unparseable/empty
output is rejected. The maintenance-move *reason* is a closed enum mapped
to a fixed honest phrase server-side, so the physiological framing is
never the model's to invent.

**Auth:** Bearer.

**Request body:**
```json
{
  "weekLabel": "May 5 – May 11",
  "daysLogged": 5,
  "avgCalories": 1940,
  "targetCalories": 2100,
  "proteinOnTargetDays": 3,
  "closestDayLabel": "Tuesday",
  "maintenanceMove": { "direction": "rose", "previousKcal": 2200, "newKcal": 2350, "reason": "ate_more_held_weight" }
}
```

**Returns:** `{ ok: true, narrative: string, source: "ai" | "template" }`.

**Fallback (surface never empties):** any AI failure — provider error,
budget exceeded, off-contract output, or the `kill_digest_narrative_ai`
flag — returns the deterministic `buildTemplateNarrative` text (grounded in
the same facts) with `source: "template"`.

**Errors:** `401`; `400` invalid_body / missing_week_label; `429`
rate_limited (60/hr).

Implementation: [app/api/nutrition/digest-narrative/route.ts](../../app/api/nutrition/digest-narrative/route.ts).

---

## Nutrition — Analyze recipe (Edamam)

### `POST /api/nutrition/analyze-recipe`

**Auth:** Bearer. **Requires** Edamam env (`hasEdamamConfig()`).

**Body:** JSON `{ ingredientLines: string[], servings?: number, title?: string }`.

**Rate limit:** 5/min per IP prefix `api:analyze-recipe`.

**Errors:** `401`; `503` not_configured; `429` rate_limited; `400` validation failures.

Implementation: [app/api/nutrition/analyze-recipe/route.ts](../../app/api/nutrition/analyze-recipe/route.ts).

---

## Recipe import — Image

### `POST /api/recipe-import/image`

**Auth:** Bearer. **Tier:** `free` → **403** `pro_required` (Base/Pro allowed).

**Body:** `multipart/form-data` (`image`, optional `sourceUrl` / `sourceName`). **Rate limit:** 15/min per user.

Extraction runs through the **structured recipe contract** (`src/lib/recipe-import/structuredRecipeSchema.ts`, 2026-06-11): the model returns ingredients split into `quantity` / `unit` / `name` / `prep` with a per-ingredient parse `confidence` (0–1). Lines below the threshold (0.6) are returned in `flaggedIngredients` (`{ name, raw, confidence }[]`) for the import review/verify UI — never silently guessed or dropped. The flat `ingredients[]` (for the existing `verifyIngredients` nutrition pipeline) and `nutrition` block are unchanged. Response also carries `servings`, `prepTimeMin`, `cookTimeMin`.

**Errors:** `401`; `403` pro_required; `429`; `400` expected_multipart / invalid_body; `502` unparseable_model_output; `503` AI not configured.

Implementation: [app/api/recipe-import/image/route.ts](../../app/api/recipe-import/image/route.ts).

### `POST /api/nutrition/scan-label`

**Auth:** Bearer. **Body:** `multipart/form-data` (`image`, optional `barcode`). **Rate limit:** 30/day per user.

Reads a nutrition-label photo via vision OCR (Claude preferred, OpenAI fallback) and resolves to **per-100g** macros (scaling from per-serving when only that column is present). The resolved macros run through the shared Atwater plausibility gate (`checkMacroPlausibility`) before returning: an OCR mis-read (kcal disagreeing with the macros, out-of-range, single-macro) sets `implausible: true`, `plausibilityReason`, and forces `confidence: "low"` — flagged, never silently accepted. The custom-food form (web + mobile) pre-fills from this and warns the user to double-check before saving; the form stays the source of truth.

**Response (ok):** `{ ok, name, calories, protein, carbs, fat, fiberG, sugarG, sodiumMg, saturatedFatG, servingSizeG, confidence, implausible, plausibilityReason }` (all macros per-100g).

**Errors:** `401`; `429`; `400` expected_multipart / invalid_body / missing_image; `413` file_too_large; `415` image_unreadable; `422` label_unreadable; `502` model_unparseable; `503` AI not configured / kill switch.

Implementation: [app/api/nutrition/scan-label/route.ts](../../app/api/nutrition/scan-label/route.ts).

---

## Edamam search

### `GET /api/edamam/search?q=&mode=`

**Auth:** Bearer. **Query:** `q` required (non-empty); `mode` = `foods` (default) or `meals`.

**Rate limit:** 30/min.

**Errors:** `401`; `400` missing_q; `429`; `503` when Edamam not configured.

Implementation: [app/api/edamam/search/route.ts](../../app/api/edamam/search/route.ts).

---

## Edamam food detail

### `GET /api/edamam/food?foodId={id}`

**Auth:** Bearer. **Query:** `foodId` required (non-empty). On-tap detail fetch
(ENG-738) that calls Edamam's `/nutrients` endpoint to populate the full per-100g
micronutrient panel for an Edamam search hit.

**Response (ok):** `{ ok: true, foodId, microsPer100g? }` — `microsPer100g` omitted
when Edamam publishes no extra panel for the food.

**Cache + account-level quota guard (ENG-1117):** the `/nutrients` detail call
counts against Edamam's **same** account-wide 1,000/day free-tier ceiling as
`/api/edamam/search` (it was previously unguarded — detail fetches alone could blow
the daily cap at viral scale). Same flow as `/api/usda/food`:

1. **Per-`foodId` cache hit** → returns the stored micro panel with `cached: true`,
   no Edamam call, **no quota spend**. Key: `pm_vdc:edamam:{foodId}`, 24h TTL.
2. **Account-wide quota exhausted** → returns `{ ok: true, foodId, degraded: true,
   degradedReason: "quota_exhausted" }` — never an unguarded vendor call.
3. **Cache miss + quota OK** → `consumeQuota("edamam")` immediately before the live
   call, then caches the genuine success (an empty panel is a cacheable stable fact;
   an upstream failure is **not** cached).

**Errors:** `401`; `429`; `400` invalid_foodId; `503` when Edamam not configured.

Implementation: [app/api/edamam/food/route.ts](../../app/api/edamam/food/route.ts).

---

## Household

**Shared notes:** Service role + `assertOrigin` where applicable; responses gate member targets via `share_targets` (see `GET /api/household` docstring).

### `GET /api/household`

**Auth:** Bearer. Returns `{ ok, household }` — `household` may be `null`.

### `POST /api/household`

**Auth:** Bearer (owner flows — invite rotation, create). **`assertOrigin`** runs first (same pattern as other mutating routes). See route for payload branches (`name`, `rotateInvite`).

### `POST /api/household/join`

**Auth:** Bearer. Invite code join; rate-limit guarded. Implementation: [app/api/household/join/route.ts](../../app/api/household/join/route.ts).

### `POST /api/household/leave`

**Auth:** Bearer. Member or owner leave semantics. [app/api/household/leave/route.ts](../../app/api/household/leave/route.ts).

### `GET|POST|DELETE /api/household/meals`

**Auth:** Bearer. Shared meals CRUD; `DELETE` includes IDOR guards (see integration tests).

---

## Recipe claim (owner official macros)

### `POST /api/recipes/claim-official`

**Auth:** Bearer + **origin** check (`assertOrigin`). **Service role** required on server.

Owner-only path to flip a published community recipe to macros-confirmed (`content_origin='claimed'`, `is_verified=true`, claim audit row). The handler resolves the caller from the Supabase session/JWT, loads the recipe with the service-role client, and asserts `recipes.author_id === userId` in-route — never from the request body.

**Rate limit:** 10 requests/hour per user

**Request:**
```json
{ "recipeId": "uuid" }
```

**Eligibility (422):** published recipe with `source_url`, at least one ingredient, every ingredient verified, not already claimed by another owner.

**Responses:**
- **200** `{ ok: true, recipeId, claimed: true }` — newly claimed or idempotent retry (`alreadyClaimed: true` when already claimed by caller)
- **404** `{ ok: false, error: "not_found" }` — recipe missing or not owned by caller
- **409** `{ ok: false, error: "already_claimed" }` — claimed by another owner
- **422** `{ ok: false, error: "<blocker>" }` — eligibility failure (`not_public`, `missing_source`, `no_ingredients`, `unverified_ingredients`, etc.)

Implementation: [app/api/recipes/claim-official/route.ts](../../app/api/recipes/claim-official/route.ts). Shared eligibility: [src/lib/recipes/officialRecipeClaim.ts](../../src/lib/recipes/officialRecipeClaim.ts). UI gated behind `official_recipe_claim_v1`.

---

## User foods (community catalog)

### `GET /api/user-foods?q=&limit=`

**Auth:** Bearer. Service-role read of verified / community-visible `user_foods` rows. Min query length 2.

### `GET /api/user-foods?mine=1&limit=`

**Auth:** Bearer. Lists the caller's own barcode contributions for Settings withdrawal surfaces. Returns owner rows only (`submitted_by = auth.uid()`).

### `POST /api/user-foods`

**Auth:** Bearer. Submit a new community food (barcode + macros); validation and plausibility checks.

### `DELETE /api/user-foods?id=`

**Auth:** Bearer + origin. Withdraw one caller-owned barcode contribution. The handler scopes lookup and delete by both `id` and `submitted_by` because it uses the service-role client.

### `POST /api/user-foods/vote`

**Auth:** Bearer. Vote on pending entries.

Implementation: [app/api/user-foods/route.ts](../../app/api/user-foods/route.ts), [vote/route.ts](../../app/api/user-foods/vote/route.ts).

---

## Custom foods (personal library, ENG-1420)

### `POST /api/custom-foods`

**Auth:** Bearer + **origin** check (`assertOrigin`). **Service role** required on server. Per-user rate limit (30 / hour, `keyPrefix: api:custom-foods-create`).

Creates a row in the caller's `user_custom_foods` library ("my homemade granola"). Manual custom-food creation previously wrote **directly from the client to Supabase with no plausibility gate** — a user could persist an impossible macro set (e.g. 50 kcal with 40g P + 40g C + 40g F, implied ~700 kcal). This route makes the gate server-enforced (a client-only check would be bypassable).

Pipeline mirrors `POST /api/user-foods`: `assertOrigin` → auth (**401**) → service-role guard (**503**) → rate limit (**429**) → body validation (**400** `missing_fields` / `invalid_macros` / `negative_macros`) → `scaledMacrosPlausible()` Atwater 4/4/9 gate → service-role insert (dedupe `" (2)"…" (9)"` on the per-user unique name).

- Body: the `CreateCustomFoodInput` field set (`name`, `calories`, `protein`, `carbs`, `fat`, plus optional `brand`, `baseGrams`, `fiber`, `servings`, `servingsPerContainer`, `sugarG`, `saturatedFatG`, `sodiumMg`, `barcode`, `acknowledgeImplausible`).
- **422 `implausible_macros`** when the macros fail the Atwater gate **and** `acknowledgeImplausible` is not `true`. The create-food form (web dialog + mobile sheet) catches this and reveals a "save anyway" acknowledgement.
- On an acknowledged override the row is stamped `plausibility_overridden = true` (else `false`), so an intentional override is distinguishable from an unguarded gap.
- Response: `{ ok: true, food }` where `food` is the mapped `CustomFood`.

Client entry point: `createCustomFood(apiFetch, userId, input)` in `src/lib/nutrition/customFoodsClient.ts` (shared web + mobile). Web binds a same-origin relative `fetch` (`src/lib/nutrition/customFoodsApiFetch.ts`); mobile binds `authedFetch(getSupprApiBase() + path)` (`apps/mobile/lib/customFoodsApiFetch.ts`). The insert + dedupe loop is the shared server-only `insertCustomFoodWithDedupe`.

Implementation: [app/api/custom-foods/route.ts](../../app/api/custom-foods/route.ts).

---

## Account

### `DELETE /api/account/delete`

**Auth:** Bearer + **origin** check (`assertOrigin`). **Service role** required on server.

Deletes user-owned rows then auth user; **500** if a data delete step fails (auth deletion aborted). See [app/api/account/delete/route.ts](../../app/api/account/delete/route.ts).

---

## Related Documents
- [Technical Architecture](../technical/architecture.md)
- [Data Schema](../data/schema.md)
- [Security](../security/auth.md)
