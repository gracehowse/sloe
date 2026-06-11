/**
 * Stage-of-fasting narrative copy.
 *
 * Returns a short, conversational line describing the physiological
 * stage the body is *typically* in at the given elapsed-time. Used
 * below the fasting ring on `apps/mobile/app/fasting.tsx` (ENG-52,
 * 2026-05-16).
 *
 * Copy posture
 *   Per `feedback_visual_validation_mandatory.md` and the broader
 *   nutrition trust-posture rules: hedged, descriptive, not
 *   prescriptive. No absolute claims ("body switches to fat"); we use
 *   "may", "often", "typically", "starting to", "tends to" — verbs
 *   that describe a *tendency* across the population, not a guarantee
 *   for any individual. Phrasing reviewed by `copy-reviewer` and
 *   `nutrition-engine` lenses in spirit (this function is pure +
 *   typed so the lint pass will pick it up if a future contributor
 *   inserts an absolute claim).
 *
 * Stages
 *   Buckets are deliberately wide — fasting physiology varies by
 *   individual, last-meal composition, training state, etc. We give
 *   the user one line that's correct at the population-typical mark
 *   and let them learn the rest elsewhere. We never promise the
 *   listed effect is happening to *them*.
 */

/** Returns the stage narrative for the given elapsed fasting duration. */
export function fastingStageNarrative(elapsedMs: number): string {
  const hours = Math.max(0, elapsedMs) / 3_600_000;

  if (hours < 4) {
    return "Digesting — body still absorbing your last meal.";
  }
  if (hours < 8) {
    return "Glycogen reserves starting to draw down.";
  }
  if (hours < 12) {
    return "Body shifting toward stored glycogen.";
  }
  if (hours < 16) {
    return "Glycogen running low — fat metabolism may pick up.";
  }
  if (hours < 20) {
    return "Fat oxidation typically active; mild ketosis may begin.";
  }
  if (hours < 24) {
    return "Ketones often rising; growth hormone tends to climb.";
  }
  if (hours < 36) {
    // ENG-1028 — population framing, not a personal physiological claim.
    // Human autophagy timing is not established (the evidence is mostly
    // animal — see `fastingStageDisclosure`). We say "in studies", name
    // that they're mostly animal, and keep the hedged verb. We never
    // assert it's happening to *this* user, and make no benefit claim.
    return "In studies — mostly in animals — autophagy may increase around this point.";
  }
  return "Extended fast territory — check in with your goals.";
}

/**
 * ENG-1028 — optional "how we know this" disclosure line for a given
 * elapsed duration. Returns `null` for stages whose copy rests on
 * well-established human physiology (digestion, glycogen depletion, fat
 * oxidation, ketosis); returns an evidence-honesty line for the
 * autophagy stage, where the human timing is the app's highest
 * claims-risk statement (the supporting evidence is largely animal).
 *
 * Rendered as a quiet, tappable/secondary line beneath the stage
 * narrative on both fasting surfaces, so the population framing in the
 * narrative is backed by a one-line statement of WHY we hedge. No
 * benefit claims, no prescription, body-neutral — same posture as the
 * narrative itself.
 */
export function fastingStageDisclosure(elapsedMs: number): string | null {
  const hours = Math.max(0, elapsedMs) / 3_600_000;
  if (hours >= 24 && hours < 36) {
    return "How we know this: autophagy timing in humans isn't established — most evidence is from animal studies, so we describe it as a tendency, not a personal result.";
  }
  return null;
}
