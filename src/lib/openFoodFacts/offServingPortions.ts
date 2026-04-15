/**
 * Derive MFP-style serving choices from Open Food Facts product fields.
 * OFF lists `serving_size` as free text (e.g. "4 dumplings (82 g)"); we expose label + gram weight for per-100g scaling.
 */

export type OffServingOption = { label: string; grams: number };

function clampGrams(n: number): number {
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(10_000, Math.round(n * 10) / 10);
}

/** Parse a mass in parentheses, e.g. "4 dumplings (82 g)" → 82. */
export function parseParentheticalGrams(raw: string): number | null {
  const m = raw.match(/\(\s*(\d+(?:\.\d+)?)\s*(g|gram|grams|ml)\s*\)/i);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

/** Trailing "82 g" / "250 ml" on the string. */
export function parseTrailingMassGrams(raw: string): number | null {
  const t = raw.trim();
  const m = t.match(/(\d+(?:\.\d+)?)\s*(g|gram|grams|ml)\s*$/i);
  if (!m) return null;
  const n = Number.parseFloat(m[1]!);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function singularizeFoodUnit(name: string): string {
  const s = name.trim();
  if (s.length < 2) return s;
  const lower = s.toLowerCase();
  if (/ies$/i.test(s) && s.length > 3) return `${s.slice(0, -3)}y`;
  if (/(ss|us)$/i.test(lower)) return s;
  if (/oes$/i.test(lower) && s.length > 3) return s.slice(0, -2);
  if (/ches$/i.test(lower) && s.length > 4) return s.slice(0, -2);
  if ((s.endsWith("s") || s.endsWith("S")) && s.length > 2) return s.slice(0, -1);
  return s;
}

function formatCount(c: number): string {
  return Math.abs(c - Math.round(c)) < 1e-6 ? String(Math.round(c)) : String(c);
}

function truncateLabel(s: string, max = 44): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

function impliedGramsFromNutriments(n: Record<string, number | undefined>): number | null {
  const e100 = n["energy-kcal_100g"];
  const eSrv = n["energy-kcal_serving"];
  if (typeof e100 === "number" && e100 > 5 && typeof eSrv === "number" && eSrv > 0) {
    const g = 100 * (eSrv / e100);
    if (Number.isFinite(g) && g > 1 && g < 10_000) return g;
  }
  const p100 = n.proteins_100g;
  const pSrv = n.proteins_serving;
  if (typeof p100 === "number" && p100 > 0.05 && typeof pSrv === "number" && pSrv > 0) {
    const g = 100 * (pSrv / p100);
    if (Number.isFinite(g) && g > 1 && g < 10_000) return g;
  }
  return null;
}

export type OffProductServingFields = {
  serving_size?: string;
  serving_quantity?: string | number;
  serving_quantity_unit?: string;
  nutriments?: Record<string, number | undefined>;
};

/**
 * Build ordered serving presets. Always includes `100 g`. Adds label-based rows when OFF gives a serving mass.
 */
export function buildOffServingOptionsFromProduct(p: OffProductServingFields): OffServingOption[] {
  const n = p.nutriments ?? {};
  const raw = (p.serving_size ?? "").trim();

  let fromParen = parseParentheticalGrams(raw);
  if (fromParen == null) fromParen = parseTrailingMassGrams(raw);

  const su = (p.serving_quantity_unit ?? "").toString().toLowerCase().trim();
  let fromFields: number | null = null;
  const sq = p.serving_quantity;
  if (sq != null && sq !== "") {
    const q = typeof sq === "number" ? sq : Number.parseFloat(String(sq).replace(",", "."));
    if (Number.isFinite(q) && q > 0 && (su === "g" || su === "gram" || su === "grams" || su === "ml" || su === "")) {
      fromFields = q;
    }
  }

  const implied = impliedGramsFromNutriments(n);
  let servingG = fromParen ?? fromFields ?? implied;
  if (fromParen != null && fromFields != null) {
    const a = fromParen;
    const b = fromFields;
    if (Math.abs(a - b) / Math.max(a, b) > 0.25) {
      servingG = fromParen;
    } else {
      servingG = (a + b) / 2;
    }
  }

  const opts: OffServingOption[] = [];

  const beforeParen = raw.split("(")[0].trim();
  let count: number | null = null;
  let unitName: string | null = null;
  const countMatch = beforeParen.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (countMatch) {
    const c = Number.parseFloat(countMatch[1]!);
    if (Number.isFinite(c) && c > 1) {
      count = c;
      unitName = countMatch[2]!.trim();
    }
  }

  if (servingG && servingG > 0) {
    const g = clampGrams(servingG);
    if (g <= 0) {
      // fall through to 100g only
    } else if (count != null && unitName) {
      opts.push({
        label: truncateLabel(`${formatCount(count)} ${unitName}`),
        grams: g,
      });
      const per = g / count;
      if (per > 0.09 && per < g - 0.05) {
        const piece = singularizeFoodUnit(unitName);
        opts.push({
          label: truncateLabel(`1 ${piece} (~${Math.round(per)} g)`),
          grams: clampGrams(per),
        });
      }
    } else if (raw.length > 0) {
      opts.push({
        label: truncateLabel(raw.length > 48 ? `1 serving (${Math.round(g)} g)` : raw),
        grams: g,
      });
    } else {
      opts.push({ label: `1 serving (${Math.round(g)} g)`, grams: g });
    }
  }

  opts.push({ label: "100 g", grams: 100 });

  const seen = new Set<number>();
  const deduped: OffServingOption[] = [];
  for (const o of opts) {
    const k = Math.round(o.grams * 10);
    if (seen.has(k)) continue;
    seen.add(k);
    deduped.push({ label: o.label, grams: clampGrams(o.grams) });
  }
  return deduped;
}

/** Default logged amount: prefer the manufacturer serving (largest non–100 g preset). */
export function pickDefaultServingGrams(options: OffServingOption[]): number {
  const non100 = options.filter((o) => o.grams > 0 && Math.abs(o.grams - 100) > 0.5);
  if (non100.length === 0) return 100;
  return Math.round(Math.max(...non100.map((o) => o.grams)) * 10) / 10;
}
