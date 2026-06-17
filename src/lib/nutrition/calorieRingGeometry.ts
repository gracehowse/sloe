/**
 * Calorie ring geometry — web parity with `apps/mobile/components/charts/CalorieRing.tsx`.
 * Prototype ratios: size ≈ 53% viewport (cap 230), radius 44%, macro arcs at 38.55/33.1/27.65%.
 *
 * 2026-06-16 (founder, REVERSES ENG-1064/F-164/165): the calorie ring is ONE
 * consistent stroke (0.05·S) whether macros are shown or hidden — a deliberate
 * HERO over the 0.028·S macro satellites, and it must not change thickness on
 * toggle (founder constraint). The old build-57 "too fat" read was a 0.05·S hero
 * over the near-invisible frost-mist track; with the new saturated greyed-full
 * track (docs/decisions/2026-06-16-ring-track-contrast.md) the hierarchy reads
 * as intentional. Founder approved 0.05·S in-sim. Macro radii (0.3855/0.331/
 * 0.2765) and `radius` (0.44·S) are unchanged — the thicker hero only tightens
 * the calorie→protein gap (never a wide one).
 */
export type CalorieRingGeometry = {
  size: number;
  /** Calorie hero stroke (expanded) — 0.05·S, a step above `macroStroke` (2026-06-16). */
  strokeWidth: number;
  /** Collapsed single-ring stroke — 0.05·S, SAME as expanded (no jump on toggle). */
  strokeWidthBold: number;
  cx: number;
  radius: number;
  macroStroke: number;
  macroRadii: [number, number, number];
  circumference: number;
};

export function calorieRingGeometryFromSize(size: number): CalorieRingGeometry {
  const macroStroke = Math.max(4, Math.round(size * 0.028));
  // 2026-06-16 (founder, reverses ENG-1064): calorie ring is ONE stroke (0.05·S)
  // in both states — a hero over the 0.028·S macros; must not jump on toggle.
  const strokeWidth = Math.round(size * 0.05);
  const strokeWidthBold = Math.round(size * 0.05);
  const cx = size / 2;
  const radius = Math.round(size * 0.44);
  const macroRadii: [number, number, number] = [
    Math.round(size * 0.3855),
    Math.round(size * 0.331),
    Math.round(size * 0.2765),
  ];
  return {
    size,
    strokeWidth,
    strokeWidthBold,
    cx,
    radius,
    macroStroke,
    macroRadii,
    circumference: 2 * Math.PI * radius,
  };
}

/** Match mobile `SIZE = min(screenW * 0.53, 230)`. */
export function calorieRingGeometryForViewport(viewportWidth: number): CalorieRingGeometry {
  const size = Math.round(Math.min(viewportWidth * 0.53, 230));
  return calorieRingGeometryFromSize(size);
}
