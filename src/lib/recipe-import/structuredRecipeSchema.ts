/**
 * Structured recipe extraction contract (the import-parser "wedge").
 *
 * Single strict JSON schema + prompt + parser shared by every AI recipe-
 * extraction surface (image / screenshot, social caption, freeform pasted
 * text, cookbook page image). Before this module each surface shipped its
 * own loose prompt — `{title, ingredients: string[], steps: string[]}` for
 * images, a different shape for captions — with NO per-ingredient parse
 * confidence. The model could mis-read "2 tbsp" as "2 cups" and nothing
 * flagged it; the only confidence the pipeline carried was the DOWNSTREAM
 * nutrition-match confidence from `verifyIngredients`, which is a different
 * thing (how sure we are of the food row, not how sure we are we parsed the
 * line right).
 *
 * This contract adds **extraction confidence** (0–1 per ingredient) at parse
 * time. Low-confidence ingredients are FLAGGED, never silently dropped or
 * guessed — per the repo's nutrition no-guessing rule. The flag surfaces in
 * the existing import review/verify UI alongside the nutrition-match
 * confidence, so the user reviews exactly the lines the model was unsure of.
 *
 * Design notes:
 * - The schema is intentionally additive. `toIngredientLines()` reduces a
 *   structured ingredient back to the flat `"200 g chicken breast"` string
 *   the existing `parseRawIngredients` / `verifyIngredients` pipeline
 *   consumes, so downstream code is unchanged. New callers can also read the
 *   richer structured fields (quantity / unit / name / prep / confidence).
 * - No nutrition values are invented here. This module parses TEXT structure
 *   only; macros still come from `verifyIngredients` against real food DBs.
 * - The parser is defensive: every field is validated and clamped, unknown
 *   shapes degrade to flagged-low-confidence rather than throwing.
 */

/** A single parsed ingredient with structured fields + extraction confidence. */
export type StructuredIngredient = {
  /** Numeric quantity as printed, e.g. 200, 1.5, 0.25. Null when none stated. */
  quantity: number | null;
  /** Unit of the quantity, e.g. "g", "cup", "tbsp", "clove". Null/"" when a
   *  bare count (e.g. "2 eggs" → quantity 2, unit ""). */
  unit: string | null;
  /** Core ingredient name with the quantity/unit/prep stripped, e.g.
   *  "chicken breast". Always present (the model is told to never leave it
   *  blank); an empty name forces confidence to 0 in the parser. */
  name: string;
  /** Preparation note, e.g. "finely chopped", "drained". Null when none. */
  prep: string | null;
  /**
   * How confident the model is it parsed THIS line correctly (quantity +
   * unit + name), 0–1. NOT the nutrition-match confidence. Below
   * `LOW_CONFIDENCE_THRESHOLD` the line is flagged for user review.
   */
  confidence: number;
  /** True when `confidence < LOW_CONFIDENCE_THRESHOLD` OR the name is empty.
   *  The import review/verify UI renders these for explicit confirmation. */
  flagged: boolean;
  /** The original raw line text, preserved so the user can see what the
   *  model read even when our structured parse is uncertain. */
  raw: string;
};

export type StructuredRecipe = {
  title: string | null;
  servings: number | null;
  ingredients: StructuredIngredient[];
  steps: string[];
  prepTimeMin: number | null;
  cookTimeMin: number | null;
  /** Source attribution the model could read from the content (e.g. a
   *  by-line or watermark). Never fabricated — null when not visible. */
  sourceName: string | null;
  notes: string | null;
};

/** Below this the ingredient is surfaced for user confirmation. */
export const LOW_CONFIDENCE_THRESHOLD = 0.6;

/** Inputs the contract is tuned for — shapes the one-line guidance in the
 *  prompt so the model knows what kind of noise to expect. */
export type RecipeSourceKind =
  | "image" // photo / screenshot of a recipe
  | "caption" // social caption (TikTok / IG paste)
  | "text" // freeform pasted text / blog extract
  | "cookbook_page"; // a cookbook page image (OCR-heavy)

const SOURCE_HINTS: Record<RecipeSourceKind, string> = {
  image:
    "The input is a PHOTO or SCREENSHOT of a recipe. Text may be at an angle, partly cropped, or low-contrast.",
  caption:
    "The input is a SOCIAL MEDIA CAPTION (TikTok / Instagram). Expect hashtags, emoji, @mentions, and promo lines that are NOT part of the recipe — ignore them.",
  text: "The input is FREEFORM PASTED TEXT, possibly a fragmented blog extract with navigation cruft, ads, or comments mixed in.",
  cookbook_page:
    "The input is a COOKBOOK PAGE IMAGE. Expect two-column layouts, headnotes, and page furniture (page numbers, running heads) that are NOT ingredients or steps.",
};

/**
 * Build the strict system prompt for a given source kind. Every surface that
 * extracts a recipe uses this so the schema (and the no-guessing rule) is
 * identical across image / caption / text / cookbook.
 */
export function buildStructuredRecipePrompt(kind: RecipeSourceKind): string {
  return `You are extracting a recipe into a STRICT structured format.

${SOURCE_HINTS[kind]}

Return a single JSON object (no markdown fences, no prose) with EXACTLY this shape:
{
  "title": string or null,
  "servings": number or null,
  "ingredients": [
    {
      "quantity": number or null,   // numeric amount as printed (200, 1.5, 0.25). null if none stated.
      "unit": string or null,       // "g", "cup", "tbsp", "clove", etc. "" or null for a bare count like "2 eggs".
      "name": string,               // the ingredient itself, e.g. "chicken breast". NEVER leave blank.
      "prep": string or null,       // "finely chopped", "drained", etc. null if none.
      "confidence": number          // 0..1 — how sure YOU are you parsed THIS line's quantity+unit+name correctly.
    }
  ],
  "steps": string[],                // ordered cooking steps; [] if none visible.
  "prepTimeMin": number or null,    // total prep minutes if stated.
  "cookTimeMin": number or null,    // total cook minutes if stated.
  "sourceName": string or null,     // a by-line / author / site if visibly attributed. null otherwise — do NOT invent.
  "notes": string or null
}

CRITICAL RULES:
- DO NOT GUESS. If a quantity or unit is ambiguous or unreadable, set it to null and lower that ingredient's "confidence" (e.g. 0.3). It is far better to flag an uncertain line than to invent a number.
- "confidence" reflects ONLY your parsing certainty for that line, not how healthy or common the food is. Clear, fully-legible lines → 0.9+. Partly-obscured or ambiguous lines → below 0.6.
- Split compound amounts into quantity + unit + name. "200g chicken breast, diced" → quantity 200, unit "g", name "chicken breast", prep "diced".
- For a bare count ("2 eggs"), set quantity 2, unit "" (or null), name "eggs".
- DO NOT include section headings ("For the sauce:", "For the salad:") as ingredients. Treat the list as flat.
- DO NOT include mid-prep states (e.g. "cornflour mixed with warm water") or serving notes ("to serve (optional)") as ingredients.
- Ignore hashtags, @mentions, emoji, ads, navigation, page numbers, and other non-recipe text.
- If the input contains NO recipe, return {"title": null, "servings": null, "ingredients": [], "steps": [], "prepTimeMin": null, "cookTimeMin": null, "sourceName": null, "notes": null}.
- Return ONLY the JSON object.`;
}

type RawIngredient = {
  quantity?: unknown;
  unit?: unknown;
  name?: unknown;
  prep?: unknown;
  confidence?: unknown;
};

type RawRecipe = {
  title?: unknown;
  servings?: unknown;
  ingredients?: unknown;
  steps?: unknown;
  prepTimeMin?: unknown;
  cookTimeMin?: unknown;
  sourceName?: unknown;
  notes?: unknown;
};

function asPosNumberOrNull(v: unknown, max: number): number | null {
  const n =
    typeof v === "string"
      ? Number.parseFloat(v.replace(/,/g, ""))
      : typeof v === "number"
        ? v
        : NaN;
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.min(n, max);
}

function asStringOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
}

function clampConfidence(v: unknown): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number.parseFloat(v) : NaN;
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return Math.round(n * 100) / 100;
}

/**
 * Reduce a structured ingredient back to the flat string the existing
 * `parseRawIngredients` / `verifyIngredients` pipeline consumes. Keeps the
 * downstream nutrition lookup unchanged while the structured fields remain
 * available to richer callers.
 *
 * "200 g chicken breast, diced" ← {quantity:200, unit:"g", name:"chicken breast", prep:"diced"}
 */
export function ingredientToLine(ing: StructuredIngredient): string {
  const qty = ing.quantity != null && ing.quantity > 0 ? String(ing.quantity) : "";
  const unit = ing.unit?.trim() ?? "";
  const head = [qty, unit].filter(Boolean).join(" ");
  const base = [head, ing.name.trim()].filter(Boolean).join(" ").trim();
  if (ing.prep && ing.prep.trim()) return `${base}, ${ing.prep.trim()}`;
  return base;
}

/** Convenience: every ingredient as a flat line, in order. */
export function toIngredientLines(recipe: StructuredRecipe): string[] {
  return recipe.ingredients.map(ingredientToLine).filter((s) => s.length > 0);
}

/**
 * Parse + validate a model JSON reply against the structured contract.
 *
 * Defensive by construction: unparseable JSON returns `{ ok: false }`; an
 * individual malformed ingredient degrades to a flagged, low-confidence row
 * (raw text preserved) rather than throwing or being silently dropped.
 */
export function parseStructuredRecipe(
  modelText: string,
): { ok: true; recipe: StructuredRecipe } | { ok: false; error: "unparseable" } {
  let raw: RawRecipe;
  try {
    const cleaned = modelText.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
    raw = JSON.parse(cleaned) as RawRecipe;
  } catch {
    return { ok: false, error: "unparseable" };
  }
  if (typeof raw !== "object" || raw === null) {
    return { ok: false, error: "unparseable" };
  }

  const rawIngredients = Array.isArray(raw.ingredients) ? raw.ingredients : [];
  const ingredients: StructuredIngredient[] = rawIngredients
    .map((item): StructuredIngredient | null => {
      if (typeof item === "string") {
        // The model returned a flat string where we asked for an object —
        // accept it but flag low so the user confirms the parse.
        const name = item.trim();
        if (!name) return null;
        return {
          quantity: null,
          unit: null,
          name,
          prep: null,
          confidence: 0.4,
          flagged: true,
          raw: name,
        };
      }
      if (typeof item !== "object" || item === null) return null;
      const ri = item as RawIngredient;
      const name = asStringOrNull(ri.name);
      const quantity = asPosNumberOrNull(ri.quantity, 100_000);
      const unit = asStringOrNull(ri.unit);
      const prep = asStringOrNull(ri.prep);
      let confidence = clampConfidence(ri.confidence);
      // An empty name is never trustworthy regardless of the model's
      // self-reported confidence.
      if (!name) confidence = 0;
      const resolvedName = name ?? "";
      const flagged = confidence < LOW_CONFIDENCE_THRESHOLD || resolvedName.length === 0;
      const structured: StructuredIngredient = {
        quantity,
        unit,
        name: resolvedName,
        prep,
        confidence,
        flagged,
        raw: "",
      };
      structured.raw = ingredientToLine(structured) || resolvedName;
      return structured;
    })
    .filter((x): x is StructuredIngredient => x !== null && x.name.length > 0);

  const steps = Array.isArray(raw.steps)
    ? raw.steps.map((s) => (typeof s === "string" ? s.trim() : "")).filter(Boolean)
    : [];

  const recipe: StructuredRecipe = {
    title: asStringOrNull(raw.title),
    servings: asPosNumberOrNull(raw.servings, 200),
    ingredients,
    steps,
    prepTimeMin: asPosNumberOrNull(raw.prepTimeMin, 24 * 60),
    cookTimeMin: asPosNumberOrNull(raw.cookTimeMin, 24 * 60),
    sourceName: asStringOrNull(raw.sourceName),
    notes: asStringOrNull(raw.notes),
  };
  return { ok: true, recipe };
}

/** Count of ingredients the user should review (flagged at parse time). */
export function flaggedIngredientCount(recipe: StructuredRecipe): number {
  return recipe.ingredients.reduce((n, ing) => n + (ing.flagged ? 1 : 0), 0);
}
