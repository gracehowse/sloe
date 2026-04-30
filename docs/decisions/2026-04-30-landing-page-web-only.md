# Landing page is web-only by design (Carve-out)

**Date:** 2026-04-30
**Area:** Marketing / Mobile / Sync
**Status:** Resolved (intentional)
**Owners:** product-memory (carve-out), brand-manager

## Context

The 2026-04-30 sync-enforcer parity matrix flagged that the marketing landing page (`/` → `app/page.tsx` → `LandingPage.tsx`) exists on web (desktop + mobile-web) but has no native equivalent under `apps/mobile/app/`. There is no `/`, `/pricing`, or `/roadmap` route in the Expo app.

## Decision

**This is intentional. The App Store listing is the native equivalent of the landing page.**

A native landing page inside the app would only ever be seen by users who *already installed* the app — a conversion surface delivered after the conversion has happened. The App Store listing handles pre-install awareness; the in-app onboarding handles post-install activation. There is no in-app surface that needs the same content.

## Sync-enforcer carve-out

This file exists so subsequent sync-enforcer runs do not flag the absence as drift. If a future product call introduces a native landing/promo surface (e.g. for re-engagement of dormant users), this decision needs to be revisited.

## Mobile-web responsive behaviour (verified)

- `app/page.tsx` → `LandingPage.tsx` uses `hidden md:flex` on the narrative column so on phone viewports the layout collapses cleanly to a single card column. No mobile-specific shell required.
- The same responsive strategy applies to `/pricing` and `/roadmap`.
