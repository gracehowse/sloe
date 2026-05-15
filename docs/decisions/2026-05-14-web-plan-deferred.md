# Web meal plan — deferred (2026-05-14)

**Status:** Resolved — Web Plan deferred to post-launch.
**Authority:** 2026-05-12 premium-bar audit (Group E Card 5), confirmed 2026-05-14.
**Owner:** Grace.

## Decision

The web meal-plan surface (`/planner`) is deferred until after the iOS app has gained traction.

The Plan tab is the most complex surface in the product — day-card grids, drag-to-reorder meals, generation flow, recipe selection, portion modification — and rebuilding it as a full-quality web experience requires significant engineering. Building it now, before the iOS product has validated the UX and before there are meaningful web users with meal plans, risks over-engineering for an audience that doesn't yet exist.

## What ships instead

- `/planner` is an authed empty-state page: `CalendarDays` glyph + "Your meal plan lives in the iOS app" headline + App Store CTA + `/plan` fallback link. Created 2026-05-14 (`app/planner/page.tsx`).
- `/plan` is a read-only 301 to the existing `/home?view=plan` SPA route (already shipped).
- The shopping list at `/shopping` is a full web surface — it gets auto-populated when a plan is generated on mobile and shared via Supabase Realtime.

## What this is NOT

- This is not a permanent exclusion. Once the iOS app is publicly launched and 1,000+ users have meal plans, the web planner becomes a natural upgrade. The route is reserved.
- The Plan API (`supabase.meal_plan_days`) is already schema-complete — a web read layer can be built without schema changes.

## Reopen criteria

Reopen when any of:
- iOS MAU > 5,000 (plan demand validated)
- A significant number of users request the web plan explicitly (PostHog or support tickets)
- A collaborator feature (shared household planning) drives a web requirement

## Cross-platform parity note

Per `CLAUDE.md`, web and mobile must stay in sync. The `/planner` stub is an explicit carve-out from this rule, documented here. The carve-out covers: plan generation, plan display, portion modification on web. It does NOT cover: shopping list (already web-parity), recipe library (web-parity), fasting (web-parity as of 2026-05-14).
