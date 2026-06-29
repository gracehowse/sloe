/**
 * Date helpers for `LogWeightSheet` — extracted from the screen component so
 * the sheet stays under the 400-line screen budget (ENG-952 touch). Pure, no
 * React, no platform APIs.
 */

/** Today's date as an ISO day key (`YYYY-MM-DD`), local time. */
export function isoTodayKey(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Human label for an edit target, e.g. "5 May 2026". */
export function editDateLabel(dateISO: string): string {
  const d = new Date(dateISO + "T00:00:00");
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
