/**
 * LLM dish-appearance describer — server-only.
 *
 * Part of the Sloe image system (2026-06-08,
 * `docs/decisions/2026-06-08-recipe-ingredient-image-system.md`).
 *
 * ── Why this exists (the bug it fixes) ────────────────────────────────
 * The first Template-A hero prompt listed the recipe's raw ingredients
 * ("…a finished plated dish featuring eggs, protein powder, spinach…").
 * FLUX-2-pro follows the positive prompt literally, so it rendered those
 * ingredients in their RAW form sitting ON TOP of the dish — whole raw
 * eggs perched on a frittata, a heap of loose protein powder on porridge.
 * The ingredient list told the model WHAT, never the cooked STATE.
 *
 * The cure (proven via fal on 2026-06-08): describe the FINISHED, COOKED,
 * plated dish — eggs SET in the frittata, powder DISSOLVED into the oats,
 * batter BAKED — naming only what is actually VISIBLE when it is served,
 * never implying raw ingredients sit on the surface. This module asks the
 * shared server LLM for that one-to-two-sentence description, which then
 * replaces the raw "featuring {ingredients}" clause in `buildDishPrompt`.
 *
 * ── Fail-safe (load-bearing) ──────────────────────────────────────────
 * Image generation must NEVER block on this call. If the LLM is
 * unconfigured, times out, rate-limits, or returns junk, we fall back to
 * `FALLBACK_DISH_APPEARANCE` — a generic "fully cooked and plated as
 * served" clause that still steers FLUX toward a finished dish (and away
 * from raw piles) without naming a specific dish. The caller treats the
 * result as a plain string and always gets a usable clause.
 *
 * The output is also SANITISED before it ever reaches the FLUX prompt:
 * the model occasionally adds a lead-in ("Here is the description:"),
 * quotes, or newlines — any of those would pollute the positive prompt,
 * so we strip them and collapse whitespace.
 *
 * NEVER import this into a client bundle — it reads the AI provider keys
 * via `aiProvider`.
 */

import { callAiText } from "./aiProvider";

/**
 * Generic cooked-state clause used when the LLM is unavailable or its
 * output can't be trusted. Phrased to (a) assert the dish is finished and
 * plated, and (b) actively push FLUX away from the raw-pile failure mode.
 * Kept dish-agnostic so it's safe for ANY title.
 */
export const FALLBACK_DISH_APPEARANCE =
  "The dish is shown fully cooked and plated exactly as it would be served and eaten, " +
  "every component cooked through and integrated, with nothing raw or uncooked on the surface.";

/** Cap the description length so a runaway model reply can't bloat the
 *  FLUX prompt. Two sentences of plated-food prose fit comfortably. */
const MAX_DESCRIPTION_CHARS = 420;

/** Lower bound — anything shorter than this is treated as a non-answer
 *  (e.g. the model returned "." or a stray fragment) and we fall back. */
const MIN_DESCRIPTION_CHARS = 12;

const SYSTEM_PROMPT =
  "You are a food stylist writing a single visual caption for a photographer. " +
  "Given a recipe title and its key ingredients, describe how the FINISHED, fully cooked, " +
  "plated dish looks when it is served on the plate — ready to eat. " +
  "Emphasise the COOKED, integrated state of every component: eggs set firm in a frittata, " +
  "protein powder fully stirred and dissolved into oats, batter baked through, meat cooked, " +
  "vegetables softened and folded in. " +
  "Name only the ingredients that are actually VISIBLE in the finished dish — garnishes, " +
  "proteins, visible vegetables, sauces, toppings as they appear when served. " +
  "NEVER describe raw or uncooked ingredients, never whole raw eggs, never loose powder, " +
  "never anything raw or dry sitting on top of the dish. " +
  "Reply with ONE or TWO plain sentences of description only — no preamble, no list, no quotes, " +
  "no markdown, no mention of the photo or the camera.";

/** Strip model lead-ins, quotes, code fences, and collapse whitespace so
 *  the description drops cleanly into the FLUX positive prompt. */
export function sanitizeDishDescription(raw: string): string {
  let s = raw.trim();
  // Drop wrapping code fences / backticks the model sometimes adds.
  s = s.replace(/^```[a-z]*\s*/i, "").replace(/```$/i, "").trim();
  // Drop a single layer of wrapping quotes (straight or curly).
  s = s.replace(/^["'“”']+/, "").replace(/["'“”']+$/, "").trim();
  // Drop a common "Here is/Caption:" style lead-in up to the first colon
  // when it precedes real prose (don't eat colons mid-sentence).
  const leadIn = /^(here(?:'s| is)?[^:]{0,40}|caption|description|finished dish)\s*:\s*/i;
  s = s.replace(leadIn, "").trim();
  // Collapse all internal whitespace (incl. newlines) to single spaces.
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > MAX_DESCRIPTION_CHARS) {
    // Hard cap, then trim back to the last sentence end or word boundary
    // so we never cut mid-word.
    const cut = s.slice(0, MAX_DESCRIPTION_CHARS);
    const lastStop = Math.max(cut.lastIndexOf(". "), cut.lastIndexOf("! "));
    s = (lastStop > 60 ? cut.slice(0, lastStop + 1) : cut.replace(/\s+\S*$/, "")).trim();
  }
  return s;
}

/**
 * Ask the LLM for a one-to-two sentence description of how the finished,
 * cooked, plated dish looks when served. Never throws; on ANY failure
 * (unconfigured, timeout, rate-limit, empty/short reply) returns
 * `FALLBACK_DISH_APPEARANCE` so image generation is never blocked.
 *
 * @param title          the recipe title (lightly cleaned upstream)
 * @param keyIngredients up to ~6 visually-defining ingredients
 * @param opts.userId    optional Supabase user id, for AI attribution
 * @param opts.signal    optional AbortSignal for timeout control
 */
export async function describeDishAppearance(
  title: string,
  keyIngredients: string[] = [],
  opts: { userId?: string | null; signal?: AbortSignal } = {},
): Promise<string> {
  const cleanTitle = title.trim();
  if (!cleanTitle) return FALLBACK_DISH_APPEARANCE;

  const ings = keyIngredients
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6)
    .join(", ");

  const userText =
    `Recipe title: ${cleanTitle}\n` +
    `Key ingredients: ${ings || "(not provided)"}\n\n` +
    "Describe how the finished, fully cooked, plated dish looks when served.";

  let result;
  try {
    result = await callAiText({
      callSite: "describeDishAppearance",
      userId: opts.userId ?? null,
      systemPrompt: SYSTEM_PROMPT,
      userText,
      // Plain prose, not JSON.
      expectJson: false,
      // Low temp — we want a faithful, literal description, not a creative
      // riff that might re-introduce raw garnishes.
      temperature: 0.2,
      // Two sentences is tiny; keep the cap small + cheap.
      maxTokens: 160,
      signal: opts.signal,
      // Cheapest fast model on each vendor. aiProvider picks Claude when
      // ANTHROPIC_API_KEY is set, else OpenAI (gpt-4o-mini) — both are
      // fine for a short descriptive caption.
      claudeModel: "claude-3-5-haiku-20241022",
      openaiModel: "gpt-4o-mini",
    });
  } catch {
    // aiProvider can throw AiBudgetExceededError when enforcement is on
    // and a cap is hit — an image caption must never block on the budget.
    return FALLBACK_DISH_APPEARANCE;
  }

  if (!result.ok) return FALLBACK_DISH_APPEARANCE;

  const cleaned = sanitizeDishDescription(result.text);
  if (cleaned.length < MIN_DESCRIPTION_CHARS) return FALLBACK_DISH_APPEARANCE;
  return cleaned;
}
