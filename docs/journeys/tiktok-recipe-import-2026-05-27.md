# TikTok recipe import pipeline (ENG-7)

**Goal:** ≥90% success rate on 100 random TikTok food Reels  
**Status:** Fix shipped 2026-05-27 — benchmark pending  
**Feature flag:** none (extraction is an internal quality fix, not a UI change)

---

## Why TikTok was failing

TikTok serves different HTML to non-browser UAs. With `SupprBot/1.0`:

- `og:description` returns generic text ("Watch @user's video") **not** the actual caption
- The previous code hit the `if (caption || title)` early-return on this generic text
- The AI received no recipe content → empty `ingredients[]` → `social_no_recipe` error

The full caption (TikTok's `desc` field) is embedded as JSON in the page HTML — it was never being extracted.

---

## Fix: `extractFromTikTokEmbeddedJson()`

**File:** `src/lib/recipe-import/extractSocialRecipe.ts`

New exported function tries four strategies in order:

| Strategy | Script tag / pattern | Path to caption |
|---|---|---|
| 1 | `<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__">` | `__DEFAULT_SCOPE__["webapp.video-detail"]["itemInfo"]["itemStruct"]["desc"]` |
| 2 | `<script id="SIGI_STATE">` | `ItemModule[id]["desc"]` |
| 3 | `<script id="__NEXT_DATA__">` | `props.pageProps.itemInfo.itemStruct.desc` |
| 4 | Broad `"desc":"..."` scan | First match > 20 chars |

Runs **before** the `og:description` early-return in `fetchSocialPostMeta`, so the full caption is used even when `og:description` has non-empty generic content.

### Also fixed: TikTok oEmbed `title`

TikTok's oEmbed response includes a `title` field that is typically the first ~150 chars of the caption. Previously ignored. Now stored and used as a last-resort caption when both embedded JSON and page HTML are unreadable.

---

## Pipeline flow (after fix)

```
fetchSocialPostMeta(tiktokUrl)
│
├─ TikTok oEmbed → thumbnail + author_name + title (stored as tikTokOembedTitle)
│
└─ for each UA:
   │  fetch page HTML
   │
   ├─ Strategy 1b (new): extractFromTikTokEmbeddedJson(html)
   │    → __UNIVERSAL_DATA_FOR_REHYDRATION__ desc
   │    → SIGI_STATE desc
   │    → __NEXT_DATA__ desc
   │    → broad "desc" scan
   │    → if found: return full caption ✓
   │
   ├─ Strategy 1: og:description / twitter:description
   │    → if non-empty: return (fallback for TikTok when embedded JSON absent)
   │
   └─ (Instagram-specific embedded JSON — not used for TikTok)

Last resort: use tikTokOembedTitle if HTML was unreadable
```

---

## What the fix does NOT address

- **Sparse captions**: creators who post only hashtags + dish name — no ingredient data exists to extract
- **Video-only recipes**: audio description only, no caption text — correctly not transcribed (IP counsel, 2026-04-19)
- **Pinned comment recipes**: TikTok comments are not embedded in page HTML; no extraction path exists
- **Non-English captions**: AI extraction works multi-lingual but accuracy drops on CJK character sets

Expected floor after fix: ~75-85% of posts **with real recipe captions** → extracts ≥1 ingredient. Posts where the creator never wrote ingredients in text will always fail.

---

## Running the benchmark

```bash
# 1. Populate the URL list
vim scripts/tiktok-benchmark-urls.txt  # one URL per line, target 100

# 2. Start the dev server
npm run dev

# 3. Get a Supabase access_token
#    (DevTools → Application → Cookies → supabase-auth-token → access_token)
echo "BENCHMARK_JWT=eyJ..." >> .env.local

# 4. Run
node scripts/benchmark-tiktok-import.mjs

# Results written to docs/testflight-feedback/tiktok-benchmark-YYYY-MM-DD.json
```

Pass criteria: ≥90 of 100 URLs return `ok: true` with `ingredientCount > 0`.

---

## Files changed

- `src/lib/recipe-import/extractSocialRecipe.ts` — `extractFromTikTokEmbeddedJson()`, TikTok oEmbed title capture, Strategy 1b insertion
- `tests/unit/extractTikTokCaption.test.ts` — 11 unit tests (all passing)
- `scripts/benchmark-tiktok-import.mjs` — benchmark runner
- `scripts/tiktok-benchmark-urls.txt` — URL list template (populate before running)
