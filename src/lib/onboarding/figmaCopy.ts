/**
 * Onboarding plan-ready reveal copy (Figma 192:2) + the jargon gloss
 * pairs (ENG-1187 onboarding sites, ENG-1461 product-wide extension).
 * Shared web ↔ mobile so conformance can't drift. (The v3 welcome is now
 * a pure brand screen — wordmark + tagline only — so its eyebrow / body /
 * TDEE-bullet copy was removed here, ENG-1247.)
 *
 * File name is a historical artefact (the system started onboarding-only);
 * it is now the ONE canonical jargon-gloss module for the whole product —
 * new non-onboarding gloss pairs live in the "product-wide" section below
 * rather than a second file, so there is exactly one place a TDEE/BMR
 * label can be defined.
 */

export const ONBOARDING_REVEAL_SUBTITLE =
  "Built around your goal — with room for the food you love.";

export const ONBOARDING_REVEAL_PERMISSION_QUOTE =
  "No foods off-limits. We'll just help them fit.";

/**
 * ENG-1187 — jargon gloss at onboarding trust moments.
 *
 * Onboarding leans on TDEE / BMR / Mifflin-St Jeor at two trust
 * moments (pace live-feedback tile, target reveal) where a first-time
 * user has no way to decode the acronyms.
 * These glossed labels lead with the plain-English phrase and keep the
 * acronym secondary in parentheses, on first use per screen — the
 * calm-coach voice. The plain (current) labels stay as the default; the
 * glossed set is selected at the render sites behind the
 * `onboarding_jargon_gloss_v1` feature flag (default-OFF).
 *
 * Shared web ↔ mobile — both platforms import this one module via the
 * `@suppr/shared/onboarding/figmaCopy` alias (mobile) / `@/lib/onboarding/
 * figmaCopy` (web), so the copy can never drift between surfaces. Always
 * pair each PLAIN constant with its GLOSS sibling; never inline either
 * string at a call site.
 */

// Site 1 — Pace step live-feedback tile label (first TDEE mention on the
// pace screen). Rendered uppercase by the tile's overline style on both
// platforms, so the source stays sentence-case for readability.
export const ONBOARDING_PACE_VS_TDEE_LABEL_PLAIN = "vs. your TDEE";
export const ONBOARDING_PACE_VS_TDEE_LABEL_GLOSS = "vs. your daily burn (TDEE)";

// Site 2 — Target reveal summary tiles + methodology note. BMR is the
// first acronym on the reveal screen (left tile), then TDEE (right tile),
// then the Mifflin-St Jeor note. Gloss each on its first use; the note
// adds a plain-English description of the formula.
export const ONBOARDING_REVEAL_BMR_LABEL_PLAIN = "BMR";
export const ONBOARDING_REVEAL_BMR_LABEL_GLOSS = "Calories at rest (BMR)";

export const ONBOARDING_REVEAL_TDEE_LABEL_PLAIN = "Est. TDEE";
export const ONBOARDING_REVEAL_TDEE_LABEL_GLOSS = "Est. daily burn (TDEE)";

export const ONBOARDING_REVEAL_METHODOLOGY_PLAIN =
  "Values are estimates based on the Mifflin-St Jeor equation. Sloe will re-calibrate your TDEE from your logged intake and activity data over the first ~2 weeks.";
export const ONBOARDING_REVEAL_METHODOLOGY_GLOSS =
  "Values are estimates based on the Mifflin-St Jeor equation — a standard formula for estimating the calories you burn. Sloe will re-calibrate from your logged intake and activity data over the first ~2 weeks.";

/**
 * ENG-963 (2026-06-30) — reveal-step reflection of the optional `why-now`
 * intent ("What's bringing you here?"). When the user picked an intent, the
 * reveal step echoes it back in one calm line so the plan feels built around
 * THEM ("a plan built around feeling better day to day"). Sourced here so the
 * copy is shared web ↔ mobile and never inlined at a call site — and
 * body-neutral throughout (no health claims, no outcome promises).
 *
 * Keyed by the non-null `WhyNow` ids in `whyNowOptions.ts`. The reveal step
 * renders nothing when `whyNow` is `null` (skipped / flag OFF), so there is
 * no `null` entry — the consumer guards on a non-null id before indexing.
 */
export const ONBOARDING_REVEAL_WHY_NOW_REFLECTION: Record<
  "feel-better" | "stronger" | "habit" | "event" | "curious",
  string
> = {
  "feel-better": "A plan built around feeling better day to day.",
  stronger: "A plan built around getting stronger.",
  habit: "A plan built around a steady, sustainable habit.",
  event: "A plan built around what you've got coming up.",
  curious: "A plan you can explore at your own pace.",
};

/**
 * ENG-1461 — product-wide jargon-gloss extension (2026-07-07 ratified
 * decision, ENG-1461). The onboarding pairs above cover the pace + reveal
 * trust moments; the 2026-07-06 copy verdict found the SAME "TDEE" concept
 * unglossed at three more sites, each with its own historical label:
 * Progress "Est. TDEE", pricing "Adaptive TDEE", the web weekly check-in's
 * "TDEE delta" (mobile already carries the fix — see below).
 *
 * ONE canonical label per concept, product-wide (the ratified scope):
 * plain form leads with "Estimated burn"; the glossed form keeps the
 * acronym secondary in parentheses, same grammar as the onboarding pairs.
 * All three non-onboarding sites below share this ONE pair — no
 * per-surface label variants — gated behind the same
 * `onboarding_jargon_gloss_v1` flag (default-ON, ENG-1461).
 */
export const PRODUCT_TDEE_LABEL_PLAIN = "Est. TDEE";
export const PRODUCT_TDEE_LABEL_GLOSS = "Est. daily burn (TDEE)";

/**
 * Weekly check-in "delta" row — mobile already shipped the plain label
 * ("Estimated burn change", 2026-05-11 customer-lens finding, P1) as an
 * un-gated permanent fix; web still rendered the raw "TDEE delta" jargon
 * (ENG-1461 copy-verdict finding). Both platforms now render this ONE
 * label ungated by the gloss flag — mobile's un-gated precedent already
 * proved the plain wording is correct for every user, not just a ramped
 * cohort, so there's no reason to re-introduce jargon behind a flag-OFF
 * branch on web. Kept here (not a PLAIN/GLOSS pair) because there is no
 * acronym-secondary variant — "TDEE delta" was retired outright, not glossed.
 */
export const WEEKLY_CHECKIN_BURN_DELTA_LABEL = "Estimated burn change";

/**
 * Weekly-recap "Your adaptive TDEE" section eyebrow (mobile-only straggler
 * caught by the ENG-1461 grep sweep — the ticket's named sites were
 * Progress / pricing / the check-in modal; this fourth site uses the same
 * bare-acronym-first grammar the copy verdict flagged everywhere else).
 * Same PRODUCT_TDEE_LABEL_GLOSS grammar, reworded for the "Your ___" eyebrow
 * phrasing this section already used.
 */
export const WEEKLY_RECAP_TDEE_SECTION_LABEL_PLAIN = "Your adaptive TDEE";
export const WEEKLY_RECAP_TDEE_SECTION_LABEL_GLOSS =
  "Your adaptive daily burn (TDEE)";
