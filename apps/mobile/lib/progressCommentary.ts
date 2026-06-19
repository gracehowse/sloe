/**
 * Mobile re-export of the shared progress-commentary helper.
 *
 * Shared with web — the underlying module is pure and platform-agnostic.
 * See `src/lib/nutrition/progressCommentary.ts` for the regime logic
 * + voice rules.
 */
export {
  generateProgressCommentary,
  splitBodyIntoSegments,
  type ProgressCommentaryInput,
  type ProgressCommentaryRegime,
  type ProgressCommentaryResult,
  type ProgressCommentaryConfidence,
  type ProgressCommentaryTdee,
} from "@suppr/nutrition-core/progressCommentary";
