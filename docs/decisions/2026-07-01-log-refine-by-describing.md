# Refine by describing — conversational correction on photo + voice logs (ENG-974)

**Date:** 2026-07-01
**Status:** Shipped (default-ON behind `log_refine_describe_v1`)
**Area:** AI logging (photo / voice), server route, web + mobile review surfaces

## Problem

Cal AI's most-cited weakness in 2026 reviews: **corrections "don't work."** You
can't tell it "this was a large portion, add the side salad" and have it
re-estimate — you either accept its guess or start over. Our photo + voice logs
had the same gap: the review screen let you *remove* an item or tap an add-on
chip, but there was no way to say, in words, "that was a large bowl, no rice, add
a fried egg" and get a corrected estimate.

The expert-cited "strong correction loop" requires three things: conversational
edits, quick portion adjustments, and ingredient add-ons. This closes that gap.

## What shipped

After a photo or voice log produces an estimate, the review screen shows a calm
"Refine by describing" input. The user types a free-text correction and submits;
the model re-estimates the **whole** result from the **current** items + the
refinement and returns a corrected estimate in the same schema. The loop is
**conversational** — each refine operates on the current (already-corrected)
result, not the original, so corrections compound ("no rice" → then "make the
chicken bigger" → then "add a fried egg").

Surfaces (parity — iOS leads, web follows):
- Mobile: `apps/mobile/components/PhotoLogSheet.tsx`, `.../VoiceLogSheet.tsx`
  render `apps/mobile/components/RefineByDescribing.tsx` in the review stage.
- Web: `src/app/components/suppr/photo-log-dialog.tsx`, `.../voice-log-dialog.tsx`
  render `src/app/components/suppr/refine-by-describing.tsx`.
- Shared logic: `src/lib/nutrition/refineLog.ts` (prompt builders + validators),
  re-exported for mobile via `src/lib/nutrition-core/refineLog.ts`.

## Route contract

`POST /api/nutrition/refine-log` (`app/api/nutrition/refine-log/route.ts`).
The **model call happens server-side only** (via `callAiText`) — the client
never talks to the model directly (prod pattern).

**Request** (`RefineLogRequest`):

```jsonc
// photo
{ "source": "photo", "refinementText": "no rice, add a fried egg",
  "round": 2, "items": PhotoLogItemRanged[], "notes": string | null }
// voice
{ "source": "voice", "refinementText": "add a fried egg",
  "round": 2, "items": RefineVoiceItem[], "transcript": string | null }
```

- `round` is 1-indexed (Nth refine on the current result). Clamped `[1, 8]`.
- `refinementText` is trimmed + capped at 280 chars server-side.
- `items` is the CURRENT result the correction operates on (conversational).

**Response (photo)** — the range-first shape plus `round`:

```jsonc
{ "ok": true, "items": PhotoLogItemRanged[], "totalKcal": Range,
  "notes"?: string, "modelVersion": string, "round": number }
```

**Response (voice)** — verified point-estimate items plus `round`:

```jsonc
{ "ok": true, "source": "voice", "items": VoiceLogItem[],
  "totalCalories": number, "totalProtein": number, "totalCarbs": number,
  "totalFat": number, "confidenceTier": "high"|"medium"|"low", "round": number }
```

**Error codes:** `invalid_source` (400), `unauthorized` (401),
`missing_refinement` (400), `invalid_items` (400), `upgrade_required` (403,
voice non-Pro / photo free-quota drained), `rate_limited` (429),
`no_items_after_refine` (422, correction emptied the plate/list),
`model_unparseable` (502), `verify_failed` (502, voice pipeline),
`ai_capacity_reached` (503, daily AI budget), `ai_not_configured` (503),
`service_unavailable` (503, `kill_photo_log`/`kill_voice_log`).

## Trust posture (non-negotiable)

Nutrition is always an ESTIMATE and a vague correction must never become a
confident number. Enforced at two layers, so it holds regardless of what the
model returns:

1. **Prompt guardrail** (`REFINE_TRUST_RULES`, shared by both prompts): the model
   is told to WIDEN a range and drop the item to `low` confidence when the
   correction is vague about amount ("make it bigger"), and to keep the result
   unchanged rather than guess when the intent is unclear. Apply ONLY the change
   described; leave other items as-is.
2. **Validator reuse**:
   - **Photo** re-runs the model reply through the SAME strict validator as the
     first analyse (`parsePhotoLogRangedResponse`). Negative / non-finite kcal are
     dropped; a wide range is derived to `low` confidence by the spread rule. A
     refine can never introduce a shape the initial path would have rejected.
   - **Voice** asks the model ONLY for the food list (name/amount/unit). Nutrition
     comes from the verified pipeline (`verifyIngredients`) — never the LLM's
     free-text macros. This preserves the existing "no invented macros" rule
     through the refine loop.

The photo path does **not** re-upload the image on each refine (that would cost a
full vision call per turn); the current structured items already carry the vision
result, and the model corrects the structured list.

## Flag gate

`log_refine_describe_v1` — registered in `REDESIGN_DEFAULT_ON` on **both**
platforms (`src/lib/analytics/track.ts` + `apps/mobile/lib/analytics.ts`) per the
"always flag on" beta-window policy. Parity pinned by
`tests/unit/redesignDefaultOnParity.test.ts`. Off → the review screens ship
WITHOUT the refine input (the old review UX), which is the kill switch. PostHog
`isFeatureDisabled` remains an emergency off switch.

## Analytics

- `ai_log_refine_submitted` (client, on SUBMIT): `{ source, round, textLength }`.
  Fires before the response so attempts are captured even when the re-estimate
  errors. **The refinement text itself is never sent** — only its length (could
  be PII-adjacent).
- `ai_log_refine_completed` (server): `{ source, round, itemCount,
  confidenceTier, totalElapsedMs, tier? }`. Lets us measure how the loop changes
  confidence and its latency.

## Gating & abuse

Refine gating **mirrors the source route** so a refine can't be a free bypass of
the source cap: voice = Pro-only; photo = the free-taster weekly bucket for
non-Pro (its own `api:refine-log:photo:free-quota` key), 100/day for Pro. The
loop is also hard-capped at 8 rounds per result (`REFINE_MAX_ROUNDS`) — the
client hides the input past that, and the route rejects it belt-and-braces.

## Parity

Web and mobile ship the same feature, same route, same flag, same event names,
same copy. The only differences are platform-native shells (RN `TextInput` +
`Pressable` vs web `Textarea` + `Button`) — the same intentional divergence as
the rest of the photo/voice log sheets.

## No DB change

The refinement operates on the in-flight estimate before it's logged. No schema
change was needed.

## Follow-ups

- **Sim/web glance before ramp:** the input ships default-ON (live), so it needs
  a visual pass on device + web before it's in front of Grace at 100%.
- The `claude-haiku-4-5-20251001` model id (voice refine, mirrors the voice-log
  route) is not in `PRICE_TABLE` — it falls back to Sonnet pricing for budget
  accounting. Pre-existing (shared with `/voice-log`); worth a follow-up to add
  the Haiku row.
