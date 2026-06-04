# Recipe-import legal posture — hardening + creator-claim rules (2026-06-03)

**Status:** Decided (legal-reviewer, 8/10) — APPROVE-with-required-changes. Part 1 has a LIVE P0.
**Linear:** initiative "Recipe import, AI imagery & creators" → project "Import posture & legal" (ENG-857/858/859/860).
**Cross-link:** `docs/decisions/2026-04-30-ig-tt-recipe-import-legal-posture.md`, `docs/research/2026-06-03-recipe-import-competitive-posture.md`, `docs/decisions/2026-06-03-creator-content-model-two-plane.md`.

## The legal basis (why importing is OK)
Recipes are **facts**: the US Copyright Office (Circular 33, 37 CFR §202.1) holds "a mere listing of ingredients is not copyrightable" + simple directions are uncopyrightable; UK law agrees (ingredient lists + functional steps = not protected). The **creative expression IS protected**: the headnote/narrative prose, and the **photo** (*Publications Int'l v. Meredith*, 7th Cir. 1996). So: extract the facts, **don't reproduce the prose or the photo**, attribute + link back. (We already block photos — `BLOCKED_IMAGE_HOSTS` + migration `20260427100000`.)

## Two import paths — DIFFERENT postures (don't conflate)
- **Social path (IG/TT/YT):** user-supplied caption, **no server fetch**, flag-OFF in prod, already sets `description: null` + normalises steps to imperative voice → **compliant, stronger than ReciMe.** Do not regress.
- **Web/blog path:** server-fetch (honest `SupprBot/1.0` UA), **LIVE**, and **persists + renders the creator's verbatim `description` headnote** (`app/api/recipe-import/route.ts:285` → `apps/mobile/lib/saveImportedRecipe.ts:163` → `RecipeDetail.tsx:2573`) → **the LIVE P0.**

## Part 1 — import-posture must-dos
1. **(P0, ENG-857) Stop persisting verbatim prose on the web/blog path.** Set `recipes.description` null on import (keep parsing for the macro-sanity check only). Structure/paraphrase steps; never reproduce narrative prose. Facts we MAY keep: ingredients, quantities, functional steps, times, servings, nutrition, title, `source_url`, `source_name`.
2. **(P1, ENG-858) Surface attribution + a disclaimer line.** Byline + SOURCE card already exist; add the disclaimer (wording below) + ensure the link is prominent.
3. **(P1, ENG-860) User-as-actor / private-by-default framing** in ToS + Help — but **keep the honest bot UA** (don't claim "no bots"; it's false for the web path and the honest identified fetcher is stronger).
4. **(P0, ENG-859) Register the DMCA designated agent** (copyright.gov, $6). §512(c) safe harbour isn't effective until filed and the web/blog path is already live. Depends on incorporation (entity + postal address). Owner: Grace.

## Part 2 — creator-claim / coexistence legal rules
- **Claim requires verified ownership**, not assertion (domain/handle proof + attestation; log verifier evidence).
- **Claim transfers attribution / source-of-record, never silently rewrites a user's saved copy** (their private cookbook is their personal copy).
- **Opt-out / takedown ≥ claim in ease, and available to non-users** (GDPR/UK GDPR Art 17 covers their handle/name even if they never signed up): delist, sever link-back, remove handle.
- **Coexistence must not imply endorsement** — an un-claimed stub must never carry creator branding implying they posted it ("Imported from {source} — not posted by the creator"). Right-of-publicity / passing-off, distinct from copyright.
- **Right-of-publicity on the funnel:** link-back + a neutral claim invite are fine; **do not** use a creator's name/likeness in outbound/paid marketing without consent, and don't imply they're "on Suppr" until they've claimed.
- **Provenance columns** (`content_origin`/`claimed_by`/`claimed_at`/`claim_verification`) are a prerequisite — mirrors the `image_source` decision.
- **Never "your own recipe" framing** on imports (Cronometer's mistake). Imported = "Imported from {source}"; Claimed = "By {creator}"; First-party = "Your recipe".

## Exact wording
**Source-card disclaimer (with `source_url`):**
> Recipe imported for your personal cookbook. Ingredients and nutrition are estimated by Suppr and may differ from the original. Not affiliated with or endorsed by {source_name}.

**ToS / Help (user-as-actor + honest fetcher):**
> When you import a recipe, Suppr makes a personal copy in your own cookbook — like saving to your notes or printing for your kitchen. Imports are always started by you, never automatic, and are private by default. We capture the facts (ingredients, steps, times, our nutrition estimates) and link back to the original; we don't copy the original article's writing or photos, and we don't bulk-collect recipes. When we read a public web page, we identify ourselves honestly as Suppr's importer.

(Do **not** write "we never use bots" — false for the web path; the honest phrasing above is both true and stronger.)

## Open for formal counsel (block GA, not the spike)
EU **sui-generis database right** at scale; right-of-publicity boundary of the claim funnel (US state variance); DMCA eligibility vs entity status (incorporation memo); UK fair-dealing for link-back/credit.

## What's already good (don't regress)
Photo blocking (`BLOCKED_IMAGE_HOSTS`); social-caption path (no fetch, `description: null`, imperative steps); honest bot UA; existing byline + source card; Whisper/audio transcription already removed on IP advice.