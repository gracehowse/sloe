# User Journey: Import a Recipe

**Audience:** Product / Design

## Overview
User finds a recipe online and imports it into their Suppr library with verified nutrition data.

## Related journeys

- **[Import a cookbook (PDF)](import-cookbook.md)** — batch digitise a scanned book into Library (Pro); build the week in Plan separately.

## Entry Points

### Mobile (iOS)
1. **Share sheet** (iOS) — share a recipe URL from Safari/Instagram/TikTok to Suppr
2. **Clipboard auto-detect** — open the Import screen, app detects a recipe URL on clipboard
3. **Manual paste** — paste a URL into the import screen input field
4. **Deep link** — `suppr://import?url=...`
5. **Bulk photo** (Pro, primary path; `import-progress-v2`) — "Import from
   photos" opens a multi-select picker; each photo imports as its own recipe
   into the queue drawer (ENG-735)

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
- **ENG-669 (launch-blocker, fixed):** `/import` once rendered a blank
  white page because the `pathDerivedView` map in `App.tsx` did not list
  the `import` (or `create`) segment, so the URL never switched the view
  to the already-built import UI. The fix adds those segments to the
  path→view map. Pinned by `tests/unit/webRouteCompletion.test.ts`
  (route wiring) and `tests/unit/recipeImportSurface.test.tsx` (rendered
  import UI). The web import flow reuses the same `/api/recipe-import`
  (URL/social) and `/api/recipe-import/image` (photo OCR) routes as
  mobile — no platform-specific parse logic.

### Mobile idle surface (`recipe-import-redesign`, ENG-997, 2026-06-09)

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

> **Parity (deferred — see ENG-997 follow-up):** the equivalent web
> `RecipeUpload` (`src/app/components/RecipeUpload.tsx`) does not yet have the
> WORKS WITH trust row, the IG/TT caption-preview trust card, or the unified
> "how this fits your day" labelled-bar treatment. These web parity items are
> tracked, not silently dropped.

### Method tiles deliver their method (ENG-1211, 2026-06-18)

The three-method tile row (**Photo / Paste text / Scan**) must DELIVER the
method it advertises — tapping a tile lands on the matching affordance, not a
generic screen.

- **Photo** — Pro-gated picker (`onPhotoImportPress`, mobile) / file input
  (`onPhotoMethodPress`, web). Unchanged by ENG-1211.
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
    (ENG-981, see "Multi-link URL import" below)
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
observes — Sloe's extraction is one atomic server POST (this ticket does NOT
touch that backend), so we never fake sub-stages inside the server call:

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
yet). Caption queue parity is tracked, not silently deferred — see the Linear
"Import-progress staged state-machine + queue UX" issue follow-up.

#### Bulk photo import — the primary import path (`import-progress-v2`, ENG-735, 2026-06-17)

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

#### Multi-link URL import (`import-progress-v2`, ENG-981, 2026-06-30)

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

## Edge Cases
- **Pinterest URLs** — resolved to actual recipe source via redirect following
- **Instagram/TikTok** — parsed via OpenAI caption extraction (requires API key)
- **Sites that block scraping** — UA spoofing with Chrome UA string
- **No JSON-LD** — error with clear message: "No Recipe JSON-LD found"
- **Rate limited** — 20 imports per minute per IP
- **Not signed in** — shows sign-in prompt, preserves URL

## Related Documents
- [API: Recipe Import](../api/endpoints.md#post-apirecipe-import)
- [Technical: Recipe Import Pipeline](../technical/architecture.md#recipe-import)
- [Journey: Verify Ingredients](verify-ingredients.md)
