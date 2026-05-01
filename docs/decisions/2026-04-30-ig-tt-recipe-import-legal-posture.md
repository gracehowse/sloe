# 2026-04-30 — IG/TT recipe import legal posture

**Status:** Resolved (block ship; conditional path documented)
**Area:** Product / Legal / Imports
**Driven by:** Extended competitor audit (Recime conversion-blocker)
**Reviewer:** legal-reviewer agent

## Decision

**BLOCK** server-side fetch of Instagram/TikTok post bodies for recipe extraction.

**PASS-conditional** for an alternative path that uses **share-sheet caption text** instead — Suppr never hits IG/TT servers; the user's iOS share sheet supplies the caption text alongside the URL, and Suppr's server only does LLM parsing on text the user explicitly sent.

## Why server-side fetch is blocked

- Meta Platform Terms + Instagram ToS prohibit automated/scripted access outside official APIs. "User shared the URL" doesn't carve out the server-side fetch — once Suppr's backend hits `instagram.com/p/...`, that's automated access from Suppr's IP, not the user's.
- TikTok ToS is stricter still; enforcement is aggressive (rate-limit poisoning, IP bans, legal letters).
- Official paths exist (Instagram oEmbed via Facebook App Review, TikTok oEmbed + Display API) but they don't return caption / transcript content reliably.

## Why share-sheet caption text is the right rebuild

- iOS share extensions can carry the post's caption text alongside the URL.
- Suppr never auto-fetches from IG/TT servers.
- LLM parser only ever sees text the user explicitly shared.
- ToS-immune by construction: not "automated access," it's "user-supplied text."
- Cheaper to build than the API-app + review path.
- Same end-user UX as Recime: user shares a Reel, recipe appears in Suppr.

## Prerequisites for ship (in order)

1. **DMCA-agent USCO registration filed** — already P0 per memory `IP clearance memo actions (2026-04-19)`. Hard blocker for any third-party content import flow. Owner: Grace.
2. **Switch import path** to share-sheet caption text (no server fetch of IG/TT bodies). Implementation in `apps/mobile/app/import-shared.tsx` + parser pipeline.
3. **Privacy notice updated** to disclose creator-data processing for imported content.
4. **DMCA takedown form live** before any IG/TT-flavoured user-facing copy.
5. **Thumbnails hot-linked** from creator's CDN (not cached server-side) — image-rights risk.
6. **LLM parser audit** to confirm step instructions are normalised, not transcribed verbatim — recipe ingredient lists are facts (not copyrightable), but creative step expression can be.

## Implementation guardrails (when prerequisites met)

- **User-initiated only.** No background polling. Each fetch tied to a fresh user share/paste action.
- **Public posts only.** Reject `instagram.com/stories/` and follower-only patterns.
- **Per-user rate limit.** 30/hour, 5/min, hard cap, server-enforced on userId.
- **Provenance fields stored + displayed:** `source_url`, `source_name` (creator handle), `source_platform`, `imported_at`. Schema partially supports this already on `recipes` table.
- **Private by default.** No public sharing of imported third-party content. No SEO indexing. Cross-references `project_recipe_go_public_web_only.md` posture.
- **Disclosure on import screen:** "We never fetch the video itself. The creator can request removal at any time."
- **Logging:** every import logged with userId, URL, timestamp, response code (ToS-defence + GDPR).

## What does NOT need to ship for this path

- Meta App Review for `oembed_read` — not needed if we don't hit IG servers.
- TikTok Developer App + Display API onboarding — not needed for caption-only path.
- Outside counsel sign-off on the rebuild path (in-house legal-reviewer judgment is sufficient because we removed the server-fetch leg).

## Open questions for outside counsel (deferred)

- EU sui-generis database rights interaction with caption parsing.
- UK fair-dealing coverage for thumbnail-as-recipe-hero.
- Cayman/Delaware entity status interaction with DMCA safe-harbour eligibility (relates to incorporation-sequencing memo).

## What this PR does

- Documents the verdict (this file).
- Does NOT ship the IG/TT extractor. Re-route to legal-reviewer with the actual server-fetch route diff before any future PR that introduces fetch logic.

## Recipe import status today (unchanged)

`apps/mobile/lib/resolveImportUrl.ts` and `apps/mobile/app/import-shared.tsx` accept blog URLs and parse Open Graph + schema.org Recipe markup. ToS-neutral; no change needed.

## Implementation landed (PR `claude/pr-11-premier-recime-igtt`, 2026-04-30)

The caption-text path is now in code, FEATURE-FLAGGED OFF in production.

Code:
- Flag: `src/lib/featureFlags/igTtImport.ts` (`IG_TT_IMPORT_ENABLED`, default `false`).
- Shared classifier: `src/lib/recipes/resolveImportUrl.ts` (`detectSourcePlatform`, `isCaptionTextPlatform`, `CaptionTextPlatform`).
- Mobile re-export: `apps/mobile/lib/sourcePlatform.ts`.
- Caption parser (with imperative-voice guardrail): `src/lib/recipes/parseCaption.ts`.
- API: `app/api/recipe-import/caption/route.ts` — accepts `{url, captionText}`, gated by the flag (404 when OFF), validates input, normalises steps to imperative voice, persists provenance.
- Mobile share-extension forwarder: `apps/mobile/app/_layout.tsx` — forwards `captionText` alongside `url` when the iOS share sheet supplies both.
- Mobile preview: `apps/mobile/app/import-shared.tsx` — new `captionPreview` state surfaces the caption with an Edit caption affordance before kicking off import.
- DMCA takedown channel: `app/dmca/page.tsx` (form), `app/api/dmca-takedown/route.ts` (POST handler), `supabase/migrations/20260505010000_dmca_takedowns.sql` (table + service-role-only RLS).
- Privacy disclosure: `app/privacy/page.tsx` adds an "Imported recipes from public posts" section.

Tests: 61 added across web + mobile. Matrix:
- flag (`tests/unit/igTtImportFlag.test.ts`)
- platform classifier (`tests/unit/detectSourcePlatform.test.ts`, `apps/mobile/tests/unit/sourcePlatform.test.ts`)
- caption parser + imperative-voice guardrail (`tests/unit/parseCaption.test.ts`)
- caption route flag-off + flag-on + validation (`tests/integration/recipeImportCaptionRoute.test.ts`)
- DMCA route auth/validation/persistence (`tests/integration/dmcaTakedownRoute.test.ts`)
- DMCA form submit/error/network (`tests/component/dmcaTakedownForm.test.tsx`)
- privacy disclosure text lock-in (`tests/unit/privacyImportedRecipesDisclosure.test.ts`).

Production gate (still required before flipping the flag):
1. DMCA designated agent registered with US Copyright Office.
2. `legal-reviewer` signs off on the privacy-notice text + DMCA-form copy.

When both prerequisites land:
- Push migration `20260505010000_dmca_takedowns.sql` via `supabase db push --linked` (NOT MCP).
- Set `IG_TT_IMPORT_ENABLED=true` in Vercel production.
- Smoke-test by sharing an Instagram post to Suppr from a TestFlight build.
