/**
 * progressStoryGate — empty-state gate for the Progress story headline.
 *
 * Authority: customer-lens audit 2026-04-30 ("ProgressHeadline renders
 * even when adaptiveTdee == null — narrative based on null is broken
 * UX") + D-2026-04-27-17 (Progress is a story, not a stat-card
 * dashboard).
 *
 * The Progress headline has three legitimate render states:
 *
 *   1. Pre-story  — the user has fewer than 3 days of logging. The
 *                   engine has nothing to say about their week.
 *                   Render the aspirational placeholder card (count
 *                   to 3 days, no claims, no numerals).
 *   2. Calibrating — the user has 3+ days but the adaptive TDEE
 *                    engine is still warming up (≤ 14 days).
 *                    Render `<ProgressHeadline>` in the calibrating
 *                    regime — copy is honest about the warm-up.
 *   3. Story      — confidence is medium/high and the engine has a
 *                    real number to surface. Render the narrative.
 *
 * This module owns rule (1). Rules (2) and (3) live in
 * `progressCommentary.ts`. The Progress page composes both: it asks
 * `hasEnoughDataForStory` first and either renders the placeholder or
 * the headline; it never renders the headline against an empty week.
 *
 * Pure module — no React, no I/O.
 */

// ENG-97 (2026-05-13): the floor + gate now live in
// `progressDataContract.ts` so every Progress surface reads the same
// constants. This module keeps `STORY_DATA_FLOOR_DAYS` as a
// re-export for the existing call sites + the placeholder copy below.
import {
  MIN_LOGGING_DAYS_FOR_STORY,
  hasEnoughDataForStory as contractHasEnoughDataForStory,
} from "./progressDataContract";

/** Minimum days of logging before we let the story render at all. */
export const STORY_DATA_FLOOR_DAYS = MIN_LOGGING_DAYS_FOR_STORY;

/**
 * Decide whether to render the engine-led `<ProgressHeadline>` or the
 * pre-story placeholder card. Re-exports the contract — the value
 * never diverges between this module and `progressDataContract.ts`.
 */
export const hasEnoughDataForStory = contractHasEnoughDataForStory;

/**
 * Resolved copy + ring progress for the placeholder card. Pure helper
 * so web + mobile render identical strings + ring fractions.
 */
export interface ProgressStoryPlaceholder {
  /** Always "THIS WEEK" — matches the eyebrow on the live story card. */
  eyebrow: "THIS WEEK";
  /** Headline — same shape the live card uses. */
  headline: string;
  /** Body — calm, factual, no motivational tone. */
  body: string;
  /** Ring fraction — `loggedDays / dataFloor`. Clamped to [0, 1]. */
  ringFraction: number;
  /** Whole-number progress for the ring label, e.g. "1 / 3". */
  ringLabel: string;
  /** Whole days remaining until the live story can render. */
  daysToFloor: number;
  /**
   * Discrete progress for the segmented day indicator: how many of the
   * `STORY_DATA_FLOOR_DAYS` segments render filled. The gate counts
   * whole days, so the indicator is N discrete segments, not a
   * continuous arc — a partial arc at 0/3 read as a stuck loading
   * spinner (fresh-eyes 2026-06-10, Grace report).
   */
  segmentsFilled: number;
}

export interface ProgressStoryPlaceholderOpts {
  /**
   * Whether the account has ANY logged history beyond the current
   * week (e.g. days in the journal store). The gate card counts the
   * CURRENT WEEK (it fronts the weekly-insight ritual), but a user
   * with weeks of data must not be greeted with cold-start copy —
   * "log a meal to start the count … your first insight" next to an
   * adherence card full of their own range data read as the screen
   * contradicting itself (fresh-eyes 2026-06-10, P0-2 resolution).
   */
  hasHistory?: boolean;
}

export function buildProgressStoryPlaceholder(
  daysLogged: number,
  opts?: ProgressStoryPlaceholderOpts,
): ProgressStoryPlaceholder {
  const hasHistory = opts?.hasHistory === true;
  const safeDays = Number.isFinite(daysLogged) && daysLogged > 0 ? Math.floor(daysLogged) : 0;
  const cappedDays = Math.min(safeDays, STORY_DATA_FLOOR_DAYS);
  const daysToFloor = Math.max(0, STORY_DATA_FLOOR_DAYS - cappedDays);
  // STORY_DATA_FLOOR_DAYS is currently 3, but guard against future
  // tuning to 0 to avoid a divide-by-zero NaN sneaking into the ring.
  const floor: number = STORY_DATA_FLOOR_DAYS;
  const ringFraction = floor === 0
    ? 1
    : Math.max(0, Math.min(1, cappedDays / floor));
  const ringLabel = `${cappedDays} / ${STORY_DATA_FLOOR_DAYS}`;

  let headline: string;
  let body: string;
  if (hasHistory) {
    // Returning user, new (or thin) week — the count is week-scoped and
    // the copy must say so. Never imply they're starting from nothing.
    if (safeDays === 0) {
      headline = "New week, fresh story";
      body = `Log ${STORY_DATA_FLOOR_DAYS} days this week to unlock this week's insight.`;
    } else if (daysToFloor === 1) {
      headline = "Almost there";
      body = "One more logged day and this week's story unlocks.";
    } else {
      headline = "This week's story is building";
      body = `${daysToFloor} more day${daysToFloor === 1 ? "" : "s"} to this week's insight.`;
    }
  } else if (safeDays === 0) {
    headline = "Your story builds with your data";
    body = `Log a meal to start the count. ${STORY_DATA_FLOOR_DAYS} days to your first insight.`;
  } else if (daysToFloor === 1) {
    headline = "Almost there";
    body = "One more logged day and your weekly story unlocks.";
  } else {
    headline = "Your story builds with your data";
    body = `${daysToFloor} more day${daysToFloor === 1 ? "" : "s"} to your first insight.`;
  }

  return {
    eyebrow: "THIS WEEK",
    headline,
    body,
    ringFraction,
    ringLabel,
    daysToFloor,
    segmentsFilled: cappedDays,
  };
}
