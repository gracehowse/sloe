/**
 * ENG-603 — PostHog `premium_motion_v1` motion package constants.
 * Shared across web + mobile (@suppr/shared/preferences/premiumMotion).
 */
export const PREMIUM_MOTION_V1_FLAG = "premium_motion_v1";

/** Centre number count-up duration (matches ring sweep). */
export const PREMIUM_MOTION_COUNT_MS = 800;

/** Main calorie ring fill duration. */
export const PREMIUM_MOTION_RING_MS = 800;

/** Log sheet enter easing (spring-like cubic-bezier). */
export const PREMIUM_MOTION_SHEET_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";
