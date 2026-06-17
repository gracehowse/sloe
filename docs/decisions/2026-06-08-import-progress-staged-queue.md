# Import-progress staged state-machine + queue UX

**Date:** 2026-06-08 · **Area:** Recipe import / viral hook · **Status:** Resolved
**Flag:** `import-progress-v2` (web + mobile) · **Platforms:** Web + iOS

## Context

Recipe import is Suppr's **lead viral hook** (import-from-Reel → goals loop —
see `project_viral_growth_strategy`). The competitor teardowns
(`docs/research/2026-06-08-competitor-teardown-summary.md`, borrow #1) named
**Julienne's import UX** as the single highest-leverage, legally-clean,
pure-front-end thing to borrow: a staged-progress state machine + a
slot-based queue + a persistent cancel/retry drawer
(`docs/research/2026-06-08-julienne-strengths.md` §2.6). It directly
addresses the "30–60s of dead air" on our most-shared surface, which today
shows a single opaque spinner ("Adding recipe…").

## Decision

Ship a **shared staged state machine + slot-based scheduler** consumed by
both platforms, behind the `import-progress-v2` flag. Replace the single
`importing`-state spinner with a persistent, non-blocking **queue drawer**
showing live per-stage progress, queue position, and per-recipe
cancel/retry. The legacy path stays alive in the `else` per the CLAUDE.md
flag-gating rule.

### The honesty call (why 4 stages, not Julienne's 6)

Julienne surfaces `confirming → extracting → organizing → generating →
translating` because **their** client genuinely observes those boundaries
(it orchestrates per-platform acquisition client-side and awaits a separate
server extraction step). Sloe's extraction is **one atomic server POST**
(`/api/recipe-import` &c.), and this ticket explicitly does **not** touch the
extraction backend (a separate Supadata ticket covers streaming). So we map
ONLY to boundaries the client really controls, and we never fake sub-second
checkmarks for work we cannot see:

| Stage | Real boundary |
|---|---|
| `queued` | the scheduler is holding the job behind the slot limit |
| `confirming` | client validates the input + dispatches the request |
| `extracting` | the server round-trip is in flight (honest-indeterminate — the long leg) |
| `organizing` | the response is back; client normalises + classifies |
| `done` / `cancelled` / `failed` | terminal |

Julienne's `generating` (hero image) is intentionally absent: on Sloe,
hero-image generation is fire-and-forget AFTER save
(`/api/recipe-import/image-hero`) — it never blocks the import, so folding it
in as a blocking step would be exactly the theatre we're avoiding. This
honours the "no fakes / real validated functionality" rule and the
"SEE, don't just orchestrate" memory.

### Scope

v2 wires the **URL/link** import (the lead viral hook) into the queue on
both platforms. Image (OCR) + caption imports keep the inline single-import
path on both platforms for this iteration — **parity is preserved**: neither
platform queues image/caption yet. This is not a silent deferral; the
caption/image queue parity is a tracked follow-up on the Linear issue.

## Architecture

Shared (web `src/lib/recipes/*`, mobile via `@suppr/shared/recipes/*`):

- **`importProgressMachine.ts`** — pure, framework-agnostic state machine:
  legal transitions, terminal/active classification, calm Sloe stage copy,
  queue-position + batch-summary copy, and retry-eligibility
  (`isRetryableError` — transient/fetch errors retry; permanent input errors
  like `invalid_url` / `caption_too_short` don't).
- **`recipeImportScheduler.ts`** — slot-based concurrency engine (default 2
  slots). Real behaviour: idempotent `enqueue` (dedupe by id), `cancel` via
  `AbortController` (aborts the in-flight fetch), `retry` re-runs a
  failed+retryable job, slots release in `finally` (no leak on a thrown
  runner), validated transitions, single-slot synchronous stage-change
  listener so analytics never misses a fast intermediate stage.
- **`useImportQueue.ts`** — `useSyncExternalStore` binding; the ONE place
  the three analytics events are emitted, so web ↔ mobile fire identical
  names + payloads. Accepts an injected scheduler so tests + Storybook use
  isolated instances.

Presenters (platform-specific):
- Web: `src/app/components/suppr/recipe-import-queue-drawer.tsx` — fixed
  bottom-right floating panel (non-modal; user keeps importing).
- Mobile: `apps/mobile/components/import/ImportProgressDrawer.tsx` —
  footer-anchored panel; Lucide icons (Check / RefreshCw / X / CheckCheck).

Both reuse `importErrorCopy` for failure messaging (identical to the inline
import errors users already see).

## Analytics

Three new events (same name web + mobile), distinct from the server-side
`recipe_import_pipeline_stage` (nutrition-debug):

- `recipe_import_stage_changed { stage, previousStage, kind, platform, queuePosition?, errorCode?, elapsedMs }`
- `recipe_import_enqueued { kind, platform, activeCount, queuedCount }`
- `recipe_import_job_action { action, kind, platform, errorCode?, stage }`

## Tests

- `tests/unit/importProgressMachine.test.ts` (15) — transitions, classification, copy, retry eligibility.
- `tests/unit/recipeImportScheduler.test.ts` (19) — slot concurrency, queue position, cancel-aborts-fetch, slot-never-leaks-on-throw, idempotent enqueue, retry, history pruning.
- `tests/unit/useImportQueue.test.tsx` (6) — derived state + the analytics contract (the cross-platform event shape).

## Visual validation

- Web harness: `app/dev/import-queue` (Playwright-screenshottable, no auth) +
  Storybook `recipe-import-queue-drawer.stories.tsx`.
- Mobile harness: `apps/mobile/app/dev/import-queue-states.tsx`
  (`suppr:///dev/import-queue-states`).
- Captured + read on web (light + dark) and iOS sim before the orchestrator's
  commit; all five states render with parity (`screenshots/web-drive/import-v2/`,
  `apps/mobile/screenshots/agent/import-queue-mobile*.png`).

## Alternatives rejected

- **Full SSE streaming pipeline** — out of scope (don't touch extraction backend; separate Supadata ticket).
- **Cosmetic relabel of the existing fake timers** — dishonest progress; fails the no-fakes rule.

## Follow-ups (tracked, not silent)

- ~~Image imports → queue parity~~ **DONE 2026-06-17 (ENG-735).** Bulk photo
  import is now the primary import path: a multi-select picker (web `<input
  multiple>`, mobile `allowsMultipleSelection`) enqueues one `image` job per
  photo into this same scheduler. Shared mapping in
  `src/lib/recipes/photoImport.ts` keeps web ↔ mobile drift-proof; deterministic
  per-photo id via `importJobIdForImage`. See `docs/journeys/import-recipe.md`
  → "Bulk photo import". Pinned by `tests/unit/photoImport.test.ts` +
  `tests/unit/importProgressMachine.test.ts`.
- Caption imports → queue parity (still on the Linear "Import-progress
  staged state-machine + queue UX" issue).
- After the flag holds 100% for two weeks with no regression, remove the
  legacy inline-skeleton `else` branch (cleanup PR).
