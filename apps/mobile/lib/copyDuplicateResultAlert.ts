/**
 * ENG-1522 — honest copy/duplicate result messaging.
 *
 * `CopyMealSheet` / `DuplicateDaySheet` (`TodayScreen.tsx`) write to each
 * target day independently (one write-ahead call per day), so a
 * multi-day range can partially fail. Pre-fix, the screen fired a blanket
 * "Copied"/"Duplicated" success `Alert` the instant the sheet confirmed —
 * before the write even started, let alone resolved. This turns the
 * per-day succeeded/failed counts into one consolidated, honest message
 * instead of a premature success claim or N stacked per-day popups.
 */
export function copyDuplicateBatchAlert(
  verb: "Copied" | "Duplicated",
  totalTargets: number,
  succeededCount: number,
  failedCount: number,
  successSummary: string,
): { title: string; message: string } {
  if (failedCount === 0) return { title: verb, message: successSummary };
  if (succeededCount === 0) {
    return {
      title: "Saved on this device",
      message: "We'll sync this log when you're back online.",
    };
  }
  return {
    title: `${verb} to some days`,
    message: `Synced to ${succeededCount} of ${totalTargets} days — the rest are saved on this device and will sync when you're back online.`,
  };
}
