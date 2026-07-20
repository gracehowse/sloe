# User Journey: Creator & Social Loop

**Audience:** Product / Design / Engineering / Legal

**Status:** Real-only, currently unpopulated. The five invented personas were
retired by ENG-1535; Discover now hides the creator rail until genuine creator
rows exist. The follow graph and import-attribution legal machinery are
shipped, but there is still no in-product path for a real person to become a
creator.

## One-line purpose

Two things share a URL space (`/creator/[id]`) but are otherwise
independent: (1) the social loop — discover a creator, view their profile,
follow them, see more of their recipes in Discover's Following feed — and
(2) the legal machinery that makes importing someone else's recipe
defensible — attribution, a disclaimer, a link back to the source, blocked
photo/prose reproduction, an in-app report path, and a DMCA takedown
channel. The second is more load-bearing than the first: it's the reason
Suppr can import recipes from the open web at all.

## Scope

**In scope for this doc:**
- Creator profile page (`/creator/[id]`) — web SSR component + mobile route
- Follow / unfollow a creator
- Import legal attribution: source card, disclaimer, link back to the
  original, blocked photo/prose reproduction
- Report an issue (non-copyright content report)
- DMCA takedown (form, API route, `/dmca` policy page) — and specifically
  why its §512(c) safe harbour is **not yet legally effective**
- The retired "launch-partner" creator seed decision and the still-missing
  creator-onboarding write path
- Creator/trainer monetisation — named here as backlog, not built, so it
  isn't confused with anything in scope above

**Out of scope — covered by their own docs:**
- Parsing/importing a recipe from a URL, social share, or photo →
  [import-recipe.md](./import-recipe.md) — attribution (§4 below) is
  enforced at that import boundary, not here
- Where a saved/imported recipe lives, Library/Discover rendering, Recipe
  Detail, Cook Mode → [discover-and-library.md](./discover-and-library.md)
  — the Discover "Top creators" rail is a Discover surface; this doc
  covers what happens once you tap into it
- Deep per-ingredient nutrition correction → [verify-ingredients.md](./verify-ingredients.md)
- Writing a recipe from scratch → [create-recipe.md](./create-recipe.md)

## Creator trust posture — resolved 2026-07-20 (ENG-1535)

Grace chose to remove the five invented "launch partner" personas until
genuine creators exist. The shared `loadTopCreators` loader rejects their
fixed IDs on web and mobile, so the Discover rail self-hides immediately even
in an environment that has not run the cleanup migration yet. Migration
`20260720075508_eng1535_remove_synthetic_creators.sql` deletes the rows from
`public.creators`; recipe attribution is cleared by `ON DELETE SET NULL` and
synthetic follows are removed by `ON DELETE CASCADE`.

The creator components, RPC, profiles, and follow graph remain available for
genuine creator rows. What is still missing is the write/claim path that lets a
real person become a creator (§8). Until that exists and real creators opt in,
the honest Discover state is no creator rail—not fictional momentum.

## Where this sits in the loops

```
Discover "Top creators" rail ──▶ /creator/[id] (§2) ──▶ Follow (§3) ──▶ Discover "Following" feed scope
        (self-hides with no real rows)          │
                                                └─▶ tap a recipe ──▶ Recipe Detail

Recipe Detail byline (creator_id present) ──▶ /creator/[id] (§2)
        (only true for genuine creator attribution; imports/user creations do not carry creator_id)

import-recipe.md (parse → save) ──▶ Recipe Detail ──▶ attribution (§4) + blocked photo/prose (§5)
                                                    ──▶ Report an issue (§6) / DMCA takedown (§7)
```

The follow loop and the import-legal loop are **structurally separate** —
they share this doc because they're both "creator plane" concerns, but a
user can hit the attribution/disclaimer/DMCA machinery on an imported
recipe that has no creator, byline, or follow relationship at all (the
common case today), and can in principle follow a creator with zero
imported-recipe interaction. Don't assume one implies the other.

---

## §1 — Discovering a creator

**Why this exists:** the social/creator bet (B5 Discover Phase 2) — a
followed creator's recipes surfacing in Discover's Following scope closes a
follow → more-of-their-content loop. The rail is deliberately absent until
genuine creator rows exist.

**Entry point:** the Discover tab's "Top creators" rail (backed by the
`top_creators_by_saves` RPC, `src/lib/discover/topCreators.ts` /
`apps/mobile/hooks/useTopCreators.ts`); a creator byline on a Discover hero
card or a curated Recipe Detail page; deep link `suppr://creator/[id]`.
**Every byline link is gated on `recipe.creator_id` being non-null.**

**What comes next:** tap through to §2.

---

## §2 — Creator profile page

**Why this exists:** the read surface for Plane B of the two-plane creator
content model — "first-party creators who want ownership, credit, their own
photos." The model itself is coherent; this page is its intended shopfront.

**What the user sees:** avatar (or a monogram fallback when none is set),
display name, `@handle`, bio, a verified tick when
`is_verified` is true, follower + recipe counts (true head-counts via a
separate `count: "exact", head: true` query, not the loaded-row count), a
Follow/Following CTA, and a newest-first, paginated recipe list (page size
24, `creatorRecipePagination.ts`, shared web/mobile) with an honest
"No recipes yet" empty state and a proper not-found state for an unknown id.

**Web:** `app/creator/[id]/page.tsx` — a server component (SSR + OG
metadata via `generateMetadata`), fetching creator + first recipe page +
true counts in parallel via the public anon-key client (data is public by
design).
**Mobile:** `apps/mobile/app/creator/[id].tsx` — an inline Expo Router
screen doing the equivalent parallel fetch.

**Web ↔ mobile parity:** identical fields, identical optimistic-follow
behaviour, one shared pagination module. **A shared, latent bug on both
platforms:** the self-view guard (used to hide the Follow button on your
own profile) compares `authedUserId === creator.id` — but `creators.id` is
a separate lightweight entity, not `profiles.id`. The two-plane content
model deliberately keeps `author_id` (real ownership) and `creator_id`
(reserved for future attribution) as separate identifier spaces, and no
user maps to a `creators` row today (§8), so this guard can never actually
fire — harmless right now, but structurally wrong, and it will misbehave
the moment a real creator-linking path exists.

**What comes next:** Follow → §3. Tap a recipe row → Recipe Detail.

---

## §3 — Follow / Unfollow

**Why this exists:** powers the Discover "Following" feed scope — the one
mechanism by which following a creator has a visible effect.

**What the user does:** taps Follow/Following on a creator profile header.
The toggle writes optimistically to the `follows` table (`upsert` on
follow, `delete` on unfollow) with an immediate follower-count
increment/decrement, and **rolls back on write failure** so the UI can
never show a state the database doesn't back. Hidden entirely for
unauthenticated viewers and (in principle, subject to the bug in §2) for
self-views.

**Note — two different follow graphs, intentionally:** `follows` (this
section, keyed on `creator_id`) is a different table from `author_follows`
(keyed on `author_id`, powering `public_author_follower_count`). That
duality is a deliberate consequence of the two-plane content model's split
between `author_id` (canonical owner) and `creator_id` (reserved for future
attribution) — not drift.

**Web:** `src/app/components/creator/CreatorFollowButton.tsx` — a client
component that hydrates session + follow state before first paint so the
button doesn't flash.
**Mobile:** inline in `apps/mobile/app/creator/[id].tsx`, same
optimistic/rollback shape.

**Web ↔ mobile parity:** identical logic and copy; both share the §2
self-view guard bug.

**What comes next:** the followed creator's recipes appear in Discover's
"Following" feed scope — see [discover-and-library.md](./discover-and-library.md#3--discover-the-browse-feed)
§3. With no genuine creators yet, the scope currently resolves to its honest
empty state.

---

## §4 — Import legal attribution: source card, disclaimer, link-back

**Why this exists — the legal basis for importing at all.** Recipes are
**facts**: the US Copyright Office (Circular 33) holds that a mere
ingredient listing and simple functional directions aren't copyrightable;
UK law agrees. What **is** protected is the creative expression — narrative
prose (headnotes, story text) and photos. The rule that follows: extract
the facts, don't reproduce the prose or the photo, attribute clearly, and
link back to the original.

**What the user sees on every imported (non-first-party) recipe:**
- A **SOURCE card** — byline + a link back to the original page
- The legal-approved **disclaimer line**, verbatim:

  > Recipe imported for your personal cookbook. Ingredients and nutrition
  > are estimated by Sloe and may differ from the original. Not affiliated
  > with or endorsed by {source_name}.

**How it's enforced (single source of truth, both platforms):**
`isImportedRecipe(source_url | source_name)` — one shared predicate
(`src/lib/recipes/importSourceDisclaimer.ts`, imported by mobile with no
platform alias) gates whether a recipe shows this card at all. A recipe is
"imported" the moment it carries a persisted `source_url` or a
caption-recovered `source_name` — first-party authored recipes never carry
either and never show the card. The exact disclaimer string is pinned by
`recipeSourceCardParity.test.ts` so the two platforms cannot drift.

**What is blocked, and where:**
- **Verbatim creator prose (`description`) is nulled at the import route
  boundary** (`app/api/recipe-import/route.ts`) before it ever reaches
  persistence, on both the web/blog-scrape branch and the social-fallback
  branch — the earlier text is still used server-side for a macro-sanity
  check only, never stored or rendered.
- **Steps are paraphrased to imperative voice**, not transcribed — enforced
  server-side at the import route (`normaliseRecipeSteps.paraphraseInstructionsArray`)
  and again idempotently at persistence, so a step never survives as the
  creator's original sentence.
- **Creator photos are blocked** — `BLOCKED_IMAGE_HOSTS`
  (`src/lib/recipe-import/parseRecipeFromHtml.ts`) rejects hero images from
  a denylist of source-photo hosts at parse time; a blocked/no-photo import
  falls back to a deterministic cuisine-tinted placeholder, never a
  substituted stock photo.

**Un-claimed stubs never imply endorsement.** The guiding rule is that
coexistence must not imply endorsement: a stub that hasn't been claimed by
its real creator carries the neutral framing "Imported from {source} — not
posted by the creator" wherever the product needs to distinguish an
unclaimed import from an official/claimed version — never branding that
suggests the original creator posted it to Suppr themselves.

**Web:** `src/app/components/RecipeDetail.tsx`, `app/api/recipe-import/route.ts`.
**Mobile:** `apps/mobile/app/recipe/[id].tsx` (testID
`recipe-import-disclaimer`), `apps/mobile/lib/saveImportedRecipe.ts`.

**Web ↔ mobile parity:** identical — one shared disclaimer constant, one
shared prose-null/step-paraphrase enforcement at the server boundary so
both platforms persist the same clean data regardless of which client
imported it.

**What comes next:** tap the source link → the original creator's page
(external). See something wrong? → §6 (Report) for content issues, §7
(DMCA) for a copyright claim.

---

## §5 — Blocked photo/prose reproduction (summary)

Covered inline in §4 — repeated here only as its own heading because it's
the mechanism most directly at risk if a future change regresses it.
**Do not regress:** photo blocking (`BLOCKED_IMAGE_HOSTS`), the
`description: null` override, or step paraphrasing. These three are called
out explicitly in the legal decision doc as "what's already good — don't
regress."

---

## §6 — Report an issue (non-copyright content report)

**Why this exists:** the in-app reporting mechanism the UK Online Safety
Act and EU Digital Services Act expect once user-generated/imported recipe
content is live — distinct from DMCA, which is copyright-specific.

**What the user does:** opens "Report an issue" from a recipe's detail
screen and picks a reason — **incorrect nutrition**, **inappropriate /
unsafe**, or **other** — with an optional description.

**How it's protected:** `POST /api/recipe-report` is **auth-gated**
(401 for anonymous callers — the sheet only ever renders for a signed-in
user, so this is the endpoint's actual contract, not an accident) and
rate-limited at **10/hour per (user id, trusted client IP)**. The IP
component is derived from the platform-injected, non-forgeable
`x-vercel-forwarded-for`/`x-real-ip` headers (falling back to the rightmost
`x-forwarded-for` hop off-Vercel) — never the client-spoofable leftmost hop
— so an attacker rotating IPs can drain at most one bucket per compromised
account, not bypass the cap outright (`src/lib/server/clientIp.ts`).

**Web:** `app/api/recipe-report/route.ts`,
`src/app/components/suppr/report-recipe-dialog.tsx`.
**Mobile:** `apps/mobile/components/recipe/ReportRecipeSheet.tsx`,
`apps/mobile/hooks/useRecipeReport.tsx`.

**Web ↔ mobile parity:** identical — same route, mirrored dialog (web) /
sheet (mobile), same rate-limit shape.

**What comes next:** the report lands in a reviewer queue, reviewed within
5 business days (per the confirmation copy the route returns). There is no
in-app status surface for the reporter beyond that confirmation.

---

## §7 — DMCA takedown: the channel exists, but the safe harbour is not yet effective

**Why this exists — the hard legal prerequisite for importing third-party
content at all.** A working, discoverable takedown channel is a
non-negotiable precondition of the import feature (see §4's legal basis) —
it's what lets Suppr claim it acts on infringement claims in good faith.
The form ships now specifically so a live notice channel exists to list
when the designated-agent registration (below) is filed.

**What the user (or, more commonly, a non-user rights-holder) does:**
visits the public `/dmca` page and either submits the on-page form or
emails `dmca@getsloe.com`. The page also documents §512(c)(3) notice
requirements, the counter-notice process (§512(g)(3)), a repeat-infringer
policy (three-strikes framing), and UK Online Safety Act / EU Digital
Services Act equivalent notice-and-action wording for non-US users.

**Deliberately anonymous by design.** `POST /api/dmca-takedown` has **no
auth gate** — copyright notices legitimately come from people who have
never signed up for Suppr (the original creator, or their agent), so
requiring an account would break the legally required path. It's protected
instead by IP-based rate limiting (5/hour, keyed off the same trusted-IP
resolver as §6) and persists via the service-role client. A stronger second
factor (Cloudflare Turnstile) is scoped but not built — it needs Cloudflare
infrastructure only Grace can provision. That gap is tracked openly with a
deferred-work comment directly in the route, not left as a silent gap.

**THE PART TO GET RIGHT IN ANY EXTERNAL CLAIM: the §512(c) safe harbour is
NOT yet effective.** The product path is fully built and live — the form,
the API route, the policy page, the RLS-protected `dmca_takedowns` table
— but DMCA's statutory safe harbour only protects Suppr from third-party
infringement liability once its **designated agent is registered with the
US Copyright Office** (17 U.S.C. §512(c)(2)). That registration is
**still pending**: it depends on legal-entity incorporation being complete
first (the registered postal address must match `/dmca` byte-for-byte), and
incorporation itself is a separate, Grace-owned, still-open workstream. The
checklist and exact form fields are staged and ready to file the moment
incorporation lands: `docs/operations/eng-859-dmca-filing-checklist.md`.

**Do not describe the DMCA channel as "fully protective" or "safe harbour
in place" until the designated agent is actually registered with the
Copyright Office.** Until then: the takedown form is a genuine, working
operational commitment (a notice submitted today gets a human response
within 7 business days per the route's own confirmation copy) — but it is
not yet the legal shield that makes Suppr's import of third-party recipes
safe-harboured under DMCA. This same registration gap is also the reason
`IG_TT_IMPORT_ENABLED` (the safe caption-only Instagram/TikTok import path)
stays off in production — see
[import-recipe.md](./import-recipe.md#legal-caveat--instagram--tiktok-import-read-before-any-public-claim).

**Web:** `app/dmca/page.tsx`, `app/dmca/_form/DmcaTakedownForm.tsx`,
`app/api/dmca-takedown/route.ts`,
`supabase/migrations/20260505010000_dmca_takedowns.sql`.
**Mobile:** no native DMCA screen (deliberate — mobile has no native legal
surfaces at all). Settings rows open the web `/dmca` page via `Linking`
(`apps/mobile/components/settings/SettingsBundleContent.tsx`) — a
documented carve-out, not a parity gap.

**What comes next:** a valid notice enters the reviewer queue; per the
policy page, Suppr acts "without undue delay" and notifies both the
reporter and the affected user of the outcome. A counter-notice, if filed,
can restore content after 10–14 business days absent a court filing.

---

## §8 — Becoming a creator: not built

**Why this matters:** everything in §1–§4 describes a *read* surface. There is
no corresponding *write* surface anywhere in the product.

**What's actually there:** `recipe_claims` exists as a DB foundation —
RLS default-deny for client roles, with normal recipe-owner insert/update
policies explicitly rejecting `content_origin = 'claimed'` plus the
`claimed_by`/`claimed_at`/`claim_verification` columns. That's intentional
scaffolding for a **future** verified-claim flow (OAuth handle
verification, a one-time bio/caption code, or DNS/meta-tag proof for a
blog — never a self-serve "this is mine" button, which would be an
impersonation vector) that must write through a service-role or
`SECURITY DEFINER` path once built. **That path does not exist today.**

**What this means concretely:** a real user can author and publish 50
recipes right now, and none of it gets them a `/creator/[id]` profile, a
follower count, or a spot in the Discover rail — because all of that reads
from `creators`/`creator_id`. ENG-1535 restores the intended launch posture:
the plane starts empty and fills only when a genuine, consented creator path
exists.

**What comes next (future, unbuilt):** verified claim → the claimant's own
published Plane-B recipe, with a real photo replacing the placeholder →
appears on their `/creator` profile → discoverable and followable.

---

## §9 — Creator/trainer monetisation: backlog, not built

Named here only so it isn't confused with anything above. No schema, no
IAP product, no payout rail, and no UI beyond a possible "What's new →
Coming soon" teaser exist. Direction is documented but explicitly
unscheduled, with six open product questions still unresolved: who counts
as a creator, Apple IAP vs Stripe, free-quota shape, Discover-vs-Library
gating, overlap with Plan Import, and the nutrition-verification bar for
paid content. Pickup is gated on creator profile/publish flows having
baseline usage data — which, per §8, cannot exist until a real creator can
publish at all.

---

## Edge cases / limits

- **A creator with no avatar** — both platforms render a monogram fallback,
  never a broken image or a
  substituted stock photo.
- **An unknown `/creator/[id]`** — web returns Next's `notFound()`; mobile
  shows an equivalent not-found state. Neither silently redirects.
- **A recipe with `source_url` but no recovered `source_name`** — the
  disclaimer falls back to "the original source" rather than inventing an
  attribution.
- **A FatSecret-sourced imported recipe's macros** — a separate cache guard
  zeros display macros for FatSecret-origin rows regardless of import
  status, to respect FatSecret's Basic-tier ToS; this is orthogonal to the
  attribution machinery in §4 and doesn't affect whether the disclaimer
  shows.
- **Self-view on a creator profile** — intended to hide the Follow button;
  currently structurally incapable of firing (§2), harmless only because no
  user maps to a `creators` row yet (§8).
- **Reporting/DMCA-ing a first-party (non-imported) recipe** — both paths
  work regardless of import status; §6/§7 aren't gated on `isImportedRecipe`.

## Known limitations and open questions

**Real creator onboarding is still absent.** The read surfaces remain dark
until the verified claim/onboarding path in §8 exists; this is now an honest
empty state rather than a fabricated catalogue.

**The self-view follow guard described in §2 compares the wrong id
space.** `authedUserId === creator.id` should eventually compare through
the `author_id`/`creator_id` linkage once a real creator-onboarding path
exists. It's dead code today, so there's no urgency to fix it in
isolation — but it belongs in the same piece of work as §8, not left to
surface as a live bug once a real claim path ships.

**DMCA agent registration status is incorporation-dependent and owned
outside the codebase.** Anyone describing the import/DMCA posture as fully
protective — including in a founder demo — should confirm the current
registration status first; the takedown form shipping does not, on its
own, make that true.

**Creator monetisation's six open product questions (§9) remain
unanswered.** They need a deliberate product pass whenever the feature is
picked up, not an engineering guess.

## Related documents

- [import-recipe.md](./import-recipe.md) — the loop stage upstream of §4/§5;
  attribution is enforced at that import boundary, and its Legal caveat
  section covers the adjacent IG/TT server-fetch posture this doc's §7
  DMCA gap also blocks
- [discover-and-library.md](./discover-and-library.md) — the Discover "Top
  creators" rail (§3 there) is where §1 of this doc starts; that doc's §7
  was the brief pointer this file now replaces
- [`docs/decisions/2026-06-03-creator-content-model-two-plane.md`](../decisions/2026-06-03-creator-content-model-two-plane.md) — the two-plane data model behind §2/§4/§8
- [`docs/decisions/2026-06-03-recipe-import-posture-part1-part2.md`](../decisions/2026-06-03-recipe-import-posture-part1-part2.md) — the legal basis and exact approved wording behind §4/§5
- [`docs/operations/eng-859-dmca-filing-checklist.md`](../operations/eng-859-dmca-filing-checklist.md) — the exact open steps that make §7's safe harbour effective
