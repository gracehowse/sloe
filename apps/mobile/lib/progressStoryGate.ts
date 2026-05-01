/**
 * Mobile re-export of the shared progress story-gate helper. Pure +
 * platform-agnostic — see `src/lib/nutrition/progressStoryGate.ts` for
 * the data-floor + placeholder rules.
 */
export {
  STORY_DATA_FLOOR_DAYS,
  buildProgressStoryPlaceholder,
  hasEnoughDataForStory,
  type ProgressStoryPlaceholder,
} from "../../../src/lib/nutrition/progressStoryGate";
