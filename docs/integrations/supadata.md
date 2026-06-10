# Supadata (recipe-import acquisition) integration

Supadata is a recipe-import **acquisition** vendor (ENG-994). Given a URL it
either scrapes the web page or fetches a video transcript. Suppr uses it as the
**default acquisition adapter** behind the existing import pipeline — it never
extracts a recipe; the normalised content is handed to Suppr's **unchanged**
extraction step (schema.org JSON-LD + the LLM caption extractor).

See the decision: `docs/decisions/2026-06-08-supadata-acquisition-adapter.md`.

## Where it lives (SERVER-ONLY)

- `src/lib/server/supadata/client.ts` — `scrapeUrl`, `fetchTranscript`,
  `hasSupadataConfig`.
- `src/lib/server/supadata/acquisitionAdapter.ts` — the swappable
  `AcquisitionAdapter` interface + `acquireRecipeSource(url)`.
- `src/lib/server/supadata/wireAcquisition.ts` — glue to the existing extractors.
- Consumed only by `app/api/recipe-import/route.ts` (server route).

**Do not import any of these from a `"use client"` component or from
`apps/mobile/`.** The `SUPADATA_KEY` must never reach a client bundle.

## Configuration

| Item | Value |
|---|---|
| Base URL | `https://api.supadata.ai/v1` |
| Auth header | `x-api-key: <SUPADATA_KEY>` |
| Env var | `SUPADATA_KEY` (server-only — **no** `NEXT_PUBLIC_` / `EXPO_PUBLIC_`) |
| Free tier | 100 requests/month (it *will* hit limits — handled gracefully) |

### Endpoints used

| Suppr method | Supadata endpoint | Used for |
|---|---|---|
| `scrapeUrl(url)` | `GET /web/scrape?url=…` | general URLs (blogs, recipe sites) |
| `fetchTranscript(url, { isYouTube: true })` | `GET /youtube/transcript?url=…&lang=en&text=true` | YouTube videos |
| `fetchTranscript(url)` | `GET /transcript?url=…&lang=en&text=true` | TikTok / Instagram (gated — see below) |

`lang=en` is pinned by default because Supadata's API defaulted to `de` (German)
in live testing. Callers can override `lang`, and the transcript result surfaces
`availableLangs` so a caller can re-request a different language.

## Web ↔ mobile parity

The acquisition adapter is **entirely server-side in the web `/api/recipe-import`
route.** The mobile app calls that same route via `authedFetch` (it always has —
see `apps/mobile/app/import-shared.tsx`). So:

- Web and mobile get **identical** acquisition behaviour from one implementation.
- The `SUPADATA_KEY` is never in the mobile bundle (mobile imports no Supadata
  module).
- No mobile code change was needed for parity.

## Feature flags

- **`supadata-acquisition`** (PostHog, server-side via `isServerFeatureEnabled`)
  — gates the whole acquisition stage. OFF → the route's existing scrape/oEmbed
  path runs unchanged. Ramp via PostHog after confirming the key is set in prod.
- **`IG_TT_IMPORT_ENABLED`** (env flag, existing) — additionally gates the
  IG/TikTok **transcript** path for legal reasons (see below). YouTube + web
  scrape are not affected by this flag.

## Legal gate (IG/TikTok transcripts)

`docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md` blocks
server-side fetch of Instagram/TikTok post bodies. A transcript fetch is a
reproduction of the video's audio track — so the adapter returns
`blocked_by_policy` for IG/TT transcripts unless `IG_TT_IMPORT_ENABLED` is on.
**Do not enable that flag without routing to `legal-reviewer`** — the Supadata
transcript leg is now wired (gated), so enabling it activates a server-side
IG/TT video fetch the 2026-04-30 verdict has not cleared.

## Robustness contract

Every Supadata call:

- bounds with a **15s timeout** (AbortController) — never hangs the import;
- **retries** network errors / 5xx with exponential backoff + jitter (2 attempts);
- **never retries 429 / 4xx** — a credit-exhausted request fails fast with
  `Retry-After`;
- returns a **typed result** (`{ ok: false, error, retryAfterSec, detail }`),
  never throws.

On any failure the route falls back to the existing import path. Supadata is an
*enhancement* on the critical path, never a single point of failure.

## Telemetry

`recipe_acquisition` (server-side, same name web ↔ mobile) fires once per URL
import: `{ adapter, kind, platform, outcome: "acquired" | "fallback", reason?,
contentChars? }`. No raw URLs / content in the payload.

## Tests (all mocked fetch — no live API calls)

- `tests/unit/supadataClient.test.ts` — scrape/transcript shapes, `x-api-key`
  header, `lang=en` pin, platform endpoint routing, retry/timeout/429.
- `tests/unit/supadataAcquisitionAdapter.test.ts` — platform routing, IG/TT
  legal gating, adapter swappability, SSRF guard, error mapping.
- `tests/integration/recipeImportSupadataAcquisition.test.ts` — the
  `supadata-acquisition` flag gate + graceful fallback through the route.
