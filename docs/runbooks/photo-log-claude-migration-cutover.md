# Photo-log → Claude vision cutover runbook

**Trigger PR:** Phase 0.5 of `docs/decisions/2026-05-08-food-correction-verification-pipeline.md`
**Owner:** Grace
**Date:** 2026-05-08

This runbook covers what Grace needs to do **once** to flip photo-log
from OpenAI GPT-4o vision onto Anthropic Claude Sonnet 4.6 vision.
Everything in this runbook is a Vercel-environment change — code is
already shipped behind an env-var switch.

## Step 1 — Set the Anthropic API key in Vercel

1. Visit https://vercel.com/grace-howse/suppr/settings/environment-variables
2. Add a new variable:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** `sk-ant-...` (from https://console.anthropic.com/settings/keys)
   - **Environment:** Production + Preview + Development (all three)
3. Save.
4. Trigger a redeploy of `main` so the new env var takes effect (Vercel
   does NOT redeploy automatically on env var change).

## Step 2 — Confirm Claude is being used

After redeploy, check Vercel runtime logs for `/api/nutrition/photo-log`:
- A successful Claude call leaves no warning lines.
- The route still falls back to OpenAI silently if `ANTHROPIC_API_KEY`
  is missing or returns an error — there is no user-facing signal of
  which provider answered.

To confirm visually:
- Open the mobile app, tap "Photo log" on Today
- Snap any meal
- If Claude is being used, the request hits `api.anthropic.com`
- A faster-than-usual response (Claude Sonnet 4.6 is typically <8s vs
  OpenAI's 12-20s) is the most reliable signal that the cutover landed

## Step 3 — Bake for one TestFlight cycle

Leave both keys set for 1 TestFlight build cycle (~3 days). Log meals
through the app naturally and watch for:
- Accuracy regression (calorie ranges noticeably off vs. before)
- Latency regression (>10s on average)
- Any new error codes in mobile crash reports

If any of the above show up:
- Remove `ANTHROPIC_API_KEY` from Vercel — route immediately falls
  back to OpenAI on next request
- File a bug, do not delete the OpenAI fallback yet

## Step 4 — Remove OpenAI fallback (only after confirmation)

When Grace is satisfied with Claude parity:

1. Open a follow-up PR that:
   - Deletes the `callOpenAIVision` helper in
     `app/api/nutrition/photo-log/route.ts`
   - Removes the `process.env.OPENAI_API_KEY` read for photo-log
   - Updates the 503 `ai_not_configured` error to mention only
     `ANTHROPIC_API_KEY`
   - Removes the OpenAI fallback test (`tests/integration/photoLogRoute.test.ts`,
     "falls back to OpenAI" case)
   - Relaxes `tests/unit/photoLogClaudeVendor.test.ts`'s "OpenAI
     fallback is still wired" assertion

2. **Do NOT remove `OPENAI_API_KEY` from Vercel yet** — voice-log still
   uses OpenAI Whisper for audio transcription (no Claude equivalent).
   `OPENAI_API_KEY` stays until Whisper is also migrated (separate
   workstream — see Phase 0.5c in the decision doc).

## Cost expectations

- Claude Sonnet 4.6 vision: ~$3/M input tokens, ~$15/M output tokens
- A typical photo-log call: ~1500 input tokens (image) + ~500 output
  tokens = ~£0.012/call
- At Suppr's projected 1000 photo-logs/month ≈ £12/month
- For comparison, GPT-4o was ~£15/month at the same volume
- Net change: roughly cost-neutral. Switching for code-reuse + vendor
  unification, not for cost.

## Rollback

If Claude needs to be disabled for any reason:
- Remove `ANTHROPIC_API_KEY` from Vercel env vars
- Trigger redeploy
- Route falls back to OpenAI on next request

Zero-downtime rollback. The fallback path is exercised by the
integration test suite so we know it works.
