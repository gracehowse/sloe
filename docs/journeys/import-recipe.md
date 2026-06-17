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

## Flow

### Step 1: URL Detection
```
User opens Import screen
  → App checks: router params → deep link → clipboard (3 retry attempts at 450ms/600ms/1100ms)
  → If URL found, auto-start import
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
