# TikTok / social import benchmark — SUPERSEDED (GROW-61, 2026-07-01)

> **These caption fixtures are legacy.** The 2026-07-01 recipe-import audit
> found the harness scored the wrong signal (caption length / `res.ok`, not a
> usable macro-tracked recipe). The harness was rewritten to score
> **Definition B** (usable macro spine + ingredient match rate) against real
> URLs, driven by a URL list rather than these caption JSON fixtures.
>
> **Canonical doc:** [`docs/growth/reel-import-gate.md`](../../growth/reel-import-gate.md)
> — the three metrics (A / B / caption-present), how to run it, the bearer-token
> requirement, and why the ceiling is caption-present-bound.

## Run it now (URL-based harness)

```bash
# offline URL-shape precheck (NOT a success rate):
node scripts/benchmark-tiktok-import.mjs --urls scripts/fixtures/reel-import-seed-urls.txt

# live gate measurement (dev server + authed bearer):
npm run dev
export BENCHMARK_BEARER=<supabase-session-jwt for a test account>
node scripts/benchmark-tiktok-import.mjs --live \
  --urls scripts/fixtures/reel-import-seed-urls.txt \
  --base-url http://localhost:3000
```

The seed fixture is a smoke set; the real GROW-62 gate run needs 100 random
food-Reel URLs sourced by founder/growth.

---

## Legacy caption fixtures (historical)

The `captions/*.json` files fed the old caption-length precheck (format:
`{ sourceUrl, captionText, expectParse }`). Kept as historical record only —
the URL-based harness above no longer reads them.
