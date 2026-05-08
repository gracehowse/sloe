# 2026-05-08 — AI photo-log micronutrient gap

## Status

Open. Investigation captured today; no code change in this commit. Next step is a focused PR after the build-47 hotfix queue is cleared.

## Source of the ask

Build-47 TestFlight feedback (Grace, 2026-05-07 16:40, screenshot `feedback-2026-05-08.json`):

> "Still getting this error for lots of things regardless of source - no vitamins and minerals even when they do exist"

Two related but distinct complaints:

1. AI photo-log still errors on a non-trivial fraction of attempts — likely a long-tail of vision parse failures + the `image_unreadable` HEIC paths the 2026-05-08 normaliser didn't cover.
2. Vitamins / minerals are absent from logged items, even when the underlying food (e.g. an OFF or USDA match) exposes them.

This memo addresses (2). (1) is tracked separately via the `ai_*` error-code telemetry the migration to Claude Sonnet 4.6 added.

## What's actually happening

Today the AI photo-log path is:

1. `app/api/nutrition/photo-log/route.ts` calls `callAiVision` → returns a `PhotoLogRangedResponse` of items with `calories` / `protein` / `carbs` / `fat` only. **No vitamins, no minerals, no fibre.**
2. The mobile `PhotoLogSheet` builds `AiLoggedItem`s and hands them to `commitAiLoggedItems` in `apps/mobile/app/(tabs)/index.tsx:2906`.
3. `commitAiLoggedItems` forwards **only `caffeineMg` and `alcoholG`** to `meal.micros` (line 2920–2934). Everything else is dropped on the floor before the row is written to `nutrition_entries.nutrition_micros`.

So when Grace taps a photo-logged meal and opens the all-nutrients panel, it shows mostly "—" — as designed (`F-86` empty-row guard) — because we never populated those fields in the first place.

Barcode-logged items **do** write a full OFF micros payload (`apps/mobile/app/(tabs)/barcode.tsx:168`, `apps/mobile/app/(tabs)/index.tsx:404`). Those should be working; if Grace also sees blanks on a barcode-scanned item, that's a separate UI bug to chase.

## Why we don't fix this by extending the AI prompt

Tempting, but wrong:

- Anthropic / OpenAI vision models hallucinate micronutrient values with high confidence. We've already refused to invent fibre on AI items (per the project rule "if nutrition / ingredient matching is uncertain, do not guess"). Adding 13 vitamin and mineral fields to the prompt makes the worst-confidence numbers the most prominent.
- Range-based prompts already produce ~2–3 KB of JSON per plate. Asking for 13× more fields meaningfully increases parse-failure rate (the same `model_unparseable` path Grace is hitting).
- The schema decision in `2026-05-08-food-correction-verification-pipeline.md` is explicit that **micronutrient data must come from USDA / OFF / FatSecret / verified-correction sources** — not AI guesses.

## Right fix (deferred)

Wire AI photo-log items through the **same matcher** that barcode + verified foods already use, on commit:

1. After `PhotoLogSheet` collects the user's picks, before `commitAiLoggedItems` writes to Supabase, run each item's `name` through the existing food-search → USDA / OFF / FatSecret resolution.
2. For matches above a confidence threshold, populate `meal.micros` from the matched per-100g micros, scaled by the AI item's gram estimate (or `verbalQuantityHint` when no grams are available — fall back to 100g).
3. Below the threshold, leave `micros = {}` and trust the all-nutrients panel's existing empty-state copy.

This reuses `parseOffMicros`, `usdaNormalize`, and `scaleMicrosForGrams`, so there's no new parsing surface.

## Why this is deferred, not in this PR

- It's a feature-shaped change that wants its own PR (web + mobile, plus an AI photo-log telemetry bump for matched-vs-unmatched ratio).
- It's downstream of F-138 Phase 5 (Claude-vision label-photo verify) — the matcher contract is in flux and we don't want to wire two paths to it.
- Build-47 has higher-severity bugs still in the queue (data persistence — done; weekly check-in popup loop — done; floor explainer — this PR).

## Owner / next step

- Owner: Grace + Claude
- When: after F-138 Phase 5 lands (matcher contract stable)
- Tracker: this file; cross-link from `docs/product-roadmap.md` once the PR opens
