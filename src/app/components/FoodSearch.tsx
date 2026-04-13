"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, Check, ChevronRight, Loader2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog.tsx";
import { Input } from "./ui/input.tsx";

// ── Types ────────────────────────────────────────────────────────────

type MacrosPer100g = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
};

type FoodPortion = { label: string; gramWeight: number; amount: number };

type SearchResult = {
  key: string;
  name: string;
  calsPer100g?: number;
  macrosPer100g?: MacrosPer100g;
  verified?: boolean;
  imageUrl?: string | null;
  _source: "USDA" | "OFF";
  _fdcId?: number;
  _offCode?: string;
};

export type FoodSearchSelection = {
  name: string;
  source: "USDA" | "OFF";
  macrosPer100g: MacrosPer100g;
  portions: FoodPortion[];
  chosenPortion: FoodPortion;
  quantity: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSelect: (selection: FoodSearchSelection) => void;
  initialQuery?: string;
  /** Original recipe amount (e.g. 2 for "2 chicken breasts") */
  initialAmount?: number | string | null;
  /** Original recipe unit (e.g. "lb", "cup", "g") */
  initialUnit?: string | null;
  /** Original ingredient description shown as context (e.g. "1 lb chicken breast") */
  originalDescription?: string | null;
};

// ── Standard units ──────────────────────────────────────────────────

const STANDARD_UNITS: FoodPortion[] = [
  { label: "g", gramWeight: 1, amount: 1 },
  { label: "oz", gramWeight: 28.35, amount: 1 },
  { label: "lb", gramWeight: 453.59, amount: 1 },
  { label: "tbsp", gramWeight: 14.79, amount: 1 },
  { label: "tsp", gramWeight: 4.93, amount: 1 },
  { label: "cup", gramWeight: 236.59, amount: 1 },
  { label: "ml", gramWeight: 1, amount: 1 },
];

// ── Helpers (ported from mobile verifyRecipe.ts) ────────────────────

function titleCase(s: string): string {
  const upper = s.replace(/[^A-Z]/g, "").length;
  const lower = s.replace(/[^a-z]/g, "").length;
  if (upper > lower * 2 || (lower > 0 && upper === 0 && s === s.toLowerCase())) {
    return s.toLowerCase().replace(/(?:^|\s|[-/])\w/g, (c) => c.toUpperCase());
  }
  return s;
}

function searchRelevance(query: string, name: string): number {
  const q = query.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const n = name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!q || !n) return 0;
  if (q === n) return 1;
  const qTokens = q.split(" ").filter(Boolean);
  const nTokens = new Set(n.split(" ").filter(Boolean));
  let hits = 0;
  for (const t of qTokens) if (nTokens.has(t)) hits++;
  const recall = hits / Math.max(1, qTokens.length);
  const brevity = Math.min(1, 4 / Math.max(1, nTokens.size));
  return recall * 0.7 + recall * brevity * 0.3;
}

function scaleMacros(per100g: MacrosPer100g, grams: number): MacrosPer100g {
  const f = grams / 100;
  return {
    calories: Math.round(per100g.calories * f),
    protein: Math.round(per100g.protein * f * 10) / 10,
    carbs: Math.round(per100g.carbs * f * 10) / 10,
    fat: Math.round(per100g.fat * f * 10) / 10,
    fiberG: Math.round(per100g.fiberG * f * 10) / 10,
    sugarG: Math.round(per100g.sugarG * f * 10) / 10,
    sodiumMg: Math.round(per100g.sodiumMg * f),
  };
}

// ── Search API calls ────────────────────────────────────────────────

async function searchUsda(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(`/api/usda/search?q=${encodeURIComponent(query.trim())}`);
    const json = await res.json();
    if (!json.ok || !Array.isArray(json.hits)) return [];
    return json.hits.map((h: any) => ({
      key: `usda-${h.fdcId}`,
      name: titleCase(h.description ?? "Unknown"),
      calsPer100g: h.calories,
      macrosPer100g: h.calories != null ? { calories: h.calories, protein: h.protein ?? 0, carbs: h.carbs ?? 0, fat: h.fat ?? 0, fiberG: 0, sugarG: 0, sodiumMg: 0 } : undefined,
      verified: /foundation|sr legacy|survey/i.test(h.dataType ?? ""),
      _source: "USDA" as const,
      _fdcId: h.fdcId,
    }));
  } catch { return []; }
}

async function searchOff(query: string): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query.trim())}&search_simple=1&action=process&json=1&page_size=10&fields=code,product_name,brands,nutriments`,
    );
    const data = await res.json();
    if (!Array.isArray(data.products)) return [];
    return data.products
      .filter((p: any) => p.product_name && p.nutriments)
      .map((p: any) => {
        const n = p.nutriments ?? {};
        const brand = titleCase((p.brands ?? "").split(",")[0]?.trim() ?? "");
        const name = titleCase(p.product_name ?? "Unknown");
        const displayName = [brand, name].filter(Boolean).join(" · ");
        const cals = Math.round(n["energy-kcal_100g"] ?? 0);
        return {
          key: `off-${p.code}`,
          name: displayName,
          calsPer100g: cals,
          macrosPer100g: cals > 0 ? {
            calories: cals,
            protein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
            carbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
            fat: Math.round((n.fat_100g ?? 0) * 10) / 10,
            fiberG: Math.round((n.fiber_100g ?? 0) * 10) / 10,
            sugarG: Math.round((n["sugars_100g"] ?? 0) * 10) / 10,
            sodiumMg: Math.round((n.sodium_100g ?? 0) * 1000),
          } : undefined,
          _source: "OFF" as const,
          _offCode: p.code,
        };
      })
      .filter((r: SearchResult) => r.calsPer100g && r.calsPer100g > 0);
  } catch { return []; }
}

async function fetchUsdaDetail(fdcId: number): Promise<{ macrosPer100g: MacrosPer100g; portions: FoodPortion[] } | null> {
  try {
    const res = await fetch(`/api/usda/food?fdcId=${fdcId}`);
    const json = await res.json();
    if (!json.ok) return null;
    return { macrosPer100g: json.macrosPer100g, portions: Array.isArray(json.portions) ? json.portions : [] };
  } catch { return null; }
}

/** Find the best matching portion for the original recipe unit, returning portion + quantity */
function resolveInitialPortion(
  portions: FoodPortion[],
  amount: number | string | null | undefined,
  unit: string | null | undefined,
): { portion: FoodPortion; quantity: number } {
  const rawAmt = typeof amount === "string" ? parseFloat(amount) : amount;
  const amt = rawAmt != null && rawAmt > 0 ? rawAmt : 1;
  const u = (unit ?? "").trim().toLowerCase();

  if (!u) {
    const gPortion = portions.find((p) => p.label === "g");
    return { portion: gPortion ?? portions[0], quantity: amt > 10 ? amt : 100 };
  }

  const UNIT_TO_LABEL: Record<string, string[]> = {
    g: ["g"], gram: ["g"], grams: ["g"],
    oz: ["oz"], ounce: ["oz"], ounces: ["oz"],
    lb: ["lb"], pound: ["lb"], pounds: ["lb"],
    cup: ["cup"], cups: ["cup"],
    tbsp: ["tbsp"], tablespoon: ["tbsp"], tablespoons: ["tbsp"],
    tsp: ["tsp"], teaspoon: ["tsp"], teaspoons: ["tsp"],
    ml: ["ml"],
    "fl oz": ["fl oz"],
    kg: ["g"],
  };

  const labels = UNIT_TO_LABEL[u];
  if (labels) {
    for (const label of labels) {
      const match = portions.find((p) => p.label.toLowerCase() === label);
      if (match) {
        const qty = u === "kg" ? amt * 1000 : amt;
        return { portion: match, quantity: qty };
      }
    }
  }

  const directMatch = portions.find((p) => p.label.toLowerCase() === u);
  if (directMatch) return { portion: directMatch, quantity: amt };

  const UNIT_GRAMS: Record<string, number> = {
    lb: 453.6, pound: 453.6, pounds: 453.6,
    oz: 28.35, ounce: 28.35, ounces: 28.35, kg: 1000,
    cup: 236.59, cups: 236.59, tbsp: 14.79, tsp: 4.93, ml: 1, "fl oz": 29.57,
    breast: 200, thigh: 120, drumstick: 90, wing: 40, fillet: 170,
    chop: 150, steak: 225, leg: 250,
    medium: 110, large: 180, small: 80,
    slice: 25, rasher: 28, clove: 4, tin: 400, can: 400,
  };
  const gPerUnit = UNIT_GRAMS[u];
  if (gPerUnit) {
    const gPortion = portions.find((p) => p.label === "g");
    if (gPortion) return { portion: gPortion, quantity: Math.round(amt * gPerUnit) };
  }

  return { portion: portions[0], quantity: amt };
}

// ── Component ───────────────────────────────────────────────────────

export function FoodSearch({ open, onClose, onSelect, initialQuery = "", initialAmount, initialUnit, originalDescription }: Props) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    name: string;
    source: "USDA" | "OFF";
    macrosPer100g: MacrosPer100g;
    portions: FoodPortion[];
    chosenPortion: FoodPortion;
    quantity: number;
  } | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backfillRef = useRef(0);

  const backfillMissingMacros = useCallback((items: SearchResult[]) => {
    const id = ++backfillRef.current;
    const missing = items
      .filter((r) => r._source === "USDA" && r._fdcId && !r.macrosPer100g && !(r.calsPer100g && r.calsPer100g > 0))
      .slice(0, 2);
    if (missing.length === 0) return;
    for (const item of missing) {
      const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000));
      Promise.race([fetchUsdaDetail(item._fdcId!), timeout])
        .then((detail) => {
          if (!detail || backfillRef.current !== id) return;
          setResults((prev) =>
            prev.map((r) =>
              r.key === item.key
                ? { ...r, macrosPer100g: detail.macrosPer100g, calsPer100g: detail.macrosPer100g.calories }
                : r,
            ),
          );
        })
        .catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (open) {
      setQuery(initialQuery);
      setResults([]);
      setPreview(null);
      backfillRef.current++;
      if (initialQuery.trim()) {
        setLoading(true);
        Promise.all([searchUsda(initialQuery), searchOff(initialQuery)]).then(([usda, off]) => {
          const merged = mergeAndDedup(initialQuery, usda, off);
          setResults(merged);
          setLoading(false);
          backfillMissingMacros(merged);
        });
      }
    }
  }, [open, initialQuery, backfillMissingMacros]);

  const onChangeQuery = useCallback((text: string) => {
    setQuery(text);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    backfillRef.current++;
    const q = text.trim();
    if (!q) { setResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const [usda, off] = await Promise.all([searchUsda(q), searchOff(q)]);
      const merged = mergeAndDedup(q, usda, off);
      setResults(merged);
      setLoading(false);
      backfillMissingMacros(merged);
    }, 400);
  }, [backfillMissingMacros]);

  function mergeAndDedup(q: string, usda: SearchResult[], off: SearchResult[]): SearchResult[] {
    const all = [...usda, ...off]
      .map((r) => ({ ...r, _rel: searchRelevance(q, r.name) }))
      .sort((a, b) => b._rel - a._rel);
    const seen = new Set<string>();
    const deduped: SearchResult[] = [];
    for (const r of all) {
      const norm = r.name.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (seen.has(norm)) continue;
      seen.add(norm);
      deduped.push(r);
      if (deduped.length >= 20) break;
    }
    return deduped;
  }

  const onPickResult = useCallback(async (item: SearchResult) => {
    setLoadingKey(item.key);
    if (item._source === "USDA" && item._fdcId) {
      const detail = await fetchUsdaDetail(item._fdcId);
      setLoadingKey(null);
      if (!detail) return;
      const portions = buildPortions(detail.portions);
      const { portion, quantity } = resolveInitialPortion(portions, initialAmount, initialUnit);
      setPreview({ name: item.name, source: "USDA", macrosPer100g: detail.macrosPer100g, portions, chosenPortion: portion, quantity });
    } else if (item._source === "OFF" && item.macrosPer100g) {
      setLoadingKey(null);
      const portions = buildPortions([]);
      const { portion, quantity } = resolveInitialPortion(portions, initialAmount, initialUnit);
      setPreview({ name: item.name, source: "OFF", macrosPer100g: item.macrosPer100g, portions, chosenPortion: portion, quantity });
    } else {
      setLoadingKey(null);
    }
  }, [initialAmount, initialUnit]);

  function buildPortions(apiPortions: FoodPortion[]): FoodPortion[] {
    const seen = new Set<string>();
    const result: FoodPortion[] = [];
    for (const u of STANDARD_UNITS) { seen.add(u.label.toLowerCase()); result.push(u); }
    for (const p of apiPortions) {
      const key = p.label.toLowerCase().trim();
      if (!seen.has(key) && key !== "100 g") { seen.add(key); result.push(p); }
    }
    return result;
  }

  const onConfirm = useCallback(() => {
    if (!preview) return;
    onSelect({ ...preview });
    setPreview(null);
    onClose();
  }, [preview, onSelect, onClose]);

  const scaled = useMemo(() => {
    if (!preview) return null;
    return scaleMacros(preview.macrosPer100g, preview.chosenPortion.gramWeight * preview.quantity);
  }, [preview]);

  const totalGrams = preview ? Math.round(preview.chosenPortion.gramWeight * preview.quantity * 10) / 10 : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3">
          <DialogTitle>Search Foods</DialogTitle>
        </DialogHeader>

        {/* Search input */}
        <div className="px-6 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              value={query}
              onChange={(e) => onChangeQuery(e.target.value)}
              placeholder="Search foods..."
              className="pl-9"
              autoFocus
            />
          </div>
        </div>

        {/* Results or Preview */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {preview && scaled ? (
            <div className="space-y-4">
              <button onClick={() => setPreview(null)} className="text-sm text-violet-600 hover:underline flex items-center gap-1">
                <ChevronRight className="h-3 w-3 rotate-180" /> Back to results
              </button>

              <h3 className="font-semibold text-slate-900 dark:text-white">{preview.name}</h3>

              {originalDescription && (
                <p className="text-sm italic text-slate-500 dark:text-slate-400 -mt-1">
                  Recipe calls for: {originalDescription}
                </p>
              )}

              {/* Serving size */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Serving size</p>
                <div className="flex flex-wrap gap-1.5">
                  {preview.portions.map((p, i) => (
                    <button
                      key={`${p.label}-${i}`}
                      onClick={() => setPreview((prev) => {
                        if (!prev) return prev;
                        const defaultQty = p.label === "g" || p.label === "ml" ? 100 : 1;
                        return { ...prev, chosenPortion: p, quantity: defaultQty };
                      })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        preview.chosenPortion.label === p.label
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:border-slate-300"
                      }`}
                    >
                      {p.label}
                      {p.gramWeight !== 1 && <span className="block text-[10px] text-slate-400">{p.gramWeight}g</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quantity */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Number of servings</p>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPreview((p) => {
                      if (!p || p.quantity <= 0.25) return p;
                      const step = p.chosenPortion.label === "g" || p.chosenPortion.label === "ml" ? 5 : 0.25;
                      return { ...p, quantity: Math.max(0, Math.round((p.quantity - step) * 100) / 100) };
                    })}
                    className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                  >
                    -
                  </button>
                  <input
                    type="number"
                    value={preview.quantity}
                    onChange={(e) => {
                      const num = parseFloat(e.target.value);
                      if (!isNaN(num) && num >= 0) setPreview((p) => p ? { ...p, quantity: num } : p);
                    }}
                    className="w-20 text-center font-semibold border border-slate-200 dark:border-slate-700 rounded-lg py-1.5 bg-transparent text-slate-900 dark:text-white"
                  />
                  <button
                    onClick={() => setPreview((p) => {
                      if (!p) return p;
                      const step = p.chosenPortion.label === "g" || p.chosenPortion.label === "ml" ? 5 : 0.25;
                      return { ...p, quantity: Math.round((p.quantity + step) * 100) / 100 };
                    })}
                    className="w-8 h-8 rounded-full border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 hover:bg-slate-50"
                  >
                    +
                  </button>
                  <span className="text-sm text-slate-400">= {totalGrams}g</span>
                </div>
              </div>

              {/* Nutrition */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Nutrition</p>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {[
                    ["Calories", `${scaled.calories} kcal`],
                    ["Protein", `${scaled.protein}g`],
                    ["Carbs", `${scaled.carbs}g`],
                    ["Fat", `${scaled.fat}g`],
                    ...(scaled.fiberG > 0 ? [["Fibre", `${scaled.fiberG}g`]] : []),
                    ...(scaled.sugarG > 0 ? [["Sugar", `${scaled.sugarG}g`]] : []),
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-800">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-medium text-slate-900 dark:text-white">{val}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                onClick={onConfirm}
                className="w-full py-3 rounded-xl bg-emerald-500 text-white font-semibold hover:bg-emerald-600 transition-colors flex items-center justify-center gap-2"
              >
                <Check className="h-4 w-4" />
                Use this
              </button>
            </div>
          ) : (
            <>
              {loading && results.length === 0 && (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                </div>
              )}

              {results.length > 0 && (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {results.map((item) => (
                    <button
                      key={item.key}
                      onClick={() => onPickResult(item)}
                      disabled={loadingKey === item.key}
                      className="w-full flex items-center gap-3 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors rounded-lg px-2 -mx-2"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          {item.verified && <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />}
                          <span className="text-sm font-medium text-slate-900 dark:text-white truncate">{item.name}</span>
                        </div>
                        {item.macrosPer100g && (
                          <div className="flex gap-2 mt-0.5 text-[11px] text-slate-500">
                            <span>{item.macrosPer100g.calories} kcal</span>
                            <span className="text-red-400">P:{item.macrosPer100g.protein}g</span>
                            <span className="text-blue-400">C:{item.macrosPer100g.carbs}g</span>
                            <span className="text-yellow-500">F:{item.macrosPer100g.fat}g</span>
                          </div>
                        )}
                        {!item.macrosPer100g && item.calsPer100g != null && item.calsPer100g > 0 && (
                          <span className="text-[11px] text-slate-500">{item.calsPer100g} kcal per 100g</span>
                        )}
                        {!item.macrosPer100g && !(item.calsPer100g != null && item.calsPer100g > 0) && (
                          <span className="text-xs text-slate-400">Tap for nutrition info</span>
                        )}
                      </div>
                      {item.calsPer100g != null && item.calsPer100g > 0 && loadingKey !== item.key && (
                        <span className="text-sm font-bold text-slate-700 dark:text-slate-300 tabular-nums">{item.calsPer100g}</span>
                      )}
                      {loadingKey === item.key ? (
                        <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-slate-400" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {!loading && query.trim() && results.length === 0 && (
                <p className="text-sm text-slate-500 text-center py-8">
                  No results for &quot;{query}&quot;. Try a simpler term.
                </p>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
