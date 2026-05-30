# TikTok / social import benchmark (ENG-7)

Smoke fixtures for caption-import gate checks. Full 100-Reel empirical gate is tracked in **ENG-670**.

## Run offline (no API)

```bash
node scripts/benchmark-tiktok-import.mjs
```

Writes `docs/testflight-feedback/tiktok-import-benchmark-YYYY-MM-DD.json`.

## Run live (dev server + token)

```bash
npm run dev
export BENCHMARK_TOKEN=<supabase-session-jwt>
node scripts/benchmark-tiktok-import.mjs --live --base-url http://localhost:3000
```

## Fixture format

Each `captions/*.json` file:

```json
{
  "sourceUrl": "https://www.tiktok.com/@creator/video/123",
  "captionText": "Full caption text with ingredients and steps…",
  "expectParse": true
}
```

## Current status (2026-05-29)

- **Offline gate:** 3 smoke fixtures (2 pass, 1 intentionally short) — validates platform detect + min caption length only.
- **Live parse rate:** not run in CI; requires OpenAI key + authenticated `/api/recipe-import`.
- **Blocker for ≥90% live gate:** need Grace-curated sample of 100 food Reels with ground-truth ingredient lists (ENG-670).
