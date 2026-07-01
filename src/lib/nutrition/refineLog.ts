/**
 * Refine-by-describing (ENG-974) — conversational correction for AI food logs.
 *
 * Closes Cal AI's most-cited 2026 failure: corrections "don't work". After a
 * photo or voice log produces an estimate, the user types a free-text
 * refinement ("that was a large bowl, no rice, add a fried egg") and the model
 * re-estimates the WHOLE result from the current items + the refinement.
 *
 * Pure, platform-agnostic. The API route (`app/api/nutrition/refine-log/route.ts`)
 * imports the prompt builders + validators; mobile
 * (`apps/mobile/components/RefineByDescribing.tsx`) and web
 * (`src/app/components/suppr/refine-by-describing.tsx`) import the request/
 * response types only. The model call happens SERVER-SIDE ONLY — the client
 * never talks to the model directly (prod pattern).
 *
 * Trust posture (non-negotiable, CLAUDE.md):
 *  - Nutrition is always ESTIMATED. The refine prompt forbids fabricating a
 *    tight number from a vague refinement. When the correction is ambiguous
 *    (e.g. "make it bigger" with no portion), the model must WIDEN the range
 *    and drop the item to `low` confidence rather than invent precise grams.
 *  - For the photo (range-first) path the corrected result re-runs through the
 *    existing `parsePhotoLogRangedResponse` validator, so a malformed or
 *    negative number is dropped exactly as on the first analyse.
 *  - For the voice path the model only RE-PARSES the food list from the current
 *    items + refinement; nutrition still comes from the verified pipeline
 *    (`verifyIngredients`) in the route, never from the LLM's free-text macros.
 *
 * See `docs/decisions/2026-07-01-log-refine-by-describing.md`.
 */

import {
  parsePhotoLogRangedResponse,
  type PhotoLogItemRanged,
  type PhotoLogParseOutcome,
} from "./photoLogRanges";

/** The two logging surfaces a refinement can operate on. */
export type RefineLogSource = "photo" | "voice";

/** A voice item as the client holds it during review — the sanitised
 *  `AiLoggedItem` shape (macros are point estimates from the verified
 *  pipeline, not the model). Only the fields the refine prompt needs are
 *  required; the route re-derives everything else. */
export type RefineVoiceItem = {
  name: string;
  /** Human-readable portion ("2 large", "1 cup"), from the verified row. */
  quantity?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

/**
 * Request body for `POST /api/nutrition/refine-log`.
 *
 * `round` is 1-indexed and increments per refinement so analytics can measure
 * how many turns a correction loop takes (Cal AI's loop is 0 — you can't
 * correct at all). The route clamps it; the client is the source of truth for
 * display but never trusted for auth/rate decisions.
 */
export type RefineLogRequest =
  | {
      source: "photo";
      /** The user's free-text correction. Trimmed + length-capped in the route. */
      refinementText: string;
      /** 1-indexed refinement round (this is the Nth refine on the result). */
      round: number;
      /** The CURRENT ranged items the refinement operates on (conversational —
       *  each refine builds on the last corrected result, not the original). */
      items: PhotoLogItemRanged[];
      /** Optional caveats string carried from the prior result. */
      notes?: string | null;
    }
  | {
      source: "voice";
      refinementText: string;
      round: number;
      /** The CURRENT reviewed voice items the refinement operates on. */
      items: RefineVoiceItem[];
      /** The original transcript, for context (the model re-parses foods from
       *  items + refinement; the transcript disambiguates prep/wording). */
      transcript?: string | null;
    };

/** Max characters accepted from the refinement text — a calm one-liner, not a
 *  paste. Longer inputs are truncated in the route before the model sees them. */
export const REFINE_TEXT_MAX_CHARS = 280;

/** Hard ceiling on refinement rounds per result before the client hides the
 *  input (defensive — a well-behaved correction converges in 1-3 turns; this
 *  stops a pathological loop from burning the AI budget). */
export const REFINE_MAX_ROUNDS = 8;

/** The shared refine-guardrail block — pinned so BOTH the photo and voice
 *  prompts (and the tests that assert the trust posture) reference one source
 *  of truth for the "never fabricate a confident number" rule. */
export const REFINE_TRUST_RULES = [
  "Apply ONLY the change the user described. Leave every other item exactly as-is.",
  "The user may: change a portion (bigger/smaller/'large bowl'), remove an item ('no rice'), add an item ('add a fried egg'), or correct an identification ('that's brown rice not white').",
  "Nutrition is always an ESTIMATE. NEVER invent a precise number to satisfy a vague correction.",
  "If the correction is vague about amount (e.g. 'make it bigger', 'a bit more'), WIDEN that item's calorie range and set its confidence to 'low' — do not pick a confident midpoint you can't justify.",
  "If you cannot tell what the user means, keep the current result unchanged rather than guessing.",
].join("\n- ");

/**
 * Build the photo (range-first) refine prompt. Returns `{ system, user }` — the
 * route passes these straight to `callAiText` (no image is re-sent; the current
 * items already carry the vision result, and re-uploading the photo on every
 * refine would cost a full vision call per turn). The model corrects the
 * structured list, not the pixels.
 */
export function buildPhotoRefinePrompt(input: {
  items: PhotoLogItemRanged[];
  refinementText: string;
  notes?: string | null;
}): { system: string; user: string } {
  const system = `You are a precise nutrition coach REVISING an existing itemised meal estimate based on the user's correction.

You will receive the CURRENT list of items (each with a calorie RANGE, optional macro ranges, a portion hint, a confidence, and a macro-role category) and a short free-text correction from the user. Return the CORRECTED list as a single JSON object in the EXACT same shape as the input items.

RULES:
- ${REFINE_TRUST_RULES}
- Keep calorie ranges tight when you're sure (within ~15% of midpoint), wider when the correction leaves the amount uncertain. Never widen to "feel safer" and never narrow to look confident.
- "confidence" reflects how sure you are of this item at the portion now implied: high = clear + standard portion; medium = plausible alternatives; low = ambiguous amount or identity.
- When ADDING an item, give it a sensible category and an honest range for a standard portion; if the user didn't specify a size, use a typical serving and set confidence to 'medium' (or 'low' if the food's portion varies a lot).
- When REMOVING an item, drop it from the list entirely.
- DO NOT return totals — the client recomputes them from items.

EXACT JSON SHAPE (no markdown fences, no prose):
{
  "items": [
    {
      "name": "string",
      "category": "string — macro-role label",
      "quantityHint": "string — verbal portion hint, OPTIONAL",
      "calories": { "low": number, "high": number },
      "protein": { "low": number, "high": number } | null,
      "carbs": { "low": number, "high": number } | null,
      "fat": { "low": number, "high": number } | null,
      "confidence": "high" | "medium" | "low"
    }
  ],
  "notes": "string — short caveats about what changed or what's still uncertain. OPTIONAL."
}

Return ONLY the JSON object.`;

  const currentJson = JSON.stringify(
    {
      items: input.items.map((it) => ({
        name: it.name,
        category: it.category,
        quantityHint: it.quantityHint,
        calories: it.calories,
        protein: it.protein ?? null,
        carbs: it.carbs ?? null,
        fat: it.fat ?? null,
        confidence: it.confidence,
      })),
      notes: input.notes ?? undefined,
    },
    null,
    0,
  );

  const user = `CURRENT ESTIMATE:
${currentJson}

USER CORRECTION: "${input.refinementText}"

Return the corrected JSON.`;

  return { system, user };
}

/**
 * Build the voice refine prompt. The voice path never asks the model for
 * nutrition — it re-parses the FOOD LIST (names + amounts + units) from the
 * current items + the correction, and the route runs the result back through
 * the verified nutrition pipeline. This keeps the "no invented macros" rule
 * intact through the refine loop.
 */
export function buildVoiceRefinePrompt(input: {
  items: RefineVoiceItem[];
  refinementText: string;
  transcript?: string | null;
}): { system: string; user: string } {
  const system = `You REVISE a parsed food list based on the user's correction. You do NOT estimate calories or macros — you only output foods, amounts, and units. A separate verified nutrition database will compute the numbers.

RULES:
- ${REFINE_TRUST_RULES}
- Output every food that should remain after the correction (unchanged items included), plus any the user added, minus any the user removed.
- Parse natural-language quantities: "two eggs" → amount "2", unit "large"; "a cup of rice" → amount "1", unit "cup".
- Be specific about preparation when implied ("eggs" at breakfast → "scrambled eggs").
- Do NOT output calories or macros — only name, amount, unit.

EXACT JSON SHAPE (no markdown fences, no prose):
{
  "items": [
    { "name": "specific food name", "amount": "numeric amount as string", "unit": "unit of measure" }
  ]
}

Return ONLY the JSON object.`;

  const currentList = input.items
    .map((it) => `- ${it.name}${it.quantity ? ` (${it.quantity})` : ""}`)
    .join("\n");

  const user = `${input.transcript ? `ORIGINAL DESCRIPTION: "${input.transcript}"\n\n` : ""}CURRENT FOODS:
${currentList || "(none)"}

USER CORRECTION: "${input.refinementText}"

Return the corrected foods as JSON.`;

  return { system, user };
}

/** Parsed voice-refine food (name + amount + unit) — fed to `verifyIngredients`
 *  by the route, never trusted for nutrition. */
export type RefineVoiceParsedFood = { name: string; amount: string; unit: string };

/**
 * Validate the model's photo-refine reply. Reuses the SAME strict validator as
 * the first analyse (`parsePhotoLogRangedResponse`) so the refine loop can never
 * introduce a shape the initial path would have rejected — negative kcal,
 * missing names, etc. are dropped identically.
 */
export function parsePhotoRefineResponse(
  raw: unknown,
  modelVersion: string,
): PhotoLogParseOutcome {
  return parsePhotoLogRangedResponse(raw, modelVersion);
}

/**
 * Validate the model's voice-refine reply into a clean food list. Mirrors the
 * route's original voice parse: coerce name/amount/unit to trimmed strings with
 * sane defaults, drop entries with no name. Returns `[]` when nothing usable —
 * the route maps that to a 422 so the user knows the correction wiped the list.
 */
export function parseVoiceRefineResponse(raw: unknown): RefineVoiceParsedFood[] {
  if (!raw || typeof raw !== "object") return [];
  const r = raw as Record<string, unknown>;
  const itemsRaw = Array.isArray(r.items) ? r.items : null;
  if (!itemsRaw) return [];
  const out: RefineVoiceParsedFood[] = [];
  for (const entry of itemsRaw) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as Record<string, unknown>;
    const name = typeof e.name === "string" ? e.name.trim() : "";
    if (!name) continue;
    const amount =
      typeof e.amount === "string" && e.amount.trim()
        ? e.amount.trim()
        : typeof e.amount === "number" && Number.isFinite(e.amount)
          ? String(e.amount)
          : "1";
    const unit = typeof e.unit === "string" && e.unit.trim() ? e.unit.trim() : "serving";
    out.push({ name, amount, unit });
  }
  return out;
}

/** Clamp + trim a raw refinement string for the model. Returns `null` when the
 *  text is empty after trimming (the route rejects with 400). */
export function normaliseRefinementText(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, REFINE_TEXT_MAX_CHARS);
}

/** Clamp a client-supplied round to `[1, REFINE_MAX_ROUNDS]`. */
export function clampRefineRound(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return 1;
  return Math.min(REFINE_MAX_ROUNDS, Math.max(1, Math.floor(n)));
}
