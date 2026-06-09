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
  /** Tight gap within the hero cluster (ring, coach, macro tiles).
   *  `Spacing.sm` (8) — already on the 4pt scale; tokenised (was a bare 8) so
   *  every Today gap reads from a `Spacing` token (audit gap 7). */
  todayScrollGap: Spacing.sm,
  /** Larger break before meals / insight / lower fold (ENG-871).
   *  With `todayScrollGap` (8) yields 40px — matches Stitch `mb-10`. */
  todaySectionBreak: Spacing.xxl,
  /** Figma TD1/TD2 — `mb-5` between section header and first card. */
  todaySectionHeaderGap: Spacing.lg,
  /** Figma TD1/TD2 — `mb-5` between sibling cards inside a section. */
  todaySectionCardGap: Spacing.lg,
  todayScreenPaddingX: Spacing.lg,
  /** Between-tile gap in the 2×2 macro grid. 12px — Sloe re-skin matches
   *  Claude Design prototype density (`gap: 10–14`); picked as the midpoint
   *  12px (ENG-871). Sits between Spacing.sm (8) and Spacing.md (16) — not
   *  on the 4pt tokenised scale, but intentionally off-scale per the prototype
   *  spec (same rationale as `planDayGap: 12`). Verified 48%/48% cells still
   *  fit: ≈336px + 12px < ≈350px content width on a 390pt device. */
  macroTileGridGap: 12,
  /** Plan tab — same density bar as Today; day blocks are section + flat meal card.
   *  `Spacing.sm` (8) — on the 4pt scale (audit gap 7; was a bare 10, fully off
   *  the scale). Keeps Plan's scroll rhythm aligned with Today's `todayScrollGap`. */
  planScrollGap: Spacing.sm,
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
