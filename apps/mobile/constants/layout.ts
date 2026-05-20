import { Spacing } from "./theme";

/**
 * Cross-screen layout rhythm — pair with `Spacing` / `Colors` tokens.
 * 2026-05-19 premium pass: airy scroll gaps, consistent section headers.
 */
export const Layout = {
  /** Default vertical gap between major blocks inside a scroll view. */
  screenGap: Spacing.xxl,
  screenPaddingX: Spacing.xl,
  screenPaddingBottom: 120,
  /** Sticky tab chrome — title block padding. */
  chromePaddingTop: Spacing.sm,
  chromeTitleGap: 4,
  chromeAfterTitle: Spacing.xs,
  /** Section header typography (overline + title). */
  overlineSize: 11,
  overlineTracking: 1.2,
  titleSize: 28,
  titleTracking: -0.6,
  subtitleSize: 13,
} as const;
