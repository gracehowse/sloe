/**
 * ENG-1502 (extraction pass, screen-budget ratchet ENG-621/717) — two pure
 * TodayScreen helpers lifted byte-for-byte out of
 * `apps/mobile/app/(tabs)/_today/TodayScreen.tsx`:
 *
 * - `formatMealSourceLabelForRow` — compact source line under a meal title
 *   (matches web NutritionSourceBadge intent).
 * - `parseByDayNumberMap` — Supabase JSONB sometimes arrives as a string;
 *   normalize to a day → number map.
 */

export function formatMealSourceLabelForRow(source: string | null | undefined): string | null {
  if (source == null || !String(source).trim()) return null;
  const s = String(source).trim();
  const low = s.toLowerCase();
  if (low.includes("open food facts") && low.includes("adjusted")) return "OFF · adjusted";
  if (low.includes("open food facts")) return "Open Food Facts";
  if (low.includes("usda")) return "USDA";
  if (low.includes("ai photo")) return "AI photo";
  if (low.includes("ai voice")) return "AI voice";
  if (low.includes("nutrition label")) return "Nutrition label";
  if (low.includes("quick entry")) return "Quick entry";
  if (low === "manual" || low.includes("manual")) return "Manual";
  if (low.includes("meal plan")) return "Meal plan";
  if (s.length <= 24) return s;
  return `${s.slice(0, 22)}…`;
}

export function parseByDayNumberMap(raw: unknown): Record<string, number> {
  let obj: Record<string, unknown> | null = null;
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      if (p && typeof p === "object" && !Array.isArray(p)) obj = p as Record<string, unknown>;
    } catch {
      return {};
    }
  } else if (typeof raw === "object" && !Array.isArray(raw)) {
    obj = raw as Record<string, unknown>;
  }
  if (!obj) return {};
  const next: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj)) {
    const n = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(n)) next[k] = Math.round(n);
  }
  return next;
}
