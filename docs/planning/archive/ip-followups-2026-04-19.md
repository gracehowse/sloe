# IP follow-ups — open items after 2026-04-19 clearance memo

**Source:** IP-counsel pre-launch clearance memo (2026-04-19).
**Context:** The code-side fixes (2 BLOCKERs, 8 HIGHs, most MEDIUMs, all LOWs) shipped in the same session. This file tracks everything that still needs a human decision, a business action, or a longer piece of engineering work. Treat it as the ongoing IP/compliance to-do list.

---

## P0 — Must happen before community publishing goes live

### DMCA-1. Register the Suppr designated agent with the US Copyright Office
- **Why:** 17 U.S.C. § 512(c) safe-harbour only applies once the designated agent is registered. Without registration, Suppr is a direct infringer for any user-uploaded content that turns out to infringe someone's copyright.
- **How:** File at [copyright.gov/dmca-directory](https://www.copyright.gov/dmca-directory/). Fee $6; renew every 3 years.
- **Depends on:** pick the contact name (can be founder's legal name until incorporation) + postal address. `dmca@suppr-club.com` is already wired into the [/dmca](../../app/dmca/page.tsx) page.
- **Owner:** Grace.
- **Time:** ~30 min.

### LEGAL-1. Confirm legal entity name and update filings
- **Why:** The ToS, DMCA page, privacy policy, and footer use the unincorporated name "Suppr" with a placeholder posture. Once a legal entity is formed, every user-facing legal surface and every DPA must name that entity.
- **Touches:**
  - [app/terms/page.tsx](../../app/terms/page.tsx) — header, limitation-of-liability, contact.
  - [app/dmca/page.tsx](../../app/dmca/page.tsx) — designated-agent identity.
  - [app/privacy/page.tsx](../../app/privacy/page.tsx) — controller identity.
  - [app/(landing)/LandingPage.tsx](../../app/(landing)/LandingPage.tsx) — footer copyright line.
  - [app/licences/page.tsx](../../app/licences/page.tsx) — trademark footer reference.
  - Stripe, Supabase, RevenueCat, Expo, PostHog, Sentry, OpenAI, Edamam, FatSecret — update billing entity + DPA counterparty on each vendor.
- **Depends on:** business decision on jurisdiction (UK Ltd / US Delaware C-corp / sole trader / other).
- **Owner:** Grace (+ accountant).
- **Estimated effort:** 1–4 weeks wall-clock (incorporation filing + vendor updates).

---

## P0 (added) — Trademark conflict surfaced by preliminary scan

### TM-1. Formal trademark clearance search + rebrand risk assessment for "Suppr" / "Suppr Club"
- **Preliminary-scan result (2026-04-19):** **HIGH risk — do not proceed without a formal search, and re-examine whether the brand name is viable before paying for one.** Three compounding factors:
  1. **Phonetic equivalence.** "SUPPR" ≈ "SUPPER" — dropping the "e" does not create distinctiveness in the sound-alike analysis used by USPTO / UKIPO / EUIPO examiners. We get no uplift from the stylisation.
  2. **Live in-category competitor: "Supper Club!" by SupperClub App, LLC**, shipping on the US App Store (ID 6496848191) and at `supperclubapp.com`. This is a direct consumer product in the social-food / recipes / dinner-planning adjacency — nearly identical to "Suppr Club" positioning.
  3. **Crowded category.** "Supperhero – AI meal planner" (App Store ID 6738939154) and "Simple Suppers" (ID 6469049737) are also live meal-planning apps using the "supper-" root. Even ignoring registered prior art, App Store name-collision policy alone may reject "Suppr Club" as duplicative.
- **What a real search should specifically investigate:**
  1. Phonetic-equivalence risk SUPPR ≈ SUPPER in classes 9 + 42 across US / UK / EU — every live SUPPER / SUPPER CLUB / SUPPERHERO + sound-alike variants.
  2. SupperClub App, LLC — registrations, serial numbers, filing dates, common-law use, Madrid / territorial footprint.
  3. Classes 29 / 30 / 43 prior-art density for "SUPPER" — if a future branded meal-kit or prepared-food line is already blocked we need to know now, because rebranding after a goods launch is the expensive failure mode.
  4. EU / Nordic "Suppr" uses outside food (pharma, healthcare, delivery) — class 44 / 5 / 42 conflicts that a food-only TESS search would miss but that matter for our wellness positioning.
  5. App Store + Google Play name-collision policy — confirm both stores would accept "Suppr" and "Suppr Club" as distinct from the "Supper Club!" app already listed.
- **Sources flagged:** [supperclubapp.com](https://www.supperclubapp.com/), [Supper Club! on App Store](https://apps.apple.com/us/app/supper-club/id6496848191), [Supperhero](https://apps.apple.com/us/app/supperhero-ai-meal-planner/id6738939154), [Simple Suppers](https://apps.apple.com/us/app/simple-suppers/id6469049737).
- **Owner:** TM counsel + founder (business decision on whether to rebrand pre-search).
- **Budget:** £1,200–2,500 for formal search + short written opinion. Budget separately for rebrand (new domain, new bundle ID, new marketing assets, new store listings) if counsel's opinion points that way.
- **Trigger:** BEFORE paid-marketing spend, App Store public release outside TestFlight, or any expansion into classes 29 / 30 / 43.

---

## P1 — Material risk that scales with growth

### OFF-1. OFF ODbL architecture — implement Option A (cache-only)
- **Why:** Suppr currently persists OFF-derived product rows into `foods` / `user_foods` / `recipe_ingredients`. Once those persisted rows amount to a "substantial part" of OFF, ODbL's share-alike clause obliges Suppr to release the derived subset under ODbL — which conflicts with the commingled Edamam / FatSecret data (both proprietary).
- **Remediation:** per [docs/decisions/2026-04-19-off-odbl-architecture.md](../decisions/2026-04-19-off-odbl-architecture.md) Option A — treat OFF as pass-through. Cache OFF responses at the edge (Upstash Redis) with short TTL; when a user logs an OFF product, snapshot macros to the private `meal` / `journal` row (that row is not public, so no share-alike trigger); do not write to `foods` or `user_foods`.
- **Touches:** `src/lib/openFoodFacts/fetchProductByBarcode.ts`, `src/lib/openFoodFacts/searchProducts.ts`, `src/context/AppDataContext.tsx`, `supabase/migrations/20260408170000_food_db_unification.sql` (commingled table — will need a migration to mark OFF-sourced rows for pruning).
- **Owner:** Engineering (food-DB layer) + Legal sign-off on final architecture.
- **Effort:** 1–3 eng-days, plus a migration to prune existing OFF-sourced rows from `foods`.
- **Trigger:** before the `foods` table grows large enough to argue a "substantial part" of OFF has been cached — conservatively, before general-public launch.

### FS-1. FatSecret caching audit — confirmed caching, decide tier
- **Finding (confirmed 2026-04-19):** `src/app/components/RecipeUpload.tsx:909–919` writes the full per-ingredient macros (calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg) to `recipe_ingredients` alongside `fatsecret_food_id` and `source: "FatSecret"` — i.e. Suppr *does* cache FatSecret macros. `verifyIngredients.ts:706` produces the same row.
- **Why:** FatSecret Platform API's free and Basic tier terms restrict caching of macros; Platform Premier (commercial) relaxes this.
- **Decision:**
   - **Option A:** confirm Suppr is on FatSecret Platform Premier. Document the tier + licence in `docs/environment.md` and the privacy `/licences` page. No code change.
   - **Option B:** rework the write path so that only `fatsecret_food_id` is persisted (the reference is permitted on free / Basic tier); re-fetch macros on display; accept the latency cost.
- **Touches (if Option B):** `src/app/components/RecipeUpload.tsx` (around line 905 onward) + `src/context/AppDataContext.tsx` (duplicate-recipe path) + `src/lib/nutrition/verifyIngredients.ts` + the mobile verify path.
- **Owner:** Product / Finance (tier choice) + Engineering.
- **Effort:** 1 eng-day (Option B); 0 (Option A).

---

## P2 — Good hygiene, lower urgency

### PRIV-1. Add a cookie / tracking-tech disclosure banner on first web visit
- **Why:** PostHog sets cookies; Sentry session replay (if enabled) captures DOM. GDPR / UK PECR expects a banner or layered consent, not just a privacy-policy mention.
- **Depends on:** product decision on consent UX (banner vs. layered).
- **Owner:** Engineering + product.

### PRIV-2. Publish international-transfer safeguards (SCCs, UK IDTA) on request
- **Why:** The privacy page references SCC / UK IDTA reliance. GDPR requires we can produce these on request. Needs an internal record of signed DPAs with OpenAI, Stripe, Upstash, RevenueCat, Expo, Edamam, FatSecret.
- **Owner:** Grace (DPA collection).

### MARK-1. Replace `DEFAULT_UPLOADED_RECIPE_IMAGE` (food photo) with a first-party illustration
- **Why:** lower-priority Unsplash hotlink cleanup (food photo, not a face — minor compared to the avatars we already fixed). Once done, remove `images.unsplash.com` from `next.config.ts` `remotePatterns` entirely.
- **Touches:** `src/context/appData/constants.ts`, `apps/mobile/lib/recipes.ts`, `apps/mobile/app/recipe/[id].tsx`, `app/recipe/[id]/page.tsx`, `src/app/components/RecipeUpload.tsx`, `next.config.ts`.
- **Owner:** Design + engineering.

### CI-1. Generate a machine-readable OSS licences artefact in CI
- **Why:** The `/licences` page currently ships a hand-maintained list. For hygiene, generate `notices.json` at build time via `npx license-checker --production --json` and ship it alongside the page. Keeps the notice page accurate as dependencies evolve.
- **Owner:** Engineering.
- **Effort:** 0.5 day.

### STORE-1. App Store privacy "nutrition label" reconciliation
- **Why:** The Apple App Store submission requires filling out privacy-disclosure questions that must match what the privacy policy + Info.plist claim. The ones Suppr touches: Health & Fitness (read + write), Identifiers, Contact Info (email), Usage Data (analytics), Diagnostics (crash logs), User Content (photos, text).
- **Depends on:** nothing in code — it's an App Store Connect form.
- **Owner:** Grace before first submission.

---

## Done (2026-04-19 session)

Kept here as an audit trail of what counsel review flagged and what shipped. See the chat transcript + commit history for line-by-line detail.

- **BLOCKER-1** HealthKit permission / purpose strings now match actual read + write behaviour.
- **BLOCKER-2a** ToS now includes an explicit user-to-Suppr content licence, narrow-purpose + terminable on deletion.
- **BLOCKER-2b** `/dmca` page + designated-agent address + counter-notice procedure + repeat-infringer policy live.
- **HIGH-1** OFF ODbL architecture decision documented; attribution rendered at point-of-use.
- **HIGH-2a** User-Agent rotation + `facebookexternalhit` / WhatsApp / Telegram / Discord bot impersonation replaced with a single declared `SupprBot/1.0`.
- **HIGH-2b** Whisper-based Instagram / TikTok video-audio transcription removed.
- **HIGH-3 / MEDIUM-7** Edamam classifier fix; "Powered by Edamam" and OFF ODbL attribution shipped at point of use.
- **HIGH-4** Mobile paywall "Secured by Apple" removed; Terms + Privacy links added adjacent to subscribe CTA.
- **HIGH-5** `/privacy` sub-processor table (15 entries), international-transfers section, legal-basis table.
- **HIGH-6a** Unsplash face-photo avatars replaced with self-hosted neutral silhouette SVG.
- **HIGH-7** BBC Good Food CDN whitelist removed; runtime guard + DB migration nulled hotlinked publisher images.
- **HIGH-8** USDA-endorsement copy rewritten ("matched against USDA FoodData Central (public domain)"); Apple Health moved out of "matched against" strip.
- **MEDIUM-1** Positive-assent tick-box at sign-up (web + mobile).
- **MEDIUM-4** `/licences` page + `ATTRIBUTIONS.md` rewritten.
- **MEDIUM-10** Footer entity → "Suppr" pending incorporation.
- **LOW** 4 stale prototype JSX files, 4 unused React-logo PNGs, `default_shadcn_theme.css` deleted.
- **Tests + docs:** NutritionSourceBadge test updated; typecheck + 1802 web tests + 385 mobile tests all passing.
