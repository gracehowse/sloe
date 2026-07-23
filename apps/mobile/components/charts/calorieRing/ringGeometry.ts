import { Dimensions } from "react-native";

const SCREEN_W = Dimensions.get("window").width;
const BASE_SIZE = Math.round(Math.min(SCREEN_W * 0.53, 230));

/** Shared circumference helper for ring arc math. */
export const ringCircumference = (r: number) => 2 * Math.PI * r;

/**
 * SLOE redesign ring geometry — see CalorieRing.tsx header for provenance.
 * Re-exported from `CalorieRing` for tests + TodayHeroRingGraphic.
 */
export function ringGeometry(compact: boolean, _bold = false) {
  const SIZE = compact ? Math.round(BASE_SIZE * 0.72) : BASE_SIZE;
  const MACRO_STROKE = Math.max(4, Math.round(SIZE * 0.028));
  return {
    SIZE,
    STROKE: Math.round(SIZE * 0.05),
    MACRO_STROKE,
    CX: SIZE / 2,
    R: Math.round(SIZE * 0.44),
    MACRO_R: [SIZE * 0.3855, SIZE * 0.331, SIZE * 0.2765] as [number, number, number],
  };
}
