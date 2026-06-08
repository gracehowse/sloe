/** Single-letter weekday labels for the Today week strip.
 *
 *  Shared by **both** platforms — mobile `DayStrip` (`@suppr/shared/today/...`)
 *  and web `DayStrip` — so the design rule (canonical Figma `654:2`: single
 *  letters `S M T W T F S`, NOT three-letter `Mon/Tue/Wed`) is one tested
 *  contract that can't drift between web and mobile.
 *
 *  No platform deps (no React, no theme imports, no `@/` aliases) so it stays
 *  mobile-importable via the `@suppr/shared` alias and web-importable directly.
 *
 *  Sloe redesign (2026-06-08, Grace "match Figma 654:2 — single letters, no
 *  busy 3-letter abbrevs"): the prior `Mon/Tue/Wed` labels (2026-05-14 call
 *  for "readability at a glance") pre-dated the canonical Sloe Today frame.
 *  The frame is calmer with single letters, and the day NUMBER below each
 *  letter still disambiguates the date. Note both Sat and Sun render "S" and
 *  both Tue and Thu render "T" — that is the canonical frame's treatment; the
 *  number + position carry the disambiguation.
 */
export type WeekStartDay = "monday" | "sunday";

const MONDAY_INITIALS = ["M", "T", "W", "T", "F", "S", "S"] as const;
const SUNDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"] as const;

/** Ordered single-letter weekday labels for the given week start. */
export function weekdayInitials(weekStartDay: WeekStartDay): readonly string[] {
  return weekStartDay === "monday" ? MONDAY_INITIALS : SUNDAY_INITIALS;
}
