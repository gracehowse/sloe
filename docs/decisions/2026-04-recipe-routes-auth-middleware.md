# Decision: Recipe pages and auth middleware (2026-04)

## Context

`middleware.ts` treats only a small set of paths as public (`/login`, `/help`, `/pricing`, `/privacy`, `/terms`, `/reset-password`, plus `/api/*` and static assets). **All other routes**, including `/recipe/[id]`, require a session; unauthenticated visitors are redirected to `/login`.

## Decision (current)

**Keep recipe detail behind auth** for the web app until product explicitly prioritizes public recipe SEO or share previews.

## Tradeoffs

| Approach | Pros | Cons |
|----------|------|------|
| **Auth-gated (current)** | Simple mental model; no accidental data leaks; matches “logged-in product” | No public OG previews for recipe URLs; shared links force login |
| **Public recipe + optional auth** | SEO, social previews, frictionless sharing | Must audit RLS, published vs private recipes, and crawler behavior |

## Revisit when

- Marketing or growth needs indexed recipe pages, or
- Share links from mobile should open a readable web recipe without signing in.

## References

- `middleware.ts` — `PUBLIC_ROUTES` and unauthenticated redirect.
