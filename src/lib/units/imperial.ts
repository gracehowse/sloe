/** Display helpers: internal storage stays metric (cm, kg, ml) per schema. */

const CM_PER_IN = 2.54;
const LB_PER_KG = 2.2046226218;
const ML_PER_FLOZ_US = 29.5735;

export function kgToLb(kg: number): number {
  return kg * LB_PER_KG;
}

export function lbToKg(lb: number): number {
  return lb / LB_PER_KG;
}

export function cmToFeetInches(cm: number): { feet: number; inches: number } {
  const totalIn = cm / CM_PER_IN;
  const feet = Math.floor(totalIn / 12);
  const inches = Math.round(totalIn - feet * 12);
  return { feet, inches };
}

export function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * CM_PER_IN;
}

export function mlToUsFlOz(ml: number): number {
  return ml / ML_PER_FLOZ_US;
}

export function usFlOzToMl(flOz: number): number {
  return flOz * ML_PER_FLOZ_US;
}

export function formatHeightLabel(cm: number, imperial: boolean): string {
  if (!imperial) return `${Math.round(cm)} cm`;
  const { feet, inches } = cmToFeetInches(cm);
  return `${feet}'${inches}"`;
}

export function formatWeightLabel(kg: number, imperial: boolean): string {
  if (!imperial) return `${kg.toFixed(1)} kg`;
  return `${kgToLb(kg).toFixed(1)} lb`;
}

export function formatWaterMl(ml: number, imperial: boolean): string {
  if (!imperial) return `${Math.round(ml)} ml`;
  return `${mlToUsFlOz(ml).toFixed(1)} fl oz`;
}
