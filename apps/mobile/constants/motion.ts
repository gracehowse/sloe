import { Easing } from "react-native-reanimated";

/**
 * Motion — Canonical 2026-05-22 lock.
 *
 * Premium products have ONE recognisable motion language. Cron has a
 * gentle spring. Things 3 has dotted transitions. Notion has
 * instantaneous response. Suppr previously had ~23 files inventing
 * their own `withSpring({damping: 10, mass: 1, ...})` calls — param
 * drift was high, the brand-as-felt didn't exist.
 *
 * This token is the single source of truth. Components import from
 * here, not from inline `withSpring(...)` literals. When Apple ships
 * a new motion direction, this file changes once and the whole app
 * re-tunes.
 *
 * Roles:
 *   - `spring`        — default for present/dismiss/mount. Gentle
 *                       overshoot, premium "click into place" feel.
 *   - `springSoft`    — for value/number/progress-bar animations.
 *                       No overshoot, soft settle.
 *   - `springQuick`   — for press scale / press release. Fast but
 *                       not jittery.
 *   - `fadeIn`        — for content that should appear quietly.
 *   - `fadeOut`       — for content that should disappear quietly.
 *   - `slideIn`       — sheet-from-bottom present.
 *   - `slideOut`      — sheet dismiss.
 *
 * Existing CSS counterpart: `--ease-spring-soft` in
 * `src/styles/theme.css` (already locked to the same cubic-bezier).
 */
export const Motion = {
  // ── Springs ────────────────────────────────────────────────────
  spring: {
    damping: 18,
    stiffness: 220,
    mass: 0.9,
    overshootClamping: false,
  } as const,
  springSoft: {
    damping: 22,
    stiffness: 180,
    mass: 1,
    overshootClamping: true,
  } as const,
  springQuick: {
    damping: 14,
    stiffness: 320,
    mass: 0.7,
    overshootClamping: true,
  } as const,

  // ── Timings ────────────────────────────────────────────────────
  fadeIn: {
    duration: 220,
    easing: Easing.out(Easing.cubic),
  } as const,
  fadeOut: {
    duration: 160,
    easing: Easing.in(Easing.cubic),
  } as const,

  // ── Sheet motion ───────────────────────────────────────────────
  slideIn: {
    duration: 320,
    easing: Easing.bezier(0.34, 1.56, 0.64, 1),  // matches --ease-spring-soft
  } as const,
  slideOut: {
    duration: 220,
    easing: Easing.bezier(0.05, 0.7, 0.1, 1),    // matches --ease-decel
  } as const,
} as const;

export default Motion;
