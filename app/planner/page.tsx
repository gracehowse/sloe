/**
 * /planner — permanent redirect to the canonical web plan route `/plan`.
 *
 * ENG-806 (Redesign — Design Direction 2026, 2026-05-31 design-director
 * review). Background: the web product has a fully-built plan surface at
 * `/plan` (the `(product)` route group mounts `HomePageClient` → the
 * `MealPlanner` view; the App shell derives the "plan" view from the
 * pathname — see `src/app/App.tsx`). `/planner` used to be a *separate*
 * stub page that dead-ended to a "your plan lives in the iOS app — get the
 * app" wall, even though `/plan` rendered the real, working web plan. Two
 * URLs, one working and one a dead-end, for the same surface.
 *
 * The earlier stub existed when web had no Plan surface at all (premium-bar
 * audit 2026-05-12). That gap is closed: `/plan` is the real thing. So the
 * fix is to collapse to ONE canonical web plan route — `/plan` — and make
 * `/planner` a permanent redirect to it. Any old link (push notification,
 * web share, marketing copy, bookmark) that used `/planner` now lands on the
 * real plan instead of a "get the app" wall.
 *
 * This is a pure routing fix with no visual surface of its own (the user
 * never sees the stub again — they land on `/plan`), so per CLAUDE.md it
 * needs no feature flag.
 *
 * Auth: both `/planner` and `/plan` are outside `PUBLIC_ROUTES`, so an
 * unauthed visit to `/planner` is 307'd to `/login` by middleware BEFORE
 * this redirect runs; an authed visit redirects here to `/plan` and the
 * shared shell gates from there. The redirect therefore can't leak the
 * plan surface to logged-out users.
 *
 * `permanentRedirect` emits an HTTP 308 (method-preserving permanent
 * redirect) so crawlers and clients update the canonical URL.
 */
import { permanentRedirect } from "next/navigation";

export default function WebPlannerRedirectPage(): never {
  permanentRedirect("/plan");
}
