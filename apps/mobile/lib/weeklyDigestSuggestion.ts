/**
 * Mobile re-export of the shared weekly Digest suggestion cascade.
 *
 * The Weekly Digest card on `app/(tabs)/progress.tsx` (when wired in
 * the follow-on Digest UI task) and the Sunday push body formatter
 * (when extended in T4) both import from this file. Pure re-export so
 * web and mobile cannot drift on which rule fires for the same week.
 */
export {
  selectDigestSuggestion,
  DIGEST_BODY_MAX_CHARS,
  DIGEST_HEADLINE_MAX_CHARS,
  type DigestSuggestion,
  type DigestSuggestionInput,
  type DigestSuggestionProfile,
  type DigestSuggestionRule,
  type DigestSuggestionTier,
} from "../../../src/lib/nutrition/weeklyDigestSuggestion";
