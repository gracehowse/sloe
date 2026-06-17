/**
 * ENG-901 M5 — shared streak win-moment copy (web + mobile).
 * Figma `302:2` / TD7 `1003:2`: big serif numeral + calm editorial subhead.
 */

/** Subhead under the milestone numeral on streak celebrations. */
export const STREAK_WIN_SUBHEAD = "days consistent." as const;

/** True when the player should show milestone numeral UI instead of the % odometer. */
export function showStreakMilestoneDisplay(
  celebration: string,
  milestone: number | null | undefined,
): milestone is number {
  return celebration === "streak" && milestone != null && milestone > 0;
}
