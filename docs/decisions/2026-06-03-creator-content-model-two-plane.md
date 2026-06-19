# Creator-content model — two planes, first-party canonical (2026-06-03)

**Status:** Decided (product-lead, 8/10). ENG-869 data model implemented; claim/merge remains post-launch.
**Linear:** initiative "Recipe import, AI imagery & creators" → project "Creator platform" (ENG-868/869/870).
**Context:** Suppr runs two opposite content models — un-owned **imported** recipes (facts-only, photos blocked, AI/placeholder image, link-back) and **first-party creators** ("Recipe Go Public" + `/creator/[id]`) who want ownership, credit, their own photos. This reconciles them.

## The model: two planes, one bridge
- **Plane A — private imports (facts-only).** What exists today: facts + `source_url`/`source_name`, gradient placeholder (creator photo blocked), **private by default, never published, never in Discover, never SEO-indexed.** The creator didn't opt in, so this object has no public surface. Correct as-is.
- **Plane B — first-party creator recipes (owned).** Authored or *claimed*, with photo/prose/brand, `published=true`, in Discover + on `/creator/[id]`. Opted in, owned, photo shown.

## Data model
Every `recipes` row carries `content_origin` as `first_party`, `imported_stub`, or `claimed`. `content_origin` describes the row itself: private import writes use `imported_stub`; creator-authored writes use `first_party`; future verified claim writes use `claimed`. The column is a classifier for query/ranking/UI decisions, not a foreign key to another recipe and not permission to rewrite a user-owned copy.

## Canonical rule — PLANE-SCOPED (the key revision)
**First-party is canonical only within the PUBLIC plane.** When a published first-party version exists, it's what Discover/search/share surfaces. An imported **private** stub is never overwritten or "beaten" — it stays the user's private object exactly as imported/customised. **De-dupe operates on what's shown publicly, never on what a user privately owns.** ("De-dupe so theirs wins" is right for Discover, wrong if read as silently rewriting users' private saved stubs — that's a trust violation.)

**Detecting "same recipe":** only **exact `source_url` match** is strong enough to act on — and only to *offer* a claim or *surface* an "official version exists" badge, never to auto-merge. Title/handle/ingredient similarity = a suggestion hint only. False-positive merges are far worse than false-negatives.

## Canonical ownership: `author_id` vs `creator_id` (ENG-868 resolution)
`recipes.author_id` is the canonical owner for **all** recipes: Plane A private imports and Plane B first-party creator recipes. It is the FK to `profiles.id` (`ON DELETE CASCADE`) and is set by every current user-authored write path: plan-import recipe persistence (`src/lib/planning/planImport/persistImportRecipe.ts`), web recipe upload (`src/app/components/RecipeUpload.tsx`), app-data recipe creation (`src/context/AppDataContext.tsx`), mobile create recipe (`apps/mobile/app/create-recipe.tsx`), and the mobile create-recipe wizard (`apps/mobile/components/recipe/CreateRecipeWizard.tsx`). Edit and ownership gates must continue to use `author_id` only: `canEditRecipe` checks the recipe's `author_id`, and `updateRecipePublishedStatus` updates a row only when `author_id` matches the acting user.

`recipes.creator_id` is **not** the canonical owner. It is the nullable FK to the separate lightweight `creators.id` entity (`ON DELETE SET NULL`) used by `/creator/[id]`, `follows`, `public_creator_follower_count`, and creator-plane attribution. There is no write path that inserts `creators` rows today; the only `from("creators")` app use is the mobile creator-profile read in `apps/mobile/app/creator/[id].tsx`. Therefore `creator_id` is reserved for future verified-creator profile attribution and is expected to be `NULL` for rows produced by today's app paths.

Keep the dual follow model explicit so it is not mistaken for drift:

- `creator_id` powers the legacy/creator-plane follow path: `follows` and `public_creator_follower_count`.
- `author_id` powers profile-owner follows: `author_follows` and `public_author_follower_count`.
- Recipe detail surfaces on web and mobile may prefer `creator_id` attribution when it exists, then fall back to `author_id`; that display preference does **not** change the ownership gate.

Do **not** drop `creator_id` as part of ENG-868. It remains part of the future creator plane and is referenced by the recipe publish-notification trigger, indexes/FKs, follow reads/writes, and cross-platform read paths. The foundation for ENG-869/ENG-870 is: claim/merge writes ownership to `author_id`; any future verified-creator attribution through `creator_id` must be additive and explicitly populated.

## Claim & merge (post-launch)
- **Who can claim:** an account with **verified control of the source** (domain/handle) — OAuth handle verification, a one-time code in bio/caption, or DNS/meta-tag for a blog. **Not** a self-serve "this is mine" button (impersonation vector). Attestation ("I have the right to share this") is necessary but not sufficient — identity verification on top.
- **What merges (forward-only, non-destructive):** claiming creates/upgrades the creator's **own** published Plane-B object (their real photo replaces the placeholder, prose, brand, creator-page). It does **not** reach into users' private libraries. From claim onward: Discover shows their version; new imports of that `source_url` are offered the official version; existing private stubs get a **non-destructive badge** ("✓ Official version available") with a user-chosen "switch to official" — never forced, never deleted.

## AI image precedence ladder
creator real photo (`user_upload`) > permitted imported photo > AI-generated (`ai_generated`, labelled "Sloe image") > gradient. **AI generation is disabled on the public/Discover plane entirely** — private-stub enrichment only; published recipes have a real photo or the gradient. Consumes the `image_source` column (see image-gen decision).

## Is import creator-friendly? Yes — IF we build the bridge before scaling
The funnel pitch is true only when: link-back is **surfaced** (not buried — ENG-858), we **don't reproduce creator prose verbatim** (ENG-857), claim verification is real, and opt-out/takedown is easy. With those, import sends named credit + traffic to creators and the claim turns a passive mention into an owned audience. Without them, it curdles into appropriation.

## Sequencing
- **Launch-relevant:** surface link-back (ENG-858), stop verbatim prose (ENG-857), DMCA (ENG-859).
- **Post-Today:** `image_source` provenance + precedence ladder (ENG-862/864).
- **Implemented in ENG-869:** `recipes.content_origin` enum + backfill and write-path tagging for imports versus first-party creates.
- **Post-launch:** full claim & merge + "switch to official" + Discover de-dupe ranking (ENG-870). Trigger = first real creator asks; at N=1 there's nothing to claim. Discover de-dupe is ranking-only: when a `claimed`/`first_party` public row and private stubs share an exact `source_url`, the owned public row ranks first in Discover/public search; private rows are never mutated, deleted, or repointed.
- **Never build:** retroactive silent merge that mutates users' private saved stubs.

## Open / risks
- **Resolved by ENG-868:** `author_id` is the canonical recipe owner; `creator_id` is reserved nullable verified-creator-plane attribution.
- Top risks: claim impersonation (→ verified ownership), false-positive auto-merge (→ exact-source_url-only), funnel-as-fiction (→ surface link-back + no verbatim prose), AI image in Discover (→ private-plane only).
- Legal rules for claim/opt-out/right-of-publicity: see `docs/decisions/2026-06-03-recipe-import-posture-part1-part2.md`.
- Supersedes the "Go-Public is web-only" memory note (converging to parity, ENG-700).
