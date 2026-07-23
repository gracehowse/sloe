# User Journey: Import a Recipe

**Audience:** Product / Design / Engineering / Legal
**Status:** Live — URL/blog import, share-sheet/deep-link/clipboard capture,
bulk photo import, and the multi-link queue are all shipped and real on both
platforms. The safe Instagram/TikTok caption-only path is code-complete but
**OFF in production** — read the Legal caveat below before treating
Instagram/TikTok import as a clean, ToS-compliant, shipped feature in any
external claim.

## Overview
A user finds a recipe somewhere else — a blog, a Pinterest pin, an
Instagram/TikTok post, a photo of a cookbook page, or a stack of photos —
and brings it into their Suppr library, with nutrition estimated and then
verified per ingredient. This is the **entry stage** of the founder's core
loop (see "Loop" below): deep ingredient correction, library organisation,
cooking, and the legal/attribution handling of third-party content each
have their own canonical doc, and this file doesn't re-explain those
stages.

**Import** ("this recipe exists somewhere, bring it in") is distinct from
**[Create a Recipe](create-recipe.md)** ("this recipe doesn't exist yet,
I'm writing it") — same Library, two different mental models. If you're
looking for "write my own recipe," that's the doc, not this one.

## Scope

**In scope for this doc:**
- URL / paste-link import (blog, Pinterest, AllRecipes, etc.)
- Instagram / TikTok / YouTube social-share import — both the safe
  caption-only path and the live fallback path (see Legal caveat)
- Share-sheet / deep-link / clipboard capture (mobile-native entry)
- Bulk photo import (Pro) and the legacy single-photo OCR path
- The multi-link queue / staged-progress drawer
- Import review, save-to-Library, and the post-save success sheet

**Out of scope — covered by their own docs:**
- Deep per-ingredient nutrition correction after save →
  [verify-ingredients.md](verify-ingredients.md)
- Cookbook PDF batch import → [import-cookbook.md](import-cookbook.md)
- Browsing Discover, organising Library, Cook Mode →
  [discover-and-library.md](discover-and-library.md)
- Creating a recipe from scratch → [create-recipe.md](create-recipe.md)
- Attribution, DMCA takedown, and reporting imported content →
  [creator-platform.md](creator-platform.md)

## Loop: Import → Verify → Save → Cook/Log

This is the **first leg** of the founder's headline loop — share a recipe,
get it parsed and nutrition-verified, save it, then cook or log it so it
feeds the macro spine (Today ring, adaptive TDEE). It's the primary
viral/retention wedge: "share a Reel, recipe appears in Suppr."

**What comes next, once a recipe is imported:**
1. **Deep ingredient verification** — correct a low-confidence match, swap
   an ingredient, add a missing one. → **[verify-ingredients.md](verify-ingredients.md)**.
   Note: mobile has a dedicated `/recipe/verify?id=` screen reached
   post-save; web verifies **inline inside this same import form**, with
   no equivalent standalone route — don't assume the two platforms verify
   the same way.
2. **Where the recipe lives** — a saved import lands in the user's
   Library (Recipes tab) alongside anything found via Discover; from
   there it's organised into a collection, cooked via Cook Mode, or
   slotted into Plan. → **[discover-and-library.md](discover-and-library.md)**.
3. **Attribution / legal handling of imported content** — every imported
   (non-first-party) recipe carries a source card, a disclaimer, and a
   link back to the original; a user can report an issue or file a DMCA
   takedown. → **[creator-platform.md](creator-platform.md)**.

Parallel entry into the same review→save flow: cookbook PDF batch import
(mobile-only, Pro) — see **[import-cookbook.md](import-cookbook.md)**.

### In-app help (ENG-1597)

Flag `in_app_help_import_v1` (default OFF) shows a contextual **?** on the
web Verify modal and mobile `/recipe/verify` chrome. Copy lives in
`src/lib/help/importLoopHints.ts` — see
`docs/specs/2026-07-22-eng-1597-in-app-help-v1.md`.

## Legal caveat — Instagram / TikTok import (read before any public claim)

**This section is a required read before anyone makes an external claim
about "Instagram import" or "TikTok import" — landing page copy, App Store
listing, social post, or investor deck. Get legal sign-off before making
any such claim; don't assume this is settled.**

There are two different code paths for an Instagram/TikTok/YouTube share,
and they have very different legal postures:

1. **The safe path (the only one legally approved as a permanent design).**
   `POST /api/recipe-import/caption` runs the LLM only on the caption text
   the user's iOS share sheet handed over — Suppr's server never contacts
   Instagram or TikTok. This is the rebuild that Suppr's Instagram/TikTok
   import legal posture conditionally approved. It's gated behind the
   `IG_TT_IMPORT_ENABLED` server flag (`src/lib/featureFlags/igTtImport.ts`),
   **which defaults to `false`**. Flag off → the route returns `404` by
   design, so callers fall through to path 2.
2. **The fallback path — live in production today, on both platforms.**
   When the caption route 404s, both web (`src/app/components/RecipeUpload.tsx`)
   and mobile (`apps/mobile/app/import-shared.tsx`) fall through to
   `POST /api/recipe-import`, whose social branch calls
   `fetchSocialPostMeta()` (`src/lib/recipe-import/extractSocialRecipe.ts`).
   That function does a genuine **server-side fetch of the Instagram/TikTok/
   YouTube post page itself** (SSRF-guarded, spoofed browser UA), scraping
   `og:description` / `twitter:description` meta tags for the caption text,
   plus a supplementary fetch of each platform's oEmbed endpoint for a clean
   thumbnail/author. This is not an edge case or a rare failure mode — it is
   the path that runs for **every** Instagram/TikTok/YouTube import while
   the flag stays at its default (off).

Suppr's legal posture on this is unambiguous: server-side fetching of
Instagram/TikTok post bodies for recipe extraction is blocked as a
*permanent design*, with the caption-only rebuild conditionally approved
as its replacement. `fetchSocialPostMeta()` is exactly the server-side
post-body fetch that posture blocks — and it is the code path that
actually runs in production today, because the safe replacement is
default-off. The two paths were never meant to coexist this way; the
caption path was built to *replace* the fetch path, not sit behind it as
an unused fallback.

The gap between policy and code shows up inside the same route: the newer
Supadata transcript-acquisition adapter *does* self-gate — for
TikTok/Instagram it returns `blocked_by_policy` and no-ops unless
`IG_TT_IMPORT_ENABLED` is on (`app/api/recipe-import/route.ts`, ~line 219).
The older `fetchSocialPostMeta()` call feeding the primary caption/title
extraction has no equivalent gate. One code path in the file respects the
legal posture; the other, which runs first and more often, does not — an
unresolved inconsistency, not a settled exception.

**Open legal question:** whether any part of this fallback — specifically
the oEmbed metadata call, as distinct from the HTML/meta-tag scrape — is
defensible as an "official path" carve-out that the original posture
decision didn't anticipate. This hasn't been ruled on. It's the
HTML-scrape leg, not the oEmbed leg, that actually does the caption
extraction; oEmbed only supplies a thumbnail/author name.

Until that question is resolved:
- Do not describe Instagram/TikTok import as shipped, compliant, or "safe
  by design" in any external-facing material — internally it is a known,
  live gap, not a resolved feature.
- Treat "we never fetch from Instagram/TikTok" as **false** while this
  fallback is live — it directly contradicts the honest-fetcher framing
  already shipped for the web/blog path, which explicitly bans "we never
  use bots" language for the same reason: it isn't true, and the honest
  framing is stronger anyway.
- Flipping `IG_TT_IMPORT_ENABLED` to `true` — which would make the safe
  path the *actual* default and retire reliance on the fallback — needs
  DMCA designated-agent registration (owner: Grace; still open) and legal
  sign-off on the privacy-notice/DMCA copy. Flipping the flag does not, by
  itself, remove the fallback code path — that removal is separate
  follow-up work, not yet scheduled.

## Entry Points

### Mobile (iOS)
1. **Share sheet** (iOS) — share a recipe URL from Safari/Instagram/TikTok to Suppr
2. **Clipboard auto-detect** — open the Import screen, app detects a recipe URL on clipboard
3. **Manual paste** — paste a URL into the import screen input field
4. **Deep link** — `suppr://import?url=...`
5. **Bulk photo** (Pro, primary path; `import-progress-v2`) — "Import from
   photos" opens a multi-select picker; each photo imports as its own recipe
   into the queue drawer

### Web
- **Canonical route:** `/import` (`app/(product)/import/page.tsx`). Like
  every `(product)` route, the page component returns `null` on purpose —
  the shared shell at `app/(product)/layout.tsx` mounts `HomePageClient`
  (→ `src/app/App.tsx`), which derives the active view from the path and
  renders `<RecipeUpload mode="import" />` for the `import` view. The
  import surface offers: a "Import from" source grid (TikTok / Instagram /
  YouTube / Website), a "Paste a recipe link" URL field, and a photo
  "Extract from image" affordance.
- **In-app navigation:** the desktop sidebar / "Import instead" toggle on
  `/create` route to `/import` via `navigateToView("import")`.
- `/import` once rendered a blank white page, because the
  `pathDerivedView` map in `App.tsx` didn't list the `import` (or
  `create`) segment, so the URL never switched the view to the
  already-built import UI. That's fixed — the map now includes both
  segments, pinned by `tests/unit/webRouteCompletion.test.ts` (route
  wiring) and `tests/unit/recipeImportSurface.test.tsx` (rendered import
  UI). The web import flow reuses the same `/api/recipe-import`
  (URL/social) and `/api/recipe-import/image` (photo OCR) routes as
  mobile — no platform-specific parse logic.

### Mobile idle surface (`recipe-import-redesign`, 2026-06-09)

The mobile import idle (`apps/mobile/app/import-shared.tsx`) was un-boxed to
editorial-premium parity, **flag-gated** behind `recipe-import-redesign` (the
legacy monolithic cream `panelCard` slab stays live in the `else` until the
flag holds 100% for two weeks, per CLAUDE.md). The redesigned idle renders, on
the white page ground, as distinct sections separated by 32pt:

- **Header** — serif H1 "Import a recipe" + "From any link, social post or
  website." (the in-card wordmark is dropped on this sub-screen; the top bar
  already carries the `IMPORT` eyebrow).
- **Paste field** (cream fill, `Radius.xl`/12) + inline platform hint + the
  `Import` CTA, with **Use clipboard** and **Import from photo** as tertiary
  text-link rows below.
- **WORKS WITH** trust-chip row — a **non-tappable** row of neutral mono
  platform chips (TT / IG / YT / W). This replaces the old "IMPORT FROM" grid,
  which was a fake four-way router (all four tinted tiles called
  `onPasteFromClipboard`). Platform-specific guidance still surfaces via the
  inline hint when an IG/TT/YT link is typed.
- **RECENT IMPORTS** — neutral mono source badges (cream fill, ink text,
  hairline border) replacing the old solid-black / Instagram-pink badges.

**Photo OCR is Pro-gated.** `/api/recipe-import/image` returns `403
pro_required` for Free users. The "Import from photo" affordance now carries a
Lock + "Pro" badge and routes Free users to `/paywall?from=import_photo` on tap
(gate surfaced **before** the tap, not after the request fails). Pro users open
the picker directly. Tier is resolved from the cached tier (synchronous, no
gate flash) then reconciled against the live `profiles.user_tier` read.

Source-pinned by `apps/mobile/tests/unit/importSharedRedesign.test.ts`; the
Maestro flow `25_import_shared.yaml` + e2e `25-import-shared.test.ts` assert the
new copy.

> **Parity gap (web, deferred):** the equivalent web `RecipeUpload`
> (`src/app/components/RecipeUpload.tsx`) does not yet have the WORKS WITH
> trust row, the IG/TT caption-preview trust card, or the unified "how this
> fits your day" labelled-bar treatment. This is a known follow-up, not a
> silently dropped requirement.

**Platform status (2026-07-18): mobile is ahead of web here, not equal to
it.** The redesigned idle surface above — WORKS WITH row, caption-preview
trust card, unified verdict bar — is mobile-only today. Do not describe or
screenshot the idle-import surface as "the same on both platforms" until
the web follow-up ships; a reviewer or marketing pass that treats the
mobile screen as representative of web will overstate what's live there.

### Method tiles deliver their method (2026-06-18)

The three-method tile row (**Photo / Paste text / Scan**) must DELIVER the
method it advertises — tapping a tile lands on the matching affordance, not a
generic screen.

- **Photo** — Pro-gated picker (`onPhotoImportPress`, mobile) / file input
  (`onPhotoMethodPress`, web). Already delivered correctly; untouched by
  this fix.
- **Paste text** — opens a paste-ingredient affordance on arrival.
- **Scan** — opens the barcode scanner on arrival.

**Mobile** (`apps/mobile/app/import-shared.tsx`): both the "Paste text" and
"Scan" tiles route to `/create-recipe` — which already owns the paste-list modal,
the barcode scanner, AND the photo picker — passing a method hint:
`/create-recipe?autoPaste=1` and `/create-recipe?autoBarcode=1`.
`create-recipe.tsx` reads the param and fires the matching affordance once on
mount, then clears the param so a back-nav doesn't re-open it — mirroring the
existing `?autoPhoto=1` handshake used by `CreateRecipeActionSheet`. (Before:
"Paste text" routed to `/recipe/create`, the guided wizard, which has **no** paste
affordance and so dead-ended; "Scan" routed to `/create-recipe` with **no** param,
so the scanner never opened.)

**Web** (`src/app/components/RecipeUpload.tsx` + `src/app/App.tsx`): the tiles
pass a method hint through `onSwitchToCreate("paste" | "scan")`. `App.tsx` stores
it in `createInitialMethod` state and threads it to the create-mode
`<RecipeUpload createInitialMethod=... />`; the create view auto-opens the
paste-ingredient-list dialog (`paste`) or the barcode swap picker + camera scanner
on the first ingredient row (`scan`) once on mount (ref-guarded). The header
"Create instead" switch passes no hint and lands on the plain create form.

> **Web scan path:** web genuinely has a barcode scanner (`BarcodeDetector` +
> `getUserMedia`, `startScanner`), but it lives inside the per-ingredient swap
> picker (it applies a scanned product as a match override on an ingredient
> row). The `scan` hint reuses that real path by opening the picker on the
> first (always-present) ingredient row — no parallel scanner was invented.

Pinned by `tests/unit/recipeImportSurface.test.tsx` (web behavioural),
`tests/unit/recipeUploadImportMethodTiles.test.ts` (web source guard), and
`apps/mobile/tests/unit/importMethodTileDelivery.test.ts` (mobile source guard).

## Flow

### Step 1: URL Detection
```
User opens Import screen
  → App checks: router params → deep link → clipboard (3 retry attempts at 450ms/600ms/1100ms)
  → If ONE URL found, auto-start import
  → If MORE than one URL found (paste/share blob), enqueue one job per link
    (see "Multi-link URL import" below)
  → If no URL, show manual paste input
```

### Step 2: Recipe Extraction
```
POST /api/recipe-import with URL
  → App shows progress (see "Staged progress + queue" below)
  → API fetches HTML, extracts JSON-LD
  → Returns parsed recipe with ingredients, instructions, macros
```

#### Staged progress + queue (`import-progress-v2`, 2026-06-08)

Borrowed from Julienne's best-in-class import UX (see
`docs/research/2026-06-08-julienne-strengths.md` §2.6). Replaces the single
opaque "Adding recipe… 15–30s" spinner with a **persistent, non-blocking
queue drawer** that shows live per-stage progress, queue position for
concurrent imports, and per-recipe cancel/retry. **Flag-gated**; the legacy
single-`importing`-state + `ImportLoadingSkeleton` path stays live in the
`else` until the flag holds 100% for two weeks.

**Honest stage machine** (`src/lib/recipes/importProgressMachine.ts`,
shared web ↔ mobile). The stages map only to boundaries the client genuinely
observes — extraction is one atomic server POST (this queue redesign doesn't
touch that backend), so the client never fakes sub-stages inside the server call:

```
queued      → "In queue (#N) — starts when a slot opens"   (waiting for a concurrency slot)
confirming  → "Confirming recipe type"                     (client validates + dispatches)
extracting  → "Extracting recipe details" / "Reading the   (server round-trip in flight —
               photo" / "Reading the post"                  honest-indeterminate, the long leg)
organizing  → "Organizing ingredients and steps"           (client normalises + classifies)
done        → "Ready to review"                            (terminal-success; tap to open)
cancelled   → "Cancelled"                                  (user aborted; the fetch is aborted)
failed      → reuses importErrorCopy message                (terminal; retry offered iff retryable)
```

**Queue** (`src/lib/recipes/recipeImportScheduler.ts`): a slot-based
scheduler (default concurrency 2) runs N imports across M slots. `enqueue`
is idempotent by id (a re-render / duplicate share intent can't double-run);
`cancel` aborts the in-flight `fetch` via an `AbortController` and frees the
slot; `retry` re-runs a failed + retryable job under the same id. Slots
always release in `finally` so a thrown runner can never leak one.

**Scope:** v2 wires the **URL/link** AND **bulk photo** paths into the queue
on BOTH platforms. Caption imports keep the inline single-import path on both
platforms for now (parity is preserved — neither platform queues caption
yet). Caption queue parity is a known, tracked follow-up — not a silently
dropped requirement.

**QA / visual-validation harness (`app/dev/import-queue`).** An internal,
auth-free page that renders the real `RecipeImportQueueDrawer` against
isolated, seeded `RecipeImportScheduler` instances — mock jobs only, no PII,
no live `/api/recipe-import` calls — so an agent or Grace can see every
terminal / mid-flight state side by side instead of waiting through a real
15–30s extraction per state. Four fixed frames: a single import parked
mid-`extracting`; a backlog (two active + one `queued`, exercising the "In
queue (#N)" copy); a mixed batch (one `done` → tap-to-open, one retryable
`timeout` failure, one still in flight); and a non-retryable failure
(`no_recipe_extracted` — Retry hidden, Dismiss only, per the
retry-eligibility rule above). It is a **dev/QA harness, not a user-facing
route**: reachable locally, in CI, and on Vercel preview deploys, but the
whole `/dev/*` prefix is blocked on the production (`suppr.club`) deployment
(`middleware.ts`, `isDevPreview()` gated on `VERCEL_ENV === "production"`),
so it never renders for a real user. Companion coverage: Storybook
(`src/app/components/suppr/recipe-import-queue-drawer.stories.tsx`) for the
same component in isolation, and the mobile equivalent
(`apps/mobile/app/dev/import-queue-states.tsx`, reachable in a dev build at
`suppr:///dev/import-queue-states`) for cross-platform state parity. This is
how the five queue-drawer states were screenshotted and compared web ↔ iOS
before the `import-progress-v2` ship.

#### Bulk photo import — the primary import path (`import-progress-v2`, 2026-06-17)

PDF cookbook import is demoted; **multi-photo import is the primary import
path**. When `import-progress-v2` is on:

- **Mobile** (`apps/mobile/app/import-shared.tsx`): the "Import from photos"
  affordance opens `launchImageLibraryAsync({ allowsMultipleSelection: true,
  selectionLimit: 12 })`. Each picked photo becomes ONE `image` job in the
  shared scheduler.
- **Web** (`src/app/components/RecipeUpload.tsx`, `mode="import"`): the Recipe
  photo card shows a `<input type="file" multiple>`; selecting files enqueues
  one `image` job per file immediately (no separate "Extract from image"
  button in this path).

Every photo POSTs independently to `/api/recipe-import/image` (which takes
exactly one image per request), walks the same honest stage machine
(`extracting` → "Reading the photo" → `organizing` → `done`), and lands as a
row in the persistent queue drawer with its own progress / cancel / retry.
Photos import concurrently across the scheduler's slots. The
**most-recently-finished** photo populates the review form (last-wins,
identical to the URL path); every photo stays listed in the drawer regardless.

Shared, drift-proof pieces (`src/lib/recipes/photoImport.ts`, imported by
mobile via `@suppr/shared/recipes/photoImport`):
- `mapImageImportResponseToRecipe` — the single chokepoint that maps the image
  route's JSON → the canonical `ApiImportedRecipe` both platforms persist.
  Never invents macros: a missing nutrition block leaves macros `null` (repo
  no-guessing rule), not zeroed.
- `photoSeedTitle(i, total)` — calm "Photo 2 of 4" / "Photo" seed labels.
- `BULK_PHOTO_IMPORT_MAX = 12` — caps the paid AI-vision fan-out per pick;
  over-pick is trimmed with a calm notice.
- `importJobIdForImage(localRef)` — deterministic per-photo id (asset id/URI on
  mobile, `name:size:lastModified` on web) so a duplicate enqueue of the same
  picked photo dedupes, the way `importJobIdForUrl` dedupes a URL.

The legacy single-photo inline path (mobile `importing` state +
`ImportLoadingSkeleton`; web "Extract from image" OCR button) stays alive when
the flag is OFF, and remains the create-mode default on web.

Pinned by `tests/unit/photoImport.test.ts` (shared mapper, seed labels, macro
no-guessing) and `tests/unit/importProgressMachine.test.ts` (image job-id
dedupe).

**Analytics** (same event names web + mobile, via the shared
`useImportQueue` hook):
- `recipe_import_stage_changed { stage, previousStage, kind, platform, queuePosition?, errorCode?, elapsedMs }`
- `recipe_import_enqueued { kind, platform, activeCount, queuedCount }`
- `recipe_import_job_action { action: "cancel" | "retry", kind, platform, errorCode?, stage }`

Distinct from the server-side `recipe_import_pipeline_stage` (which traces
extraction internals for nutrition-debug) — the v2 events measure the
front-end *experience* (time-at-stage, cancel points, batch size).

#### Multi-link URL import (`import-progress-v2`, 2026-06-30)

The URL-share path mirrors the bulk-photo fan-out. When a paste / share /
deep link / clipboard blob resolves to **more than one** link, each link
enqueues its own `url` job into the same scheduler — one drawer row + live
progress + cancel/retry per link, links importing concurrently across slots,
and the **most-recently-finished** populating the review form (last-wins,
identical to the single-URL and bulk-photo paths). A **single** link (or the
queue UX OFF) takes the unchanged single-URL path.

- **Mobile** (`apps/mobile/app/import-shared.tsx`): the manual-paste submit,
  clipboard auto-detect, router/share params, and warm deep links all resolve
  via the multi-aware resolvers and route through `runImportMany`.
- **Web** (`src/app/components/RecipeUpload.tsx`): `runImportFromUrl` extracts
  every link from the URL input and fans out one job per link (single link
  keeps the caption-preview + raw-fallback behaviour).

Shared, drift-proof pieces (`src/lib/recipes/urlImportJob.ts`, imported by
mobile via `@suppr/shared/recipes/urlImportJob`):
- `extractAllHttpUrls(text)` — pulls EVERY link out of a blob: global
  `http(s)` match + the scheme-less known-host forms the mobile share path
  recognises (`instagram.com/...`, `tiktok.com/...`, etc.), normalised to
  `https://`, trailing punctuation stripped, de-duped (first-seen order), and
  **capped at `BULK_PHOTO_IMPORT_MAX` (12)** so one paste can't fan out an
  unbounded number of paid imports.
- `buildUrlImportJob(url, { fetchRecipe, land, titleOf })` — the one-URL-per-job
  `EnqueueSpec` (id, host seed title, `extracting → fetch → organizing →
  setTitle → land` run) shared verbatim by both platforms; deterministic id via
  `importJobIdForUrl` keeps a repeated link a scheduler no-op.

No feature flag — multi-link extends an existing affordance whose queue UI
already exists (per the visual/structural-change flag carve-out: "extends an
existing affordance"). Pinned by `tests/unit/urlImportJob.test.ts` (web) and
`apps/mobile/tests/unit/resolveImportUrl.test.ts` (mobile).

### Step 3: Review & Tag (NEW)
```
App shows review screen:
  → Recipe title and per-serving macros
  → MealTypePicker pre-populated with auto-classified tags
  → User can toggle Breakfast/Lunch/Dinner/Snack tags
  → Tap "Save to Library"
```

### Step 4: Save
```
saveImportedRecipe() writes to Supabase:
  → Creates recipe row with macros, servings, meal_type array
  → Creates recipe_ingredients rows with per-ingredient macros
  → Creates saves row (auto-saves to library)
```

### Step 5: Post-Save
```
Success screen with two CTAs:
  → "View recipe" → navigates to recipe detail
  → "Review ingredients" → navigates to verify screen
```

**Magic moment (`import_magic_moment`, default-OFF).** When the flag
is ON and the user has NOT requested reduced motion, the success sheet arrives
with a subtle fade + scale settle and a one-shot CALM `log-confirm`
`WinMomentPlayer` overlay (the quiet gold "Logged" beat — the loud `goal-hit`
tier stays reserved for the daily calorie-ring landmark). The overlay plays
once, then unmounts. Reduce-motion (`AccessibilityInfo.isReduceMotionEnabled`
on mobile / `prefers-reduced-motion` on web) → the sheet appears instantly with
no overlay. Flag OFF (the shipped default) → zero visual change.

- Mobile: `apps/mobile/components/import/ImportSuccessCelebration.tsx` wraps the
  success sheet inside `apps/mobile/app/import-shared.tsx`.
- Web: gate + overlay live in `src/app/components/suppr/import-success-sheet.tsx`
  (rendered from `RecipeUpload`'s `mode === "import"` success branch).
- Flag registered in `KNOWN_DEFAULT_OFF_FLAGS` in both `src/lib/analytics/track.ts`
  and `apps/mobile/lib/analytics.ts`.

## Edge Cases
- **Pinterest URLs** — resolved to actual recipe source via redirect following
- **Instagram/TikTok/YouTube** — see the **Legal caveat** above: the safe
  caption-only path needs `IG_TT_IMPORT_ENABLED` (default OFF); with the
  flag off, both platforms fall back to a live server-side fetch of the
  post page + oEmbed endpoints whose ToS-compliance is unresolved. Either
  path additionally needs an AI provider key configured server-side, else
  the route returns `ai_not_configured` (503) / `openai_not_configured`.
- **Sites that block scraping** — UA spoofing with Chrome UA string
- **No JSON-LD** — error with clear message: "No Recipe JSON-LD found"
- **Rate limited** — 20 imports per minute per user
- **Not signed in** — shows sign-in prompt, preserves URL
- **Saved IG/TikTok collection URLs** — the unified Import sheet's
  `classifyImport` recognises saved-collection links (Instagram
  `/{user}/saved/…`, TikTok `/collection/…`) as their own `collection`
  kind (ENG-1581). Import does **not** attempt to parse the whole
  collection as one recipe; it shows guidance to share or paste each post
  link separately. A full bulk-collection import experience is out of
  scope for this pass.
- **`verifyIngredients` throws mid-import** — the import still persists,
  with ingredient + recipe macros at zero and the honest under-count note
  surfaced on review (documented behaviour, not a crash path) — see
  `docs/product/nutrition-approximation-policy.md` G3.

## Related Documents
- [Journey: Verify Ingredients](verify-ingredients.md) — the deep
  per-ingredient correction step right after this one
- [Journey: Discover & Library](discover-and-library.md) — where a saved
  import lives, and how it gets cooked
- [Journey: Creator Platform](creator-platform.md) — attribution, DMCA
  takedown, and reporting for imported content; also the Discover creator
  rail this doc's imports never populate (ENG-1535 made that surface
  real-only and self-hiding until genuine creators exist)
- [Journey: Create a Recipe](create-recipe.md) — the adjacent "write my
  own" flow
- [Journey: Import a Cookbook (PDF)](import-cookbook.md) — the parallel
  mobile-only batch path
- [Decision: IG/TT recipe-import legal posture (2026-04-30)](../decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md)
- [Decision: Recipe-import posture hardening + creator-claim rules (2026-06-03)](../decisions/2026-06-03-recipe-import-posture-part1-part2.md)
- [API: Recipe Import](../api/endpoints.md#post-apirecipe-import)
- [Technical: Recipe Import Pipeline](../technical/architecture.md#recipe-import)
