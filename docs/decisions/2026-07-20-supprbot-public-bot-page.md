# SupprBot public bot-contact page — built for real (ENG-1570)

**Date:** 2026-07-20
**Trigger:** Legal review of ENG-1457 (the SupprBot rebrand ticket) surfaced
that `app/terms/page.tsx` and `app/help/HelpClient.tsx` both promise, in
live legal copy, that Sloe's recipe-import fetcher uses "an identified
`SupprBot` user agent that links to a public bot contact page" —
`https://getsloe.com/bot`, matching the production User-Agent
(`app/api/recipe-import/route.ts` x2, `src/lib/recipe-import/extractSocialRecipe.ts`).
That URL did not resolve anywhere in the repo (no route, no rewrite, no
static file). Confirmed live: `curl -sI https://getsloe.com/bot` returned
`307 → /login` — not a 404, just the app's default auth-middleware redirect
catching an unmatched path.

## Decision

Build the page for real at `app/bot/page.tsx`, reachable without auth (added
to `middleware.ts` `PUBLIC_ROUTES`), and link the existing "public bot
contact page" / "public bot page" text in Terms and Help to it. Covers: what
SupprBot is, why it fetches (user-initiated recipe import, not crawling),
how to identify it (exact UA string), how to block it, and a contact
channel (`legal@getsloe.com` — reused, not a new `bot@` mailbox; it already
exists per Terms and already covers "questions about these terms").

## The robots.txt question — deliberately narrow

The fix brief for this ticket asked the new page to cover "how to block it
(robots.txt directive + the exact UA token to match)". Checking the actual
fetch pipeline (`app/api/recipe-import/route.ts`,
`src/lib/recipe-import/extractSocialRecipe.ts`) found **no robots.txt
parsing anywhere** — SupprBot does not fetch or honour a target site's
`robots.txt` before making a request. Writing "add a robots.txt Disallow
line and we'll respect it" on the new page would have been a **new false
legal claim**, which is the exact failure mode this ticket exists to fix.

Two options were on the table:

1. **Implement real robots.txt-parsing enforcement** in the fetch path so
   the claim would be true. Rejected for this ticket: it's a runtime
   fetch-behaviour change (new dependency, per-import network round-trip to
   fetch+parse a third-party `robots.txt`, its own failure modes if that
   fetch hangs/errors, its own test surface) — a materially different risk
   profile than a static legal-copy fix, and not what was scoped or
   reviewed here.
2. **Write the page to state current behaviour accurately**: the reliable
   block mechanism today is User-Agent string matching (the token is fixed
   and never spoofed, so server/CDN/WAF-level blocking on `SupprBot` works
   immediately with no code change on our side); robots.txt is not yet
   parsed; a contact channel covers anything else. Chosen.

Real robots.txt enforcement remains a legitimate future improvement — it
strengthens the "operators can cleanly opt out" posture beyond what
UA-blocking alone gives. It should be scoped and shipped as its own ticket
with its own review, not folded into a legal-copy fix. Flagging here rather
than opening a placeholder ticket immediately (no urgency signal from
Grace); revisit if a real operator ever reports relying on robots.txt.

## robots.txt for getsloe.com itself

No `robots.txt` existed anywhere in the repo before this change (no
`app/robots.ts`, no `public/robots.txt`) — every crawler had an undocumented
implicit default-allow on getsloe.com. Added `public/robots.txt`:
`User-agent: * / Allow: /` (zero behavioural change from the prior
no-file-at-all default) plus a comment documenting the SupprBot identity
and pointing to `/bot`.

Important directionality note, in case a future editor is tempted to add a
`User-agent: SupprBot` block here expecting it to mean something: it
wouldn't. `getsloe.com/robots.txt` governs crawlers visiting **getsloe.com**.
SupprBot never crawls getsloe.com — it fetches *other* sites at a user's
request. A third party wanting to block SupprBot needs to act on **their
own** server (UA matching, per `/bot`), not on ours. The comment in
`public/robots.txt` is purely a discoverability aid for a webmaster who
reflexively checks `getsloe.com/robots.txt` after seeing the UA in their
logs — not an enforcement mechanism.

**Explicitly out of scope, not silently dropped:** broader SEO/crawl-policy
decisions for getsloe.com (e.g. `Disallow` rules for `/api/`, `/account`,
auth-gated app routes, a `Sitemap:` reference) — this file ships as
allow-all specifically so it makes zero SEO-behaviour change while closing
the documentation gap. That's a separate product decision with its own
tradeoffs, not a legal-copy fix.

## UA canonicalisation

`scripts/seed-discover-recipes.ts:35` and
`tests/integration/recipeImportLiveSites.test.ts:33` sent
`SupprBot/1.0 (+https://suppr-club.com/bot)` — a legacy domain that also had
no bot page. Both now send the same canonical
`SupprBot/1.0 (+https://getsloe.com/bot)` as the two production call sites.

## Verification

- Live: `curl -sI https://getsloe.com/bot` before the fix → `307` to
  `/login`; the fix makes that path resolve to the real page instead once
  deployed.
- `tests/unit/botContactPage.test.ts` (new) pins: the page carries the exact
  production UA string + a real contact address; it does NOT claim
  robots.txt compliance it doesn't have; `/terms` and `/help` link to it;
  `/bot` is in `middleware.ts` `PUBLIC_ROUTES`; all four UA call sites
  (`route.ts`, `extractSocialRecipe.ts`, the seed script, the integration
  test) send the identical canonical string; `public/robots.txt` documents
  SupprBot without disallowing the site.
- Existing guards unaffected: `tests/unit/brandDriftSloe.test.ts` (pins
  `SupprBot` staying in Terms as infra, not brand) and
  `tests/unit/importFramingToSHelp.test.ts` (pins the five locked
  user-as-actor claims + the "no bots" denial staying absent) — neither
  asserts the exact "public bot contact page" / "public bot page" phrasing
  as a contiguous string, so hyperlinking it doesn't touch either guard.

## References

- Ticket: [ENG-1570](https://linear.app/suppr/issue/ENG-1570/public-bot-contact-page-promised-in-termshelp-getsloecombot-doesnt)
- `app/bot/page.tsx`, `middleware.ts`, `app/terms/page.tsx`,
  `app/help/HelpClient.tsx`, `public/robots.txt`,
  `scripts/seed-discover-recipes.ts`,
  `tests/integration/recipeImportLiveSites.test.ts`,
  `tests/unit/botContactPage.test.ts`
- `REBRAND.md` "Still suppr (intentional, infra not brand)" — why
  `SupprBot` itself is untouched here.
