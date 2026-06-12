/**
 * Calorie ring geometry — web parity with `apps/mobile/components/charts/CalorieRing.tsx`.
 * Prototype ratios: size ≈ 53% viewport (cap 230), radius 44%, macro arcs at 38.55/33.1/27.65%.
 *
 * ENG-1064 (TF57 F-164/165, Grace TWICE "Today ring too fat — match macro ring
 * stroke width"): in the MULTI-RING (expanded) state the hero `strokeWidth` now
 * equals `macroStroke` (0.028·S) instead of the old fatter 0.05·S, so the
 * concentric rings read as one even family. The COLLAPSED single-ring mode uses
 * `strokeWidthBold` (0.085·S) — the confident Apple-class lone-ring stroke, with
 * no macro rings on screen to mismatch (parity with mobile `ringGeometry`'s
 * `bold` branch). Macro radii were re-derived (0.3855 / 0.331 / 0.2765) so every
 * adjacent gap stays even (~6.5px at S=230, scaling proportionally) once the
 * hero stroke thins; `radius` (0.44·S) is unchanged, so ring diameters and the
 * centre number layout do not shift.
 */
export type CalorieRingGeometry = {
  size: number;
  /** Multi-ring (expanded) hero stroke — matches `macroStroke` (ENG-1064). */
  strokeWidth: number;
  /** Collapsed single-ring hero stroke — confident 0.085·S Apple-class lone ring. */
  strokeWidthBold: number;
  cx: number;
  radius: number;
  macroStroke: number;
  macroRadii: [number, number, number];
  circumference: number;
};

export function calorieRingGeometryFromSize(size: number): CalorieRingGeometry {
  const macroStroke = Math.max(4, Math.round(size * 0.028));
  // ENG-1064: multi-ring hero stroke MATCHES the macro stroke exactly.
  const strokeWidth = macroStroke;
  const strokeWidthBold = Math.round(size * 0.085);
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
