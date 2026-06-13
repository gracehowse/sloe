# Viral-push gate — Reel import parse rate (ENG-7 / ENG-670)

Operator playbook for the one quantitative gate that decides whether the
recipe-import wedge is good enough to put in front of the 2026-07-01 viral
push. The whole growth bet (`docs/growth/tiktok-instagram-viral-plan.md`) is
"import a recipe from a Reel in one tap" — if that fails for one user in four,
the loop leaks at the top and the push burns reach on a broken first impression.

This is a working runbook, not a decision doc. The gate threshold below is the
ratified bar; when it changes, update this file and
`scripts/_lib/reelAuditReport.ts` (`GATE_SUCCESS_THRESHOLD_PCT`) together.

## The gate

**The import wedge is launch-ready when, on three consecutive days, a
100-Reel audit run lands ≥90% successful parses.**

Three knobs, all load-bearing:

| Knob | Value | Why |
| --- | --- | --- |
| Success threshold | **≥90%** | One-in-ten failure is survivable with a graceful "couldn't read that one" path; one-in-five is not — the loop's first impression is the import. |
| Sample size | **100 Reels** | Big enough that a single flaky URL doesn't swing the rate by >1pt; matches the curated battery Grace maintains. |
| Stability | **3 consecutive green days** | A single green run can be luck (vendor having a good day, or a friendly URL mix). Three in a row rules out a one-day vendor blip. |

A "successful parse" = the `/api/recipe-import` route returns `{ ok: true }`
with a recipe — i.e. the harness recorded `ok`, not any error code.

## How to run an audit

1. Curate the battery. Replace `scripts/fixtures/reel-urls.sample.json` (10
   placeholders) with 100 genuine recipe Reels — a representative mix of
   TikTok / Instagram / YouTube, easy and hard, captioned and video-only. Keep
   the file as the canonical battery so day-over-day runs are comparable.
2. Start the web app locally (`npm run dev`) — the harness POSTs the live route.
3. Run it:

   ```bash
   AUDIT_TIKTOK_REELS=1 npx tsx scripts/audit-tiktok-reels.ts scripts/fixtures/reel-urls.sample.json
   ```

   The harness is **env-gated** (no-op without `AUDIT_TIKTOK_REELS=1`) and
   **refuses to run in CI** — it exercises live AI + Supadata quota, so it never
   runs on a push.

4. Read `docs/testing/audit-tiktok-reels-<date>.{md,json}`. The markdown report
   carries the parse rate, top failure modes (by error code, with sample URLs),
   and per-attempt detail. If the run used the placeholder fixture, the report
   says so in a banner — that is **not** a gate read.

### Auth + safety

The harness signs in a **throwaway audit account** (never Grace's daily-driver)
via Supabase password sign-in — same guardrail as `scripts/verify-gate0-db.mts`.
Set `REEL_AUDIT_EMAIL` (a plus-address throwaway, default
`gracehowse+reelaudit@outlook.com`) and `REEL_AUDIT_PASSWORD` in `.env.local`.
It sends the session token as `Authorization: Bearer` and re-uses the
forbidden-email guard so it can't be pointed at a real account.

## The PostHog funnel (continuous read between audits)

The audit harness emits a per-attempt `recipe_import_stage_changed` event with
`audit_batch: true` so audit traffic is filterable out of organic numbers. But
the same event fires from the real app on every import, which gives a
**continuous** parse-rate read between manual audit runs:

- **Numerator:** `recipe_import_stage_changed` where `stage = "done"`,
  `kind = "url"`.
- **Denominator:** `recipe_import_stage_changed` where `stage in ("done","failed")`,
  `kind = "url"`.
- **Parse rate** = done / (done + failed). Break down by `errorCode` on the
  failed leg to see which failure mode dominates (e.g. `social_no_caption`,
  `timeout`, `ai_capacity_reached`).
- Filter `audit_batch = true` **out** for the organic read, **in** for the
  audit-only read. Both live on the same event so they're directly comparable.

Watch this funnel daily through the beta window. A sustained organic parse rate
≥90% is the real-world confirmation that the curated-battery gate generalises.

## Who decides

- **Grace** owns the gate call. The harness + funnel produce the number; Grace
  reads three consecutive ≥90% runs (plus a sane organic funnel) and clears the
  wedge for the push.
- A failing run is not a blocker by itself — it's a worklist. The top failure
  mode in the report points engineering at the next fix (a flaky vendor path, a
  caption-extraction gap, a timeout budget). Re-run after each fix; the
  three-day clock restarts on any red day.
