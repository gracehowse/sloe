# 2026-04-30 — Recime quick-win parity (hero image fallback ladder + Watch original)

**Status:** Resolved
**Authority:** Extended competitor audit (Recime parity). Two S-effort fixes shipped in this PR; the bigger Recime gap (IG/TT URL extractor) is in a parallel lane behind a feature flag.

## Context

Recime's recipe surfaces win on two small things our Cook + recipe-detail surfaces dropped:

1. When the imported recipe has no proper photo, Recime still surfaces something cohesive (often the source video's thumbnail), where ours either showed a stock Unsplash placeholder (mobile) or the same placeholder via `AppDataContext` defaulting (web). Users saw "every imported recipe looks the same."
2. While cooking, Recime shows a one-tap link back to the source video. Ours had no equivalent: once you'd tapped Start Cooking, you'd lost the path to the original creator's video.

Both are S-effort. They land now without a feature flag.

## Fix 1 — Hero image fallback ladder

**Before:** Mobile's recipe detail unconditionally fell back to a hardcoded Unsplash bowl photo when `image_url` was absent. Web's `AppDataContext` mappers default `image_url` → `DEFAULT_UPLOADED_RECIPE_IMAGE` (the same Unsplash URL). Recipes imported from a YouTube URL with no scrape-side image fix landed on the placeholder forever.

**After:** Shared helper `pickHeroImageUrl(recipe)` runs a 2-rung ladder:

1. `recipe.image_url` (or `recipe.image` on web, when not the default placeholder)
2. YouTube `maxresdefault` thumbnail derived from `source_video_url` (preferred — forward-compat for when the importer separates the video URL from the page URL) OR `source_url` (current state — many imported recipes carry the YT watch URL there directly)
3. `null` → caller falls back to its existing placeholder (mobile: Unsplash; web: same)

IG / TikTok thumbnails are NOT inferable from the share URL (signed CDN tokens), so the helper returns `null` for those hosts — when the importer eventually caches the OG thumbnail at scrape time, surface it via `image_url` and this helper stays unchanged.

The companion helper `extractVideoHost(url)` classifies URLs into `youtube | instagram | tiktok | other`, used by Fix 2.

## Fix 2 — Tap-to-watch original video link in Cook

**Before:** Cook screen had Exit + step counter + Ingredients toggle. No path back to the source video.

**After:** A "Watch original" pill (Lucide `Play` + label) renders in the Cook header when the recipe has a usable source URL. Tap →

- Mobile dedicated `cook.tsx`: `Linking.openURL` (system handler / native app deep link)
- Mobile inline cook overlay in `recipe/[id].tsx`: same, since users actually reach Cook through this path more often than the dedicated route
- Web `CookMode.tsx`: `window.open(url, "_blank", "noopener,noreferrer")` — the `noopener,noreferrer` is non-negotiable so the source page can't reach back into the cook session via `window.opener`

Analytics: new event `cook_watch_original_tapped` with `{ recipeId, videoHost }`. The URL itself stays on-device — only the host bucket is sent so the dashboard can slice tap-through by YT vs IG vs TT without trafficking arbitrary URLs through analytics.

## Files

- `src/lib/recipes/heroImageFallback.ts` (new) — shared helper module: `pickHeroImageUrl`, `extractYoutubeThumbnail`, `extractYoutubeVideoId`, `extractVideoHost`.
- `src/lib/analytics/events.ts` — new `cook_watch_original_tapped` event constant.
- `apps/mobile/app/recipe/[id].tsx` — uses `pickHeroImageUrl` for hero src; inline cook overlay renders the Watch original pill.
- `apps/mobile/app/cook.tsx` — accepts `sourceVideoUrl` / `sourceUrl` query params; renders Watch original pill in header.
- `src/app/components/RecipeDetail.tsx` — uses `pickHeroImageUrl` to upgrade the hero `<img src>` when the placeholder would otherwise win.
- `src/app/components/CookMode.tsx` — Watch original button in header, mirrors mobile testID + handler shape.
- `apps/mobile/tests/unit/cookWatchOriginalParity.test.ts` (new, 15 tests) — source-level parity pin for both mobile cook surfaces (dedicated + inline overlay).
- `apps/mobile/tests/unit/recipeSourceCardParity.test.ts` — narrowed the gap-tracker assertion (was a blanket `/source_url/` scan; now matches the actual source-card markup so the helper's `source_url:` property key doesn't trip it).
- `tests/unit/heroImageFallback.test.ts` (new, 19 tests) — pin the helper contract: ladder order, host classification, malformed input never throws.
- `tests/unit/cookModeWatchOriginal.test.ts` (new, 10 tests) — web cook button + RecipeDetail hero ladder source-level pins.

## Web vs mobile parity

Identical wiring on both platforms:

- Same helper module (`pickHeroImageUrl` / `extractVideoHost`).
- Same testID `cook-watch-original`.
- Same analytics event name + payload shape (`{ recipeId, videoHost }`).
- Same conditional render gate (only when source URL is present).

Two intentional platform differences:

- Mobile uses `Linking.openURL`; web uses `window.open(... "_blank" "noopener,noreferrer")`. Both open the URL in the system's native handler.
- Mobile renders the pill on BOTH the dedicated `cook.tsx` route and the inline cook overlay in `recipe/[id].tsx`. Today users reach Cook through the inline overlay; the dedicated route is reached via Maestro deep-link / future surfaces. Web has a single `CookMode.tsx` and gets the pill there.

## Tests

- `tests/unit/heroImageFallback.test.ts` — 19 tests covering ladder rungs, YT id extraction (id length validation, watch / shorts / youtu.be / embed forms), host classification (subdomain variants, malformed input, protocol-less URLs).
- `tests/unit/cookModeWatchOriginal.test.ts` — 10 tests pinning web Cook button wiring, `noopener,noreferrer`, helper imports.
- `apps/mobile/tests/unit/cookWatchOriginalParity.test.ts` — 15 tests pinning mobile Cook (dedicated + inline overlay) wiring.

44 new tests total. All green; one existing parity test (`recipeSourceCardParity`) had its scan narrowed so the helper's snake_case property key doesn't false-trip the gap tracker.

## Risks / follow-ups

- **`source_video_url` column** does not exist yet. The helper accepts it for forward-compat, and falls back to `source_url` until the importer adds a separate column. When that lands, no helper changes are needed; just stop overloading `source_url` for video.
- **IG / TikTok thumbnails** are still placeholder-only because their CDN URLs are signed. When the IG/TT extractor (parallel lane) caches the OG thumbnail at scrape time and writes it to `image_url`, that path takes the rung-1 win automatically.
- The web `RecipeCard.image` is pre-defaulted to `DEFAULT_UPLOADED_RECIPE_IMAGE` by `AppDataContext` mappers. The hero ladder treats that exact constant as "no image" so the YT thumbnail can win — if the default constant ever changes shape (e.g. moves to a CDN), update the equality check in `RecipeDetail.tsx`.
- **Notion mirror:** Decisions log entry pending. Add row with title, date `2026-04-30`, area "Recipes / Cook", status `Resolved`, summary "Recime parity quick-win — hero fallback ladder + Watch original button on Cook screens", repo URL pointing at this file.
