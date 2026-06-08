# 2026-06-08 — Supadata as the recipe-import acquisition adapter (ENG-994)

**Status:** Resolved (shipped LOCAL only, flag-gated OFF — no production ramp yet)
**Area:** Product / Imports / Integrations
**Driven by:** Julienne pipeline teardown (`docs/research/2026-06-08-julienne-strengths.md`)
**Reviewers:** integration-manager (robustness), legal-reviewer (IG/TT posture carry-over)

## Decision

Wire **Supadata** (`https://api.supadata.ai/v1`) as the default **acquisition
adapter** for recipe import, behind a **swappable adapter interface** we own,
gated by the `supadata-acquisition` PostHog flag. Supadata *acquires* raw source
content (web scrape OR video transcript); the **existing extraction step
(schema.org JSON-LD + the LLM caption extractor) is unchanged**.

This is the two-stage architecture from the Julienne teardown: **per-platform
acquisition → normalise → existing extraction.** The LLM never sees a URL; it
sees normalised `{ content, source, kind }`.

## Why an adapter, not a hardcoded vendor

Build-vs-buy: we *buy* acquisition from Supadata today, but behind an
`AcquisitionAdapter` interface (`acquireRecipeSource(url) → AcquisitionResult`).
A future vendor (or a self-hosted fetcher) is a drop-in via
`setAcquisitionAdapter()` with no route changes. Supadata is `supadataAdapter`,
the default.

## Server-only — the key never reaches a client bundle

- `SUPADATA_KEY` is read only in `src/lib/server/supadata/` via `process.env`
  and sent as the `x-api-key` header. **No `NEXT_PUBLIC_` / `EXPO_PUBLIC_`
  prefix.**
- Verified: a fresh `next build` with the key in env leaves the client static
  bundle clean of the key value, the env-var name, and the `api.supadata.ai`
  host. The key isn't even inlined into the server build — it's read at runtime.
- Mobile inherits this safety automatically: mobile does **not** import any
  Supadata module; it calls the web `/api/recipe-import` route, which runs the
  adapter server-side. Web ↔ mobile parity with zero client key exposure.

## Robustness (integration-manager lens)

Supadata's free tier is **100 requests/month** — it *will* hit limits. Every
client call:

- bounds with a **hard 15s timeout** (AbortController) — never hangs the import;
- **retries** transient failures (network error / 5xx) with exponential backoff
  + jitter (2 attempts total, to stay inside the route's 45–50s budget);
- **never retries 429 / 4xx** — retrying a credit-exhausted request just burns
  the next reset's budget; 429 surfaces immediately with `Retry-After`;
- returns a **typed, vendor-neutral result** (never throws) so the route can
  **fall back to the existing path** or surface a clear user error.

On any acquisition failure (`rate_limited`, `empty`, `error`, `not_configured`,
`blocked_by_policy`) the route's **existing scrape/oEmbed path runs unchanged**
(old path alive in the `else`). The flag-gated new path is purely additive.

## Legal posture — IG/TT transcript acquisition stays gated

`docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md` **BLOCKS**
server-side fetch of Instagram/TikTok post bodies for recipe extraction (a
transcript fetch is a reproduction of the video's audio track — the same reason
Whisper transcription was removed on 2026-04-19 on IP-counsel advice).

So the adapter will **only** attempt an IG/TT transcript when the existing legal
flag `IG_TT_IMPORT_ENABLED` is on (which stays OFF in production until DMCA
registration + legal-reviewer sign-off land). With the flag off, an IG/TT URL
returns `blocked_by_policy` and the route falls back to the existing
caption-meta path — Supadata never hits IG/TT servers. **YouTube transcripts and
general web scrapes are not covered by that block** and are acquired freely.

> **Route to legal-reviewer before flipping `IG_TT_IMPORT_ENABLED`** — the
> Supadata transcript leg is now wired (gated), so enabling that flag activates
> a server-side IG/TT video fetch that the 2026-04-30 verdict has not cleared.

## Where Supadata slots in (two live legally-clean surfaces)

| Path | Endpoint | Feeds existing step |
|---|---|---|
| General URL (blog / recipe site) | `GET /web/scrape` | `parseRecipeFromHtml` (JSON-LD), then LLM fallback if no schema |
| YouTube | `GET /youtube/transcript` (`lang=en`) | `extractRecipeFromCaption` (transcript appended to caption) |
| TikTok / Instagram | `GET /transcript` | gated by `IG_TT_IMPORT_ENABLED` — no-op fall-through while OFF |

`lang=en` is pinned (Supadata's API defaulted to `de` in live testing).

For the scrape path the route **only short-circuits the live fetch when
Supadata's content yields a parseable JSON-LD recipe**; if Supadata scraped but
found no schema, the live page fetch still runs (the live page is authoritative).

## Telemetry

New `recipe_acquisition` event (server-side, same name web ↔ mobile) fires once
per URL import after acquisition: `{ adapter, kind, platform, outcome:
"acquired" | "fallback", reason?, contentChars? }`. No raw URLs/content
(content-rights + PII hygiene). This is the data to decide whether to ramp the
flag.

## Files

- `src/lib/server/supadata/client.ts` — server-only client (`scrapeUrl`,
  `fetchTranscript`, `hasSupadataConfig`).
- `src/lib/server/supadata/acquisitionAdapter.ts` — swappable adapter +
  `acquireRecipeSource`.
- `src/lib/server/supadata/wireAcquisition.ts` — glue to the existing extractors.
- `src/lib/server/supadata/index.ts` — server-only barrel.
- `app/api/recipe-import/route.ts` — two flag-gated acquisition branches.
- `src/lib/analytics/events.ts` + `recipeImportPipelineTrace.ts` —
  `recipe_acquisition` event + `traceAcquisition`.
- Tests: `tests/unit/supadataClient.test.ts`,
  `tests/unit/supadataAcquisitionAdapter.test.ts`,
  `tests/integration/recipeImportSupadataAcquisition.test.ts` (all mocked fetch).

## Ramp gate (before flipping `supadata-acquisition` ON in production)

1. Confirm `SUPADATA_KEY` is set in Vercel production env.
2. Ramp `supadata-acquisition` gradually via PostHog; watch `recipe_acquisition`
   `outcome` distribution + import success rate + Supadata credit burn (free tier
   100/mo).
3. Do **not** enable `IG_TT_IMPORT_ENABLED` as part of this — that's a separate
   legal gate (see above).
