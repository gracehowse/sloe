# Onboarding seed recipes — copyright + claims review (2026-04-27)

**Status:** Resolved (2026-04-27)
**Area:** Legal
**Owner:** legal-reviewer (product-legal, not formal counsel)
**Cross-ref:** `docs/decisions/2026-04-27-onboarding-candidate-source.md`

---

## Verdict

**CONDITIONAL PASS** for shipping the 15-slug seed list.
**BLOCK** on (i) any seed-migration that writes new recipe rows without per-row provenance documented, and (ii) the literal "Gluten-free" chip copy until B3.2 is rewritten.

---

## A. Slug-only seed list — SAFE

Recipe titles and ingredient lists are not copyrightable in the US (17 USC § 102(b), *Publications International v. Meredith*, 7th Cir. 1996) or the UK (functional facts, no original literary expression). The creative expression sits in headnotes, prose instructions, and photography — none of which the slug list contains.

Three reasons clean:
1. Slugs are descriptive, not branded.
2. Resolving slugs to existing rows creates no new exposure.
3. The `OnboardingSeed[]` JSON is a pointer list; the rows it points to carry their own provenance (which is the real question — see B).

P3 nit: keep slugs descriptive. Don't migrate any slug to one that quotes a known publication's title verbatim.

---

## B. Underlying `recipes` table provenance — MIXED, conditional

| Pipeline | Onboarding-surface posture |
|---|---|
| **URL import** (`app/api/recipe-import/route.ts`) | **DO NOT use for onboarding seeds.** Personal-import-from-the-web has fair-use lean for the importer privately, but **publishing those rows back to other users at signup is republication**. The fair-use defence collapses the moment the audience is no longer the importer. Even with attribution, instructions are the copyrightable layer. |
| **Image / OCR import** (`app/api/recipe-import/image/route.ts`) | **DO NOT use for onboarding seeds.** Same republication problem; OCR'd source is often a copyrighted cookbook page or magazine. |
| **Discover / `published=true` rows** | **CONDITIONAL — only if Grace authored them.** N=1 today; once N>1, requires creator-attestation gate. |
| **FatSecret / Edamam licensed content** | **Safe for nutrition values.** Not safe to surface as recipe content (no recipe content sourced from them today; do not start). |
| **AI-generated** (analyze-recipe, voice-log, photo-log) | Not recipe-prose generators, so no exposure. Don't repurpose them to be. |

**Net:** the only `recipes` rows safe to surface in onboarding are rows where the prose was **originally authored by Grace or under a written agreement**. Rows arrived via URL/image import are off-limits for republication regardless of how they're displayed.

---

## C. Seed migration — only originally-authored or AI-generated-and-edited

If `nutrition-engine` audit finds slugs missing and a `_onboarding_seed_recipes.sql` migration is staged, the only **shippable** sourcing options are:

1. **Originally authored by Grace** (or contracted writer). **Clear.** Suppr owns the copyright outright. **Recommended path.**
2. **AI-generated instructions, human-edited.** Acceptable with caveats:
   - Per US Copyright Office 2023/2024 guidance, purely AI-generated text is *not* copyrightable — Suppr cannot prevent others from copying it, but is not infringing anyone else's copyright.
   - Risk is **output-similarity**: if the model regurgitates a copyrighted source verbatim, the underlying source's copyright still attaches.
   - Mitigations: generate from an outline (not "copy this style"), human-edit every recipe before commit, do not prompt with "in the style of <publication>".
3. **Public domain (USDA MyPlate, NHS Eatwell).** Clear but practically thin. NHS is crown copyright (Open Government Licence v3.0, requires attribution). Usable for ~2–3 of the 15 with attribution.
4. **Creator partnership.** Clear if signed; nobody signed. Defer.

Each migrated row must carry `source_name = 'Suppr'` (or attributed creator) and `source_url = NULL`. Do **not** copy-paste from any external recipe site, even for an MVP. Do **not** use URL-imported rows from Grace's own personal library.

---

## D. Gluten-free chip copy — P0 BLOCK

**Regulation (EU) No 828/2014** (retained in UK law via Food Information (Amendment) (EU Exit) Regulations):
- "**Gluten-free**" is a **regulated claim** with a legal threshold of ≤20 ppm gluten.
- Computed claims from ingredient classification **do not meet the regulatory standard**. Cross-contamination, hidden gluten in stocks/sauces, user-substitution → dish-level claim is unverified.
- "high confidence" qualifier does not rescue the headline term. CMA / FSA precedent on qualified health claims is consistent: the headline term governs.

**Required fix (block until applied):** rewrite to descriptive, non-regulated language:
- "**No gluten-containing ingredients**" / "**Contains gluten-containing ingredients**" — descriptive, not regulated.
- "**Suitable as written for gluten-free diets · check substitutions**" — softer alternative.
- Internally: keep `gluten_free: true` as a filter flag; never surface the literal phrase "gluten-free" as a label without a measurement-backed source.

Same logic applies to any future "vegan" / "vegetarian" / "halal" / "low-FODMAP" chips: descriptive ingredient-composition language only, never the regulated/certified term.

**Owner:** `ui-product-designer` to apply the rewrite; `nutrition-engine` to update D-2026-04-27-13 spec; resolves Tasks DB B3.2.

---

## E. App Store + Play Store — LOW risk if sourcing is clean

Apple App Review (Guideline 5.2) + Google Play (Restricted Content § IP) flag aggregator apps without rights. Recipe apps specifically have triggered rejections for copy-pasted blog content. With path-1 / path-2 sourcing in C, risk is low.

Two flags:
1. **Don't ship images you don't have rights to.** Use commissioned/AI-generated/Unsplash-licensed.
2. **Don't ship "Gluten-free" chip copy** — paid health-adjacent app making regulated dietary claims is a known rejection vector under 1.4.1 (Safety — Physical Harm).

Not a blocker. Conditional on D.

---

## Top issues (ranked)

1. **P0 — Gluten-free chip copy.** Regulatory non-compliance + consumer-misleading. Block.
2. **P0 — Seed-migration sourcing must be original or path-2 AI-generated-and-edited.** No URL-import-derived rows. Block migration until provenance per row is logged.
3. **P1 — Seed-resolver gate.** When loading seed rows from `recipes`, gate on `source_name = 'Suppr'` or equivalent provenance flag. Don't trust the slug alone.
4. **P2 — Hero images** for any new rows must be commissioned / AI-generated / licensed. Document source per row.
5. **P3 — Future state.** Once N>1 testers and Discover grows, formal user-published-content onboarding gate (creator attestation).

---

## Open questions for formal counsel

- UK FSA / EU 828/2014 sign-off on rewritten chip copy ("No gluten-containing ingredients") before public launch.
- AI-generated recipe text — Suppr's ownership posture (we can't prevent copying; do we care?).
- Whether NHS / OGL-attributed recipes are worth the attribution friction.

---

## Implementation guidance for executor

**DO:**
- Ship `apps/mobile/lib/onboardingSeeds.ts` + `src/lib/onboarding/onboardingSeeds.ts` with the 15 slugs as plain strings + display metadata. Slug list is cleared.
- For any missing-row migration: write each recipe's prose yourself or generate-and-edit, set `source_name = 'Suppr'`, `source_url = NULL`, add inline SQL comment per row stating origin (`-- origin: original` or `-- origin: ai-generated, edited 2026-04-27`).
- Gate the seed-resolver: filter by `source_name = 'Suppr'` (or equivalent provenance whitelist).
- Rewrite the gluten chip copy to "No gluten-containing ingredients" / "Contains gluten-containing ingredients · review for substitutions" before any seed renders.
- For images: use Unsplash-licensed, commissioned, or AI-generated; record source per row.

**DON'T:**
- Don't seed-migrate from any URL-imported recipe row, including Grace's own.
- Don't seed-migrate from any image/OCR-imported row.
- Don't ship "Gluten-free" / "Vegan-certified" / "Halal" / any regulated term without measurement-backed sourcing.
- Don't prompt an AI generator with "in the style of [publication]".
- Don't apply Supabase migrations via MCP `apply_migration` (stage file, run `supabase db push --linked`).

---

## Open follow-ups for legal-reviewer

1. **Pre-launch:** Formal counsel sign-off on rewritten gluten chip copy + any future dietary-claim chip language.
2. **Pre-launch:** Privacy posture review on onboarding data collection (diet flags, allergens, goals).
3. **Post-Phase-5:** AI-generated recipe ownership posture decision.
4. **Post-Phase-5:** Creator-attestation flow for user-published recipes once N > 1.
5. **Ongoing:** App Store rejection-risk monitoring on first submission.
