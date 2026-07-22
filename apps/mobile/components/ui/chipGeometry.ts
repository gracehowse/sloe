import { Radius, Spacing, Type } from "@/constants/theme";

/**
 * ENG-1662 — shared chip geometry for TrustChip / ConfidenceChip /
 * SearchResultConfidenceChip. One pill shape; variant modules supply
 * fills + glyphs only.
 *
 * Product roles stay separate (trust provenance vs TDEE confidence vs
 * search-result tier) — this file unifies geometry only.
 */
export const CHIP_HEIGHT = 22;
export const CHIP_GAP = 4;
export const CHIP_PADDING_H = 8;

export const chipBaseStyle = {
  flexDirection: "row" as const,
  alignItems: "center" as const,
  alignSelf: "flex-start" as const,
  gap: CHIP_GAP,
  height: CHIP_HEIGHT,
  paddingHorizontal: CHIP_PADDING_H,
  paddingVertical: Spacing.xs,
  borderRadius: Radius.full,
};

export const chipLabelStyle = {
  ...Type.caption,
};

/** Search-result tier uses a slightly heavier label — still on the 22pt shell. */
export const chipSearchLabelStyle = {
  fontSize: 11,
  fontWeight: "700" as const,
  letterSpacing: 0.2,
  lineHeight: 14,
};
