/**
 * Calorie ring geometry — web parity with `apps/mobile/components/charts/CalorieRing.tsx`.
 * Prototype ratios: size ≈ 53% viewport (cap 230), stroke 5%, radius 44%, macro arcs at 36.8/31.4/25.9%.
 */
export type CalorieRingGeometry = {
  size: number;
  strokeWidth: number;
  cx: number;
  radius: number;
  macroStroke: number;
  macroRadii: [number, number, number];
  circumference: number;
};

export function calorieRingGeometryFromSize(size: number): CalorieRingGeometry {
  const strokeWidth = Math.round(size * 0.05);
  const cx = size / 2;
  const radius = Math.round(size * 0.44);
  const macroStroke = Math.max(4, Math.round(size * 0.028));
  const macroRadii: [number, number, number] = [
    Math.round(size * 0.368),
    Math.round(size * 0.314),
    Math.round(size * 0.259),
  ];
  return {
    size,
    strokeWidth,
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
