import { Spacing } from "./theme";

/**
 * Cross-screen layout rhythm — pair with `Spacing` / `Colors` tokens.
 * 2026-05-19 premium pass: airy scroll gaps, consistent section headers.
 */
export const Layout = {
  /** Default vertical gap between major blocks inside a scroll view. */
  screenGap: Spacing.lg,
  screenPaddingX: Spacing.xl,
  screenPaddingBottom: 120,
  /**
   * Today tab — v49 / Claude Design density (prototype `gap: 10–14`,
   * phone horizontal padding 20px). Tighter than the 2026-05-19 global
   * `Spacing.md` (16px) bump that made mobile Today feel airy vs web.
   */
  /** Tight gap within the hero cluster (ring, coach, macro tiles). */
  todayScrollGap: 8,
  /** Larger break before meals / insight / lower fold (ENG-871).
   *  With `todayScrollGap` (8) yields 40px — matches Stitch `mb-10`. */
  todaySectionBreak: 32,
  /** Figma TD1/TD2 — `mb-5` between section header and first card. */
  todaySectionHeaderGap: Spacing.lg,
  /** Figma TD1/TD2 — `mb-5` between sibling cards inside a section. */
  todaySectionCardGap: Spacing.lg,
  todayScreenPaddingX: Spacing.lg,
  macroTileGridGap: 12,
  /** Plan tab — same density bar as Today; day blocks are section + flat meal card. */
  planScrollGap: 10,
  planScreenPaddingX: Spacing.lg,
  planDayGap: 12,
  /** Sticky tab chrome — title block padding. */
  chromePaddingTop: Spacing.sm,
  chromeTitleGap: 4,
  chromeAfterTitle: Spacing.xs,
  /** Section header typography (overline + title). */
  overlineSize: 11,
  overlineTracking: 1.2,
  titleSize: 24,
  titleTracking: -0.6,
  subtitleSize: 13,
} as const;
