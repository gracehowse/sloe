# Public routes — /dmca, /licences, /whats-new (2026-05-05)

**Status:** Resolved.
**Authority:** 2026-05-05 full-sweep audit (findings A1 + A2).
**Owner:** Grace / executor.

## Problem

The middleware's `PUBLIC_ROUTES` set omitted three routes that have to
be reachable without authentication:

1. **`/dmca`** — DMCA safe-harbor §512(c) is conditional on the
   takedown form being publicly accessible. An auth-gated DMCA route
   defeats the entire safe-harbor defense for OFF/Edamam ingestion
   and any user-shared content. Captured in audit as **P0 A1** with
   the screenshot showing `/dmca` rendering the `/login` form.
2. **`/licences`** — open-source licence acknowledgements page;
   same legal-surface concern as `/dmca`.
3. **`/whats-new`** — marketing/changelog surface. Cold traffic clicking
   a "What's new" social/email link saw the sign-in form, tanking
   content marketing. Audit **P1 A2**.

## Fix

One-edit change to [middleware.ts](../../middleware.ts) `PUBLIC_ROUTES`:
adds `/dmca`, `/licences`, `/whats-new`. Comment alongside cites the
DMCA legal reason so future reviewers don't gate them again by reflex.

## Validation

- Playwright regression test added at
  `tests/e2e/screenshots/web-public-routes-after.spec.ts` — asserts
  each of the three routes returns 200 and final URL does not
  contain `/login`. Captures one screenshot per route per viewport
  (desktop + mobile-web).
- Visual confirmation: `/dmca` now renders "Copyright & DMCA
  takedown" heading + the quick-submission form. See
  `docs/audits/2026-05-05-full-sweep/web/web-desktop-dmca.png` (before)
  vs `apps/mobile/screenshots/latest/after-A1-desktop-dmca.png` (after).

## Why this took until 2026-05-05

The 2026-05-04 audit caught the visual symptom (`/dmca` looked like
`/login`) but classified it as a capture-side issue rather than a
compliance gap. Today's sweep cross-referenced DMCA §512(c) language
and bumped it from capture-papercut to legal-blocker P0.

## Cross-platform

Web-only — mobile has no equivalent route (DMCA takedowns flow
through the public web URL, which is correct).

## Closes

- Audit finding A1 (P0)
- Audit finding A2 (P1)
- Notion task [`Audit P0] A1`](https://www.notion.so/35759b41503081908755e8c5a9f3ae8a) → mark Done
