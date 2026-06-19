/**
 * Onboarding cold-open copy aligned to Figma / Stitch frames
 * (285:2 welcome, WO1 web welcome, 192:2 plan-ready reveal).
 * Shared web ↔ mobile so ENG-895 conformance can't drift.
 */

export const ONBOARDING_WELCOME_EYEBROW =
  "For people who love food — and have goals";

export const ONBOARDING_WELCOME_BODY_WEB =
  "Save any recipe, see how it fits your day, and reach your goals without giving up the food you love.";

export const ONBOARDING_WELCOME_BODY_MOBILE =
  "The tracker for people who love food and still have goals — fit the meals you love into your day.";

export const ONBOARDING_REVEAL_SUBTITLE =
  "Built around your goal — with room for the food you love.";

export const ONBOARDING_REVEAL_PERMISSION_QUOTE =
  "No foods off-limits. We'll just help them fit.";

/**
 * ENG-1187 — jargon gloss at onboarding trust moments.
 *
 * Onboarding leans on TDEE / BMR / Mifflin-St Jeor at three trust
 * moments (welcome reassurance bullet, pace live-feedback tile, target
 * reveal) where a first-time user has no way to decode the acronyms.
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

// Site 1 — web Welcome reassurance bullet (first TDEE mention in the flow).
export const ONBOARDING_WELCOME_TDEE_BULLET_PLAIN =
  "Adaptive TDEE that learns from you";
export const ONBOARDING_WELCOME_TDEE_BULLET_GLOSS =
  "Adaptive daily calorie burn (TDEE) that learns from you";

// Site 2 — Pace step live-feedback tile label (first TDEE mention on the
// pace screen). Rendered uppercase by the tile's overline style on both
// platforms, so the source stays sentence-case for readability.
export const ONBOARDING_PACE_VS_TDEE_LABEL_PLAIN = "vs. your TDEE";
export const ONBOARDING_PACE_VS_TDEE_LABEL_GLOSS = "vs. your daily burn (TDEE)";

// Site 3 — Target reveal summary tiles + methodology note. BMR is the
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
