# 2026-06-29 — Harden the report + takedown queue abuse defence (ENG-1226)

**Status:** Resolved
**Area:** Security / Imports / Legal
**Driven by:** security-reviewer (2026-06-22), as a launch gate for the IG/TT
recipe-import flow (`IG_TT_IMPORT_ENABLED`).
**Linear:** ENG-1226 (P0 launch-blocker)

## Problem

Two reviewer-queue endpoints gate the import launch:

- `POST /api/recipe-report` — the in-app "Report an issue" sheet (OSA/DSA
  review queue, ENG-1225 #19).
- `POST /api/dmca-takedown` — the public copyright takedown form on `/dmca`.

Both rate-limit by client IP and store the client IP in a `reporter_ip` audit
column. The client IP was originally derived from the **leftmost
`x-forwarded-for` hop**, which is fully client-supplied. A scripted attacker can
rotate/forge that header to:

1. **Bypass the per-IP cap** — every forged IP gets a fresh bucket, so the cap
   never bites and the attacker floods the human reviewer queue.
2. **Poison the audit field** — `reporter_ip` records whatever the attacker
   sent, making abuse triage worthless.

## Decision

Two layers, landed across two commits under ENG-1226.

### Part 1 — Trust only the platform-injected client IP (shipped 56ff4c2b)

`getTrustedClientIp` (`src/lib/server/clientIp.ts`) is the single source of the
client IP for both the rate limiter (`getIpFromHeaders` delegates to it) and the
`reporter_ip` audit on both routes. Preference order:

1. `x-vercel-forwarded-for` — Vercel **overwrites** this with the true client
   IP at the edge; it is not client-forgeable. Canonical trusted source in prod.
2. `x-real-ip` — also edge-injected (Vercel, or nginx/self-host behind a trusted
   proxy).
3. `x-forwarded-for` **rightmost** hop — self-host / local-dev fallback only.
   The rightmost entry is what the nearest trusted proxy observed; the forgeable
   leftmost is deliberately ignored.

Returns `null` when no header is present (local dev) → callers bucket as a
single `no-ip` key.

### Part 2 — Second factor on the in-app report endpoint (this change)

`/api/recipe-report` is only ever called from the **signed-in** recipe-detail
surface, so it now:

- Requires a valid Supabase session (`getUserIdFromRequest`) — returns **401**
  when absent, short-circuiting **before** the rate limiter so anonymous probes
  can't even reach (or drain) a bucket.
- Keys the rate limit per **(user id, trusted IP)** by passing `userId` into
  `rateLimit` (the P0-6 `…:user:<id>:<ip>` bucket shape from the
  [2026-04-25 rate-limit user-scoping decision](./2026-04-25-rate-limit-user-scoping.md)).
  An IP-rotating attacker can now only drain one bucket per compromised account,
  not bypass the cap entirely.

Client callers were already authenticated in context but weren't both attaching
the credential:

- **Web** (`report-recipe-dialog.tsx`) — same-origin `fetch`, so the Supabase
  auth cookie (`@supabase/ssr`) rides automatically. Made `credentials:
  "same-origin"` explicit so the contract can't be dropped silently.
- **Mobile** (`ReportRecipeSheet.tsx`) — cross-origin to the web API, session in
  AsyncStorage (not cookies). Switched to `authedFetch`, which attaches
  `Authorization: Bearer <access_token>`.

### Part 3 — DMCA stays public (deferred second factor)

`/api/dmca-takedown` is **deliberately anonymous** — copyright takedowns come
from non-users (creators / rights agents). It is **not** auth-gated. It keeps
IP-only scoping plus the part-1 trusted-IP hardening.

The stronger second factor for an anonymous public form is a CAPTCHA /
Cloudflare Turnstile challenge. That needs Cloudflare infra + keys only Grace
can provision, so it is **not built here** — tracked as a remaining item under
ENG-1226 (and noted inline in the route with a `// deferred: see ENG-1226`
comment). Until then, the trusted per-IP cap (5/hour) is the abuse defence for
the public takedown form.

## Why spoofing `x-vercel-forwarded-for` is not a concern on Vercel

A client can send any header it likes, including a fake `x-vercel-forwarded-for`.
This is safe because Vercel's edge **overwrites** `x-vercel-forwarded-for` (and
`x-real-ip`) with the observed client IP before the request reaches the function
— a client-supplied value is discarded, not trusted. The leftmost
`x-forwarded-for` hop is the only client-controllable entry, and we never read
it. On a non-Vercel host the platform headers are absent, so we fall back to the
rightmost `x-forwarded-for` hop (set by the trusted reverse proxy), still never
the forgeable leftmost. In local dev all platform headers are absent → `null` →
single `no-ip` bucket, which doesn't break the flow.

## Alternatives considered

- **Auth-gate the DMCA endpoint too.** Rejected — it would break the legally
  required path for non-users to file takedowns. Turnstile is the correct second
  factor, deferred on infra.
- **Add a two-tier (per-user AND per-IP) limiter on recipe-report.** Rejected for
  now, consistent with the P0-6 decision: the single per-(user, IP) bucket
  already closes both the rotation-bypass and shared-NAT-starvation modes.
- **Persist `reporter_user_id` on `recipe_reports`.** Out of scope here (needs a
  schema migration + `db:types` regen). Genuinely useful for reviewer triage —
  tracked as a follow-up, not silently added.

## Tests

- `tests/unit/trustedClientIp.test.ts` — forged leftmost XFF ignored;
  `x-vercel-forwarded-for`/`x-real-ip` preferred; rightmost-hop dev fallback;
  null when no header.
- `tests/integration/recipeReportRoute.test.ts` — 401 without session (and the
  limiter is not consumed); allowed with session AND `userId` passed to
  `rateLimit`; the stored `reporter_ip` uses the trusted value over a forged
  leftmost XFF.
- `tests/unit/reportRecipeDialog.test.tsx` — web fetch carries
  `credentials: "same-origin"`.
- `apps/mobile/tests/unit/reportRecipeSheet.test.tsx` — mobile POST carries the
  `Authorization: Bearer` header.
- `tests/unit/rateLimitInventory.test.ts` (existing meta-test) — now also covers
  `/api/recipe-report` as an authenticated route that passes `userId`.

## Remaining (needs Grace's infra decision)

- **Cloudflare Turnstile / CAPTCHA on `/api/dmca-takedown`** (ENG-1226) — needs
  Cloudflare account + site/secret keys provisioned.
