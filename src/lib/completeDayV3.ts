/**
 * CompleteDay v3 grammar helpers (ENG-1247 §A5).
 * Shared web + mobile via `@suppr/shared/completeDayV3`.
 */

export function formatCompleteDayVsTarget(eatenKcal: number, targetKcal: number): {
  label: string;
  tone: "under" | "over" | "on";
} {
  const delta = Math.round(eatenKcal - targetKcal);
  if (delta === 0) return { label: "On target", tone: "on" };
  if (delta < 0) return { label: `−${Math.abs(delta).toLocaleString()}`, tone: "under" };
  return { label: `+${delta.toLocaleString()}`, tone: "over" };
}

export function buildCompleteDayCoachQuote(params: {
  eatenKcal: number;
  targetKcal: number;
  proteinG: number;
  proteinTargetG?: number;
}): string {
  const { eatenKcal, targetKcal, proteinG, proteinTargetG } = params;
  const under = eatenKcal <= targetKcal;
  const proteinTarget = proteinTargetG ?? Math.round(targetKcal * 0.075);
  const proteinOk = proteinG >= proteinTarget * 0.85;

  if (under && proteinOk) {
    return "A clean day — gently under, protein nailed. This is exactly the pace that holds.";
  }
  if (under) {
    return "Under budget today — keep the rhythm and aim for protein at your next meal.";
  }
  if (proteinOk) {
    return "Protein landed well — a small surplus is workable when tomorrow balances out.";
  }
  return "Logged and locked in — consistency matters more than one perfect day.";
}

/** SVG polyline points for the weight-projection card (300×80 viewBox). */
export function completeDayTrendlinePoints(): {
  baseline: string;
  projected: string;
  endY: number;
} {
  return {
    baseline: "0,30 60,32 120,29 180,31 240,30 300,30",
    projected: "0,30 60,34 120,40 180,47 240,55 300,62",
    endY: 62,
  };
}

export const COMPLETE_DAY_V3_COPY = {
  title: "Complete today",
  intro: (dayLabel: string) =>
    `Lock in ${dayLabel} and we'll fold it into your trend. Here's how today lands.`,
  projectionCaption: "if every day looked like today",
  projectionOverline: "Weight projection",
  statLabels: {
    eaten: "kcal eaten",
    vsTarget: "vs target",
    protein: "protein",
  },
  notFoundBody:
    "Add it once and it's saved for you — and everyone after you.",
  savedTitle: "Saved to the database",
  savedThanks: (name: string) =>
    `${name || "Your product"} is now linked to that barcode — it'll come straight up next time you scan it. Thanks for improving Sloe for everyone.`,
  sharedAnonymouslyNote:
    "Shared anonymously to the community database so the next person who scans it gets an instant match.",
  barcodeNotFoundTitle: "New barcode",
  barcodeNotFoundBody:
    "Add it once and it's saved for you — and everyone after you.",
} as const;
