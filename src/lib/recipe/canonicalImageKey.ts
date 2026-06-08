/**
 * `canonicalImageKey(input)` — the SINGLE SOURCE OF TRUTH for the
 * `ingredient_images` grouping key.
 *
 * ────────────────────────────────────────────────────────────────────
 * Why this exists. The first `ingredient_images` build keyed rows by
 * `normalizeIngredientNameKey` (shopping/plan's key), which does NOT strip
 * leading quantities — so "120 grams spinach" and "120g spinach" got two
 * competing tiles, and the same Greek yogurt under three brand prefixes got
 * three. Worse, any future write/read key drift = placeholders forever +
 * runaway regeneration. This module is imported IDENTICALLY by the backfill
 * writer (`scripts/backfill-images.ts`) and every display reader
 * (`ingredientImageTile.ts`, `ingredientImages.ts`, web + mobile via
 * `@suppr/shared`). A guard test asserts writer-key == reader-key across the
 * real corpus (`tests/unit/canonicalImageKey.test.ts`).
 *
 * Leaves `src/lib/planning/ingredientNameKey.ts` UNTOUCHED — shopping/plan
 * overlap still key by it; only the image system moves to this key.
 *
 * Pure + sync + dependency-light (no server-only imports, no `@/` aliases) so
 * it is safe in React render AND resolvable by Metro on mobile.
 * ────────────────────────────────────────────────────────────────────
 *
 * Hybrid key (per the 2026-06-08 spec, Q2 strip rules + Q3 granularity):
 *   - `base = deriveTextKey(name)` — ALWAYS the key. Guarantees every row
 *     gets one (the matched-food id is null across the whole seed corpus).
 *   - The matched-food identity (`source` + `fatsecret_food_id`, when
 *     `confidence ≥ 0.85`) is recorded as an OPTIONAL alias signal so a
 *     differently-spelled future ingredient that matched the SAME food can
 *     reuse the tile. v1 ships the text-only path (no alias storage yet —
 *     ENG-905); `matchedAliasKey()` is exported for that fast-follow. We
 *     NEVER key off a weak match (CLAUDE.md: reject low-confidence collapses).
 *
 * Granularity (image key only — raw/cooked do NOT split; a grain of rice
 * looks like rice either way):
 *   - DISTINCT: egg ≠ egg white ≠ egg yolk; cherry tomato ≠ tomato ≠ paste;
 *     each cheese; ground chicken ≠ chicken breast; oat/almond milk ≠ milk.
 *   - COLLAPSE: all salt (fine/sea/kosher/flaky → salt); olive-oil grades →
 *     olive oil; herb preps (thyme leaves → thyme); regional synonyms
 *     (courgette→zucchini, prawns→shrimp, coriander→cilantro, mince→ground).
 *   - Rule: share a tile only if a reasonable person wouldn't notice the
 *     photo is of the other one. When unsure, keep distinct.
 */

import {
  LEADING_QTY_RE,
  stripBrandPrefix,
  stripParentheticals,
} from "./cleanIngredientDisplayName";

export interface CanonicalImageKeyInput {
  /** Raw `recipe_ingredients.name` (always present). */
  name: string;
  /** `recipe_ingredients.source` (e.g. "fatsecret", "usda"). */
  matchedSource?: string | null;
  /** `recipe_ingredients.fatsecret_food_id` — holds the matched food id. */
  matchedFoodId?: string | null;
  /** `recipe_ingredients.confidence` (0–1). */
  confidence?: number | null;
}

/** Confidence at/above which a matched-food identity is trustworthy enough
 *  to alias a tile across differently-spelled names. Mirrors the
 *  reject-low-confidence rule — below this we use the text key only. */
export const MATCHED_ALIAS_MIN_CONFIDENCE = 0.85;

// ── strip-spine helpers (image-key-specific; reuse the display spine) ──

/** Section tags: "[Marinade]", "[Sauce]", "[Crumble]". */
function stripSectionTags(s: string): string {
  return s.replace(/\s*\[[^\]]*\]\s*/g, " ");
}

/**
 * Trailing measure/packaging noise the display label keeps but the key must
 * drop so "Chopped Tomatoes 400g tin" and "Chopped Tomatoes" group:
 * "15-oz can", "20-oz bag", "1kg", trailing "can|jar|tin|pack|box|bag|bottle".
 */
function stripTrailingMeasureNoise(s: string): string {
  let t = s;
  // "<n><unit> <container>" or "<n>-oz <container>" anywhere trailing.
  t = t.replace(
    /\b\d+(?:[.,]\d+)?\s*-?\s*(?:oz|g|kg|ml|l|lb|lbs)\b\s*(?:can|jar|tin|pack|packet|box|bag|bottle|carton|tub|pouch)?\.?\s*$/gi,
    " ",
  );
  // Bare trailing container word ("Garbanzo Beans can").
  t = t.replace(/\b(?:can|jar|tin|pack|packet|box|bag|bottle|carton|tub|pouch)s?\.?\s*$/gi, " ");
  return t;
}

/**
 * "X or Y" → take the ingredient-y branch (mirror `normalizeQueryForUsda`'s
 * `orSplit`). "raw or cooked shrimp" → "shrimp"; "honey or monkfruit" handled
 * by the parenthetical strip upstream when it's "(or monkfruit)".
 */
function resolveOrBranch(s: string): string {
  const m = s.match(/^(.+?)\s+or\s+(.+)$/i);
  if (m && m[1]!.split(/\s+/).length <= 3 && m[2]!.split(/\s+/).length <= 4) {
    return m[2]!;
  }
  return s;
}

/**
 * Leading NON-identity descriptors to strip (size / quality / freshness /
 * prep). KEEP identity modifiers (ground/smoked/shredded/whole/skinless/
 * boneless on meat/dairy; the colour/type of an onion/rice/sugar/cheese)
 * because those select a genuinely different tile. Applied token-by-token
 * from the FRONT only — never mid-name (so "red ONION" keeps "red").
 */
const LEADING_DESCRIPTORS = new Set([
  // size
  "small", "medium", "large", "extra", "jumbo", "baby", "mini", "big",
  // freshness / quality / sourcing
  "fresh", "freshly", "ripe", "organic", "natural", "free", "range",
  "good", "best", "quality", "premium", "pure", "whole-food",
  // cooked-state: raw/cooked do NOT split the IMAGE key (spec §2) — strip
  // them from the front so "raw shrimp" / "cooked shrimp" → "shrimp".
  "raw", "cooked",
  // prep adverbs/adjectives
  "finely", "roughly", "thinly", "lightly", "well", "chopped", "diced",
  "minced", "sliced", "grated", "peeled", "crushed", "trimmed", "rinsed",
  "drained", "deseeded", "pitted", "halved", "quartered", "cut", "torn",
  "toasted", "heaped", "level",
  // leftover leading measure words a quantity strip can miss (e.g. the
  // unit after a descriptor: "2 heaped tsp capers" → "capers").
  "tsp", "tbsp", "teaspoon", "tablespoon", "cup", "cups", "pinch", "dash",
  "handful", "knob", "clove", "cloves", "sprig", "sprigs", "stick", "sticks",
  // generic colour ONLY when it's clearly decorative (kept minimal — colour
  // is usually identity, so we do NOT strip red/green/yellow/white/brown).
]);

/**
 * Regional + identity-collapse synonyms for the IMAGE key. This is a
 * curated, display-grouping map — deliberately NOT the nutrition
 * `NAME_ALIASES` (which expands single words to USDA strings like
 * "egg"→"egg whole raw" and would BREAK grouping). Order matters: more
 * specific patterns first. All operate on the already-lowercased,
 * descriptor-stripped string.
 */
const IMAGE_KEY_ALIASES: ReadonlyArray<readonly [RegExp, string]> = [
  // ── egg granularity: whole egg → egg (same photo); egg white + egg yolk
  //     stay DISTINCT (spec §2). "whole egg(s)" / "free range egg" → "egg",
  //     but NEVER touch "egg white" / "egg yolk". ──
  [/^(?:whole\s+)?eggs?$/, "egg"],
  [/\begg whites?\b/, "egg white"],
  [/\begg yolks?\b/, "egg yolk"],
  // ── regional synonyms (reuse the verifyIngredients regional pairs) ──
  [/\bcourgettes?\b/, "zucchini"],
  [/\baubergines?\b/, "eggplant"],
  [/\bspring onions?\b/, "scallion"],
  [/\brocket\b/, "arugula"],
  [/\bmangetout\b/, "snow pea"],
  [/\bbeetroot\b/, "beet"],
  [/\bcoriander\b(?!\s+seed)/, "cilantro"],
  [/\bking prawns?\b/, "prawn"],
  [/\bprawns?\b/, "shrimp"],
  [/\bgammon\b/, "ham"],
  [/\bparma ham\b/, "prosciutto"],
  [/\bswedes?\b/, "rutabaga"],
  [/\bcapsicum\b/, "bell pepper"],
  [/\bpassata\b/, "tomato sauce"],
  [/\btomato passata\b/, "tomato sauce"],
  // ── "ground X breast" → "ground X" (the cut is invisible once minced) ──
  [/\bground chicken breast\b/, "ground chicken"],
  [/\bground turkey breast\b/, "ground turkey"],
  // ── salt: collapse ALL salt to one tile (looks identical) ──
  [/\b(?:fine|coarse|flaky|kosher|sea|table|rock|himalayan|pink)\s+(?:sea\s+)?salt\b/, "salt"],
  [/\bsea salt\b/, "salt"],
  // ── olive oil grades → one tile (extra-virgin / virgin / light / pure /
  //     refined / mild all look the same in the bottle) ──
  [/\b(?:extra[- ]?virgin|virgin|light|pure|refined|mild)\s+olive oil\b/, "olive oil"],
  // ── herb preps → the herb (leaves/sprigs/dried look ~same on white) ──
  [/\b(?:fresh\s+|dried\s+|dry\s+)?thyme(?:\s+leaves)?\b/, "thyme"],
  [/\b(?:fresh\s+|dried\s+|dry\s+)?oregano\b/, "oregano"],
  [/\b(?:fresh\s+|dried\s+|dry\s+)?rosemary\b/, "rosemary"],
  [/\b(?:fresh\s+|dried\s+|dry\s+)?basil\b/, "basil"],
  // ── yogurt: collapse fat-percentage + "strained/greek" brand noise to a
  //     single Greek-yogurt tile (the three Fage/Waitrose brand forms).
  //     Anchored ^…$ so the WHOLE string becomes "greek yogurt" — a span
  //     replace would leave a "total 0 " / "all natural " prefix and split. ──
  [/^.*\bgreek\b.*\byog(?:h)?urts?\b.*$/, "greek yogurt"],
  // plain (non-greek) yogurt: drop fat-percentage / strained noise.
  [/\b(?:nonfat|low[- ]?fat|fat[- ]?free|full[- ]?fat)\b/, " "],
  [/\b(?:strained|milkfat)\b/, " "],
];

/**
 * Singularise a word for grouping. English plural rules tuned so the
 * grouping key is stable:
 *   - "berries" → "berry"        (-ies → -y)
 *   - "tomatoes" → "tomato"      (-oes/-ches/-shes/-xes/-zes/-sses → drop -es)
 *   - "whites" → "white", "olives" → "olive"  (consonant+es: drop only -s)
 *   - "eggs" → "egg"             (-s, not -ss)
 * The naive `verifyIngredients.stem` mangled "whites"→"whit" and
 * "olives"→"oliv"; this fixes that for the key without changing that module.
 */
function stemWord(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y";
  // Genuine -es plurals end in a sibilant before "es" (boxes, dishes,
  // tomatoes, glasses). Strip the whole "es" only then.
  if (/(?:o|ch|sh|x|z|ss)es$/.test(word) && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

function applyImageKeyAliases(s: string): string {
  let out = s;
  for (const [pattern, replacement] of IMAGE_KEY_ALIASES) {
    out = out.replace(pattern, replacement);
  }
  return out.replace(/\s+/g, " ").trim();
}

/**
 * Meat-mince → "ground X" identity collapse. Runs BEFORE the leading-
 * descriptor strip — otherwise "minced beef" loses "minced" (a prep word for
 * "minced garlic") and the protein collapse can't fire. Only the named
 * proteins are treated as ground; "minced garlic/onion" still strips to the
 * vegetable as prep. The cut/grain is invisible once minced, so all forms of
 * the same protein share one tile.
 */
const MINCE_TO_GROUND: ReadonlyArray<readonly [RegExp, string]> = [
  [/\b(?:beef mince|minced beef|mince(?:d)? beef|ground beef)\b/, "ground beef"],
  [/\b(?:lamb mince|minced lamb|ground lamb)\b/, "ground lamb"],
  [/\b(?:pork mince|minced pork|ground pork)\b/, "ground pork"],
  [/\b(?:chicken mince|minced chicken|ground chicken)\b/, "ground chicken"],
  [/\b(?:turkey mince|minced turkey|ground turkey)\b/, "ground turkey"],
];

function applyMinceAliases(s: string): string {
  let out = s;
  for (const [pattern, replacement] of MINCE_TO_GROUND) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/**
 * The text spine of the canonical key. Mirrors the spec's `deriveTextKey`
 * pipeline 1→10, reusing `cleanIngredientDisplayName`'s strip helpers so the
 * brand/quantity/parenthetical spine never drifts from the display label.
 * Output: lowercase, singularised, collapsed.
 */
export function deriveTextKey(name: string | null | undefined): string {
  if (typeof name !== "string") return "";
  let s = name.trim();
  if (s === "") return "";

  // 1. section tags
  s = stripSectionTags(s);
  // 2. brand prefix (· | -)
  s = stripBrandPrefix(s);
  // 2b. leading numeric RANGE ("3-6 rice paper wrappers" → "rice paper…")
  s = s.replace(/^\s*\d+\s*[-–]\s*\d+\s*/, " ");
  // 3. leading quantity + unit (THIS fixes "4 whole eggs" / "120g spinach")
  s = s.replace(LEADING_QTY_RE, " ");
  // 4. trailing measure / packaging noise
  s = stripTrailingMeasureNoise(s);
  // 5. parentheticals (minced/drained/sliced/"or monkfruit"…)
  s = stripParentheticals(s);
  // (drop a trailing prep clause after a comma — "scallions, finely sliced")
  const commaIdx = s.indexOf(",");
  if (commaIdx > 0 && /[a-z]/i.test(s.slice(0, commaIdx))) {
    s = s.slice(0, commaIdx);
  }

  // lowercase before the word-level passes
  s = s.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();

  // 6. "X or Y" → ingredient-y branch
  s = resolveOrBranch(s);

  // 6b. meat-mince → ground X (BEFORE descriptor strip eats "minced")
  s = applyMinceAliases(s);

  // 7. strip leading non-identity descriptors (front-anchored only)
  let words = s.split(/\s+/).filter(Boolean);
  while (words.length > 1 && LEADING_DESCRIPTORS.has(words[0]!)) {
    words.shift();
  }
  s = words.join(" ");

  // 8. regional + identity-collapse synonyms
  s = applyImageKeyAliases(s);

  // 9. singularise per word
  words = s.split(/\s+/).filter(Boolean).map(stemWord);
  // 10. collapse + trim
  return words.join(" ").trim();
}

/**
 * Build the matched-food alias key — `source:food_id` — ONLY when the match
 * is trustworthy (`confidence ≥ MATCHED_ALIAS_MIN_CONFIDENCE` and both parts
 * present). Returns `null` otherwise. v1 has no alias storage (ENG-905); this
 * is exported for the fast-follow + so callers wire the inputs through now.
 */
export function matchedAliasKey(input: CanonicalImageKeyInput): string | null {
  const conf = typeof input.confidence === "number" ? input.confidence : null;
  const src = typeof input.matchedSource === "string" ? input.matchedSource.trim() : "";
  const id = typeof input.matchedFoodId === "string" ? input.matchedFoodId.trim() : "";
  if (!src || !id || conf == null || conf < MATCHED_ALIAS_MIN_CONFIDENCE) return null;
  return `${src.toLowerCase()}:${id}`;
}

/**
 * THE canonical image key. Always the text spine today (the matched-food
 * alias is recorded separately, not folded in, so a weak/absent match can
 * never corrupt the grouping). Falls back to a normalised raw form so a
 * row that strips to empty still gets a stable, non-empty key (never blank,
 * never collides with a real food).
 */
export function canonicalImageKey(input: CanonicalImageKeyInput | string): string {
  const name = typeof input === "string" ? input : input.name;
  const base = deriveTextKey(name);
  if (base) return base;
  // Everything stripped (e.g. raw was only a quantity). Fall back to a
  // minimal normalised form so the key is stable + non-empty.
  const fallback = (typeof name === "string" ? name : "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return fallback;
}
