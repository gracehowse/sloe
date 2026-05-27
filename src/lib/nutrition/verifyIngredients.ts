/**
 * Shared ingredient verification pipeline.
 * Tries: USDA → Open Food Facts → Edamam → FatSecret → local estimation fallback.
 * Used by both /api/nutrition/verify-recipe and /api/recipe-import.
 */

import { fatSecretConfigFromEnv, fatSecretFoodGet, fatSecretFoodSearch } from "@/lib/fatsecret/client";
import { parseIngredientLine } from "@/lib/recipe-ingredients/parseIngredientLine";
import { measureToGrams } from "@/lib/nutrition/measureToGrams";
import {
  normalizeServingToMacros,
  pickBestServing,
  servingMassGrams,
  type VerifiedMacros,
} from "@/lib/nutrition/fatsecretNormalize";
import { fdcConfigFromEnv, fdcFoodGet, fdcFoodsSearch } from "@/lib/usda/fdcClient";
import { fdcFoodMacrosPer100g } from "@/lib/nutrition/usdaNormalize";
import { fetchProductByBarcode } from "@/lib/openFoodFacts/fetchProductByBarcode";
import { searchOffProducts } from "@/lib/openFoodFacts/searchProducts";
import { edamamConfigFromEnv, edamamFoodSearch, edamamFoodMacrosPer100g } from "@/lib/edamam/client";
import { hasFatSecretConfig, hasEdamamConfig, hasUsdaConfig, hasSupabaseServiceConfig } from "@/lib/server/serverEnv";
import { estimateLineMacros } from "@/lib/nutrition/estimateIngredientMacros";
import { searchUserFoods } from "@/lib/nutrition/userFoodsLookup";
import { checkScaledLogPlausibility } from "@/lib/nutrition/macroPlausibility";

export type VerifiedIngredient = {
  input: { name: string; amount: string; unit: string };
  resolved: { name: string; amount: string; unit: string };
  fatSecretFoodId: string | null;
  matchedName: string | null;
  confidence: number;
  source: "Suppr" | "USDA" | "Edamam" | "OFF" | "FatSecret" | "Estimated" | "Unverified";
  macros: VerifiedMacros | null;
  /**
   * ENG-691 (Decision D-05, 2026-05-25): true when this row's confidence is
   * below {@link MIN_ACCEPT_CONFIDENCE} (0.70). Its `macros` (if any) are kept
   * on the row so the UI can show the best estimate behind an "ask to verify"
   * affordance, but the row is EXCLUDED from `totals`/`perServing` — we never
   * silently sum a sub-threshold guess into the recipe's headline numbers.
   */
  belowAcceptFloor?: boolean;
};

export type VerifyResult = {
  verified: VerifiedIngredient[];
  totals: VerifiedMacros;
  perServing: VerifiedMacros;
  primarySource: string;
  sourceCounts: Record<string, number>;
  /** Minimum per-line confidence among ingredients with macros (honest recipe-level bar). */
  minIngredientConfidence: number;
  /** Mean per-line confidence among ingredients with macros. */
  avgIngredientConfidence: number;
  /**
   * ENG-691: count of lines whose confidence fell below
   * {@link MIN_ACCEPT_CONFIDENCE} and were therefore excluded from `totals`.
   * When > 0 the recipe's headline numbers are incomplete by design — callers
   * should surface an "ask to verify" prompt (see `ingredientVerifyNeedsReview`).
   */
  belowAcceptFloorCount: number;
};

export type IngredientOverride = {
  index: number;
  fdcId?: number;
  barcode?: string;
  description?: string;
};

/**
 * Single tunable accept floor for ingredient matches (ENG-691, Decision D-05,
 * Grace 2026-05-25). The published confidence bands say **reject < 0.70**; the
 * engine previously accepted down to 0.42 (0.52 for OFF) with only a "needs
 * review" badge below. This constant is the one knob to turn if a
 * nutrition-engine impact review shows 0.70 over-rejects common foods.
 *
 * NOTE (nutrition-engine impact review REQUIRED before merge): raising the
 * floor means more verify prompts and risk of over-rejecting common foods that
 * legitimately score in the 0.42–0.70 band. The change is implemented behind
 * this single constant precisely so the floor can be re-tuned without touching
 * pipeline logic once that modeling lands.
 */
export const MIN_ACCEPT_CONFIDENCE = 0.7;

/**
 * Minimum confidence for USDA / FatSecret name overlap before accepting a match.
 * Raised 0.25 → 0.42 → 0.70 (ENG-691): aligns the accept gate with the
 * published "reject < 0.70" confidence band.
 */
export const MIN_MATCH_CONFIDENCE = MIN_ACCEPT_CONFIDENCE;

/**
 * Minimum confidence for Open Food Facts (stricter — noisy product names).
 * Held one notch above the general floor so OFF stays the strictest source.
 */
export const MIN_OFF_CONFIDENCE = 0.72;

/**
 * Recipe verify UI: lines below this show "needs review" until the user
 * confirms or picks a food.
 *
 * P1-8 (2026-04-25): canonical home is now
 * `verifyConfidencePolicy.ts`; re-exported here so existing consumers
 * don't need to switch imports. Same module also exports the
 * recipe-level mean + min nudge thresholds, all unified at 0.50.
 *
 * ENG-691 (2026-05-25): the *accept* floor ({@link MIN_ACCEPT_CONFIDENCE} =
 * 0.70) is now ABOVE this review badge (0.50). A matched row that clears the
 * accept floor but still wants a human glance does not exist by this gate
 * anymore — any auto-accepted row is ≥ 0.70 and so above the review badge.
 * Below-floor rows are flagged `belowAcceptFloor` and excluded from totals
 * rather than badged-and-summed.
 */
export { RECIPE_INGREDIENT_REVIEW_CONFIDENCE } from "./verifyConfidencePolicy";

const ATWATER_MIN_RATIO = 0.62;
const ATWATER_MAX_RATIO = 1.38;

/** Scaled macros pass 4/4/9 sanity check (wide slack for fiber rounding). */
export function scaledMacrosPlausible(macros: VerifiedMacros): boolean {
  const { calories, protein, carbs, fat } = macros;
  if (!Number.isFinite(calories) || calories < 0) return false;
  if (calories === 0 && protein === 0 && carbs === 0 && fat === 0) return true;
  const implied = 4 * protein + 4 * carbs + 9 * fat;
  if (implied <= 1) return calories < 80;
  const ratio = calories / implied;
  return ratio >= ATWATER_MIN_RATIO && ratio <= ATWATER_MAX_RATIO;
}

/**
 * Absolute per-100g plausibility check. Anything above pure fat (~900 kcal/100g)
 * or below zero is a data/parsing bug — reject outright.
 */
export function per100gPlausible(per100g: { calories: number }): boolean {
  const kcal = per100g.calories;
  if (!Number.isFinite(kcal)) return false;
  if (kcal < 0) return false;
  if (kcal > 900) return false;
  return true;
}

const QUERY_COOKED_METHOD =
  /\b(grilled|roasted|fried|baked|boiled|steamed|smoked|braised|barbecued|bbq|saut[ée]ed|saute|pan[- ]fried|deep[- ]fried|broiled)\b/i;
const QUERY_COOKED_GENERIC = /\bcooked\b/i;
const QUERY_RAW = /\b(raw|uncooked)\b/i;

function candidateLooksRawOnly(desc: string): boolean {
  const d = desc.toLowerCase();
  const hasRaw = /\braw\b|, raw\b|\(raw\)/i.test(d);
  const hasCookedState = /\b(cooked|roasted|grill|fried|baked|boiled|steamed|smoked|braised|heated)\b/i.test(d);
  return hasRaw && !hasCookedState;
}

function candidateLooksCookedOnly(desc: string): boolean {
  const d = desc.toLowerCase();
  if (/\braw\b|, raw\b|\(raw\)/i.test(d)) return false;
  return /\b(cooked|roasted|grill|fried|baked|boiled|steamed|smoked)\b/i.test(d);
}

/** True when ingredient text and FDC/OFF description disagree on raw vs cooked. */
export function preparationStateMismatch(queryNormalized: string, candidateDescription: string): boolean {
  const q = queryNormalized.toLowerCase();
  const wantsCooked = QUERY_COOKED_METHOD.test(q) || (QUERY_COOKED_GENERIC.test(q) && !QUERY_RAW.test(q));
  if (wantsCooked && candidateLooksRawOnly(candidateDescription)) return true;
  if (QUERY_RAW.test(q) && candidateLooksCookedOnly(candidateDescription)) return true;
  return false;
}

function resolveLine(i: { name: string; amount: string; unit: string }) {
  const trimmed = { name: i.name.trim(), amount: i.amount.trim(), unit: i.unit.trim() };
  if (!trimmed.amount) {
    const p = parseIngredientLine(trimmed.name);
    if (p.amount && p.name.trim()) {
      return { name: p.name.trim(), amount: p.amount, unit: p.unit || trimmed.unit };
    }
  }
  return trimmed;
}

/** Words to skip entirely in matching */
const MATCH_STOPWORDS = new Set(["with", "and", "or", "in", "of", "the", "a", "an", "ns", "nfs", "not", "further", "specified"]);

/** USDA descriptor words that are expected/neutral — don't penalise these as "extra" */
const NEUTRAL_DESCRIPTORS = new Set([
  "raw", "cooked", "fresh", "frozen", "canned", "tinned",
  "uncooked", "boiled", "roasted", "grilled", "steamed", "braised", "smoked", "sauteed",
  "peeled", "boneless", "skinless", "trimmed", "drained", "pitted",
  "plain", "whole", "enriched", "unenriched", "bleached", "unbleached",
  "includes", "skin", "meat", "only",
  "all", "purpose", "self", "rising",
  "large", "medium", "small",
  "grade",
  // USDA oil entries: "Oil, olive, salad or cooking"
  "salad", "cooking",
]);

/** Naive English stemming — strip trailing s/es/ies for matching "eggs" ↔ "egg", "onions" ↔ "onion" */
function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y"; // berries → berry
  if (word.endsWith("es") && word.length > 3) return word.slice(0, -2); // tomatoes → tomato
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1); // eggs → egg
  return word;
}

export function confidenceForMatch(query: string, candidateName: string): number {
  const q = query.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  const c = candidateName.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  if (!q || !c) return 0;
  if (q === c) return 1;

  const qTokens = q.split(" ").filter((t) => t.length > 1 && !MATCH_STOPWORDS.has(t));
  const cTokens = c.split(" ").filter((t) => t.length > 1 && !MATCH_STOPWORDS.has(t));
  const qSet = new Set(qTokens.map(stem));
  const cSet = new Set(cTokens.map(stem));

  // How many query words appear in the candidate? (using stemmed matching)
  let queryHits = 0;
  for (const t of qTokens) if (cSet.has(stem(t))) queryHits++;
  const recall = queryHits / Math.max(1, qTokens.length);

  // Count genuinely irrelevant extra words (not neutral USDA descriptors).
  // Dish/recipe words get extra penalty — "Bread, zucchini" is bread, not zucchini.
  const DISH_WORDS = new Set([
    // Dish types (the food IS the dish, not an ingredient)
    "bread", "cake", "pie", "soup", "stew", "salad", "sandwich", "casserole",
    "pizza", "taco", "burrito", "nachos", "wrap", "muffin", "pancake", "waffle",
    "cookie", "biscuit", "cracker", "cereal", "bar", "juice", "smoothie",
    "sauce", "dressing", "spread", "dip", "paste", "oil",
    "rings", "nuggets", "strips", "patty", "patties", "bites", "tots",
    "bagels", "bagel", "chips", "crisps", "crackers",
    "bits", "flakes", "powder", "extract", "concentrate",
    // Cooking methods that change the food fundamentally
    "fried", "breaded", "battered", "tempura", "pickled", "candied", "glazed",
    "baked", "dried", "dehydrated",
    // Modifiers that indicate a different product entirely
    "meatless", "substitute", "imitation", "analog", "alternative", "plant",
    "yolk", "whites",  // "egg yolk" ≠ "eggs"
    "dirty",  // "dirty rice" ≠ "rice"
    // Brand / restaurant indicators
    "restaurant", "fast", "foods", "border",
  ]);
  // Check for brand names in the original (un-lowercased) candidate
  const origTokens = candidateName.replace(/[^a-zA-Z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
  let hasBrand = false;
  for (const t of origTokens) {
    // ALL CAPS token of 3+ chars (e.g. "DENNY'S", "HORMEL", "KRAFT") = likely brand
    if (t.length >= 3 && t === t.toUpperCase() && /[A-Z]/.test(t)) {
      hasBrand = true;
      break;
    }
  }

  let extraPenaltyScore = hasBrand ? 0.5 : 0;
  for (const t of cTokens) {
    const st = stem(t);
    if (qSet.has(st) || NEUTRAL_DESCRIPTORS.has(t) || NEUTRAL_DESCRIPTORS.has(st)) continue;
    extraPenaltyScore += DISH_WORDS.has(t) || DISH_WORDS.has(st) ? 0.5 : 0.25;
  }
  const extraPenalty = Math.max(0, 1 - extraPenaltyScore);

  // Precision bonus: for short queries (1-2 words), strongly prefer candidates
  // that ARE the food, not ones that contain it as a sub-ingredient.
  // "Eggs, whole, raw" should beat "Bagels, egg" for query "eggs".
  const significantCandidateTokens = cTokens.filter((t) => !NEUTRAL_DESCRIPTORS.has(stem(t)) && !NEUTRAL_DESCRIPTORS.has(t) && !MATCH_STOPWORDS.has(t));
  const sigStemSet = new Set(significantCandidateTokens.map(stem));
  const precision = significantCandidateTokens.length > 0
    ? qTokens.filter((t) => sigStemSet.has(stem(t))).length / significantCandidateTokens.length
    : 0;

  // Bonus: if the candidate's first significant token matches a query token,
  // the candidate IS the food, not something that merely contains it as sub-ingredient.
  // "Chicken, breast, meat" starts with "chicken" → good match for "chicken breast".
  // "Bread, zucchini" starts with "bread" → bad match for "zucchini".
  const firstSigCandidate = significantCandidateTokens.length > 0 ? stem(significantCandidateTokens[0]) : "";
  const firstWordBonus = firstSigCandidate && qSet.has(firstSigCandidate) ? 0.1 : -0.05;

  // Blend recall (does candidate contain what we searched?) with precision (is candidate ABOUT what we searched?)
  const blended = recall * 0.5 + precision * 0.5;

  return Math.min(0.95, Math.max(0, blended * extraPenalty + firstWordBonus));
}

/** Common UK/AU/regional ingredient names → USDA equivalents */
const NAME_ALIASES: [RegExp, string][] = [
  // Vegetables
  [/\bbutter\s*beans?\b/i, "lima beans"],
  [/\bcourgettes?\b/i, "zucchini"],
  [/\baubergines?\b/i, "eggplant"],
  [/\bspring onions?\b/i, "green onion"],
  [/\brocket\b/i, "arugula"],
  [/\bswedes?\b/i, "rutabaga"],
  [/\bmangetout\b/i, "snow peas"],
  [/\bbeetroot\b/i, "beet"],
  [/\bpepper\b(?!corn)/i, "bell pepper"],
  [/\bchickpeas?\b/i, "garbanzo beans"],
  [/\bbroad beans?\b/i, "fava beans"],
  [/\brunner beans?\b/i, "green beans"],
  [/\bsweet ?corn\b/i, "corn"],
  // Herbs / spices
  [/\bcoriander\b(?!\s+seed)/i, "cilantro"],
  [/\bchilli\b/i, "chili pepper"],
  // Meat / fish
  [/\bchicken breast\b/i, "chicken breast meat skinless"],
  [/\bprawns?\b/i, "shrimp"],
  [/\bking prawns?\b/i, "shrimp large"],
  [/\bgammon\b/i, "ham steak"],
  [/\bparma ham\b/i, "prosciutto"],
  [/\bcured ham\b/i, "prosciutto"],
  [/\bmince(?:d)?\s*(?:beef|meat)\b/i, "ground beef"],
  [/\blamb mince\b/i, "ground lamb"],
  [/\bpork mince\b/i, "ground pork"],
  [/\bchicken mince\b/i, "ground chicken"],
  [/\bturkey mince\b/i, "ground turkey"],
  // Dairy / baking
  [/\bdouble cream\b/i, "heavy cream"],
  [/\bsingle cream\b/i, "light cream"],
  [/\bclotted cream\b/i, "cream"],
  [/\bnatural yoghurt\b/i, "plain yogurt"],
  [/\byoghurt\b/i, "yogurt"],
  [/\bplain flour\b/i, "all purpose flour"],
  [/\bself[- ]raising flour\b/i, "self rising flour"],
  [/\bstrong flour\b/i, "bread flour"],
  [/\bwholemeal flour\b/i, "whole wheat flour"],
  [/\bwholemeal bread\b/i, "whole wheat bread"],
  [/\bwholemeal\b/i, "whole wheat"],
  [/\bbicarbonate of soda\b/i, "baking soda"],
  [/\bicing sugar\b/i, "powdered sugar"],
  [/\bcaster sugar\b/i, "granulated sugar"],
  [/\bdemerara sugar\b/i, "turbinado sugar"],
  [/\bmuscovado sugar\b/i, "brown sugar"],
  [/\bgolden syrup\b/i, "corn syrup"],
  [/\btreacle\b/i, "molasses"],
  [/\bcornflour\b/i, "cornstarch"],
  // Oils / condiments
  [/\brapeseed oil\b/i, "canola oil"],
  [/\bgroundnut oil\b/i, "peanut oil"],
  // AU / NZ
  [/\bcapsicum\b/i, "bell pepper"],
  [/\bsnow pea\b/i, "snow peas"],
  // Common single-word ingredients that match badly — make them more specific
  [/^eggs?$/i, "egg whole raw"],
  [/^bacon$/i, "bacon cured pork"],
  [/^rice$/i, "rice white long grain"],
  [/^chickpeas?$/i, "chickpeas garbanzo canned"],
  [/^pasta$/i, "pasta dry enriched"],
  [/^bread$/i, "bread white enriched"],
  [/^cheese$/i, "cheese cheddar"],
  [/^milk$/i, "milk whole"],
  [/^cream$/i, "cream heavy"],
  [/^flour$/i, "flour wheat all purpose"],
  [/^sugar$/i, "sugar white granulated"],
  [/^butter$/i, "butter salted"],
  [/^oats$/i, "oats rolled"],
  [/^honey$/i, "honey"],
  [/^salmon$/i, "salmon atlantic raw"],
  [/^tuna$/i, "tuna light canned"],
  // Silken tofu must come BEFORE the bare-tofu alias so it isn't
  // rewritten to firm (firm ≈ 145 kcal/100 g vs silken ≈ 55 kcal/100 g).
  [/\bsilken tofu\b/i, "tofu silken"],
  [/^(?!.*\bsilken\b)tofu$/i, "tofu firm raw"],
  // Poultry — cooked before raw (F-158 / ENG-564)
  [/\bchicken\b.*\bcooked\b/i, "chicken breast meat cooked roasted"],
  [/\bcooked\b.*\bchicken\b/i, "chicken breast meat cooked roasted"],
  [/^chicken breasts?$/i, "chicken breast meat raw"],
  [/^chicken thighs?$/i, "chicken thigh meat raw"],
  [/^chicken drumsticks?$/i, "chicken drumstick meat raw"],
  [/^chicken wings?$/i, "chicken wing meat raw"],
  [/^turkey breasts?$/i, "turkey breast meat raw"],
  // Red meat
  [/^beef steaks?$/i, "beef steak raw"],
  [/^pork chops?$/i, "pork chop raw"],
  [/^lamb chops?$/i, "lamb chop raw"],
  [/^lamb$/i, "lamb raw"],
  [/^pork$/i, "pork raw"],
  // Fish
  [/^cod$/i, "cod atlantic raw"],
  [/^prawns?$/i, "shrimp raw"],
  [/^haddock$/i, "haddock raw"],
  // Common multi-word ingredients
  [/\bsoy sauce\b/i, "soy sauce"],
  [/\bfish sauce\b/i, "fish sauce"],
  [/\bchicken stock\b/i, "chicken broth"],
  [/\bbeef stock\b/i, "beef broth"],
  [/\bvegetable stock\b/i, "vegetable broth"],
  [/\bstock cube\b/i, "bouillon cube"],
  [/\btomato passata\b/i, "tomato puree"],
  [/\bpassata\b/i, "tomato puree"],
  [/\btinned tomato(?:es)?\b/i, "tomatoes canned"],
  [/\bchopped tomato(?:es)?\b/i, "tomatoes canned diced"],
  [/\bcherry tomato(?:es)?\b/i, "tomatoes cherry raw"],
  [/\bbaby spinach\b/i, "spinach raw"],
  [/\bspring greens\b/i, "collard greens"],
  [/\bcreme fraiche\b/i, "sour cream"],
  [/\bmascarpone\b/i, "mascarpone cheese"],
  [/\bpancetta\b/i, "pancetta pork cured"],
];

export function applyNameAliases(name: string): string {
  let result = name;
  for (const [pattern, replacement] of NAME_ALIASES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

export function normalizeQueryForUsda(name: string): string {
  // Extract ingredient hints from parenthetical notes like "(we used unsweetened almond milk)"
  // or "(such as cheddar)" — use the hint as the primary search term instead of discarding it
  let t = name;
  const parenHint = t.match(/\(\s*(?:we (?:used|like|prefer)|such as|e\.?g\.?|like|preferably|ideally)\s+(.+?)\s*\)/i);
  if (parenHint) {
    t = parenHint[1]!;
  } else {
    t = t.replace(/\([^)]*\)/g, " ");
  }
  // Compound "X or Y" ingredient names (e.g. "blonde or white chocolate")
  // confuse the matcher — the disjunction pulls the top hit toward neither.
  // Keep the second branch, which is typically the more common/searchable
  // term ("white chocolate" > "blonde chocolate"). Only split when both
  // sides look like ingredient words, not when "or" is part of a descriptor.
  const orSplit = t.match(/^(.+?)\s+or\s+(.+)$/i);
  if (orSplit && orSplit[1]!.split(/\s+/).length <= 3 && orSplit[2]!.split(/\s+/).length <= 4) {
    t = orSplit[2]!;
  }
  t = t
    .replace(/[,，].*$/g, " ")
    // Strip percentages like "0%", "2%" that confuse USDA search
    .replace(/\b\d+%\s*/g, " ")
    // Strip prep technique words but KEEP nutrition-critical state words
    // (cooked, raw, dried, frozen, canned, roasted, smoked, etc.)
    .replace(/\b(finely|roughly|freshly|thinly|lightly|well)\b/gi, " ")
    .replace(/\b(chopped|diced|minced|sliced|grated|peeled|crushed|trimmed|rinsed|drained|deseeded|deboned|pitted|shredded|shelled|julienned|cubed|halved|quartered|cut|torn|snipped|destemmed|washed|cleaned)\b/gi, " ")
    // Strip serving/recipe context words
    .replace(/\b(to serve|to taste|for garnish|for decoration|for frying|for greasing|optional|as needed|plus extra|or more)\b/gi, " ")
    // Strip quality/brand noise
    .replace(/\b(good quality|best quality|organic|free range|free-range|British|local|shop[- ]bought|store[- ]bought|homemade|home[- ]made)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (t.length > 120) t = t.slice(0, 120).trim();
  return t;
}

export { parseRawIngredients } from "../recipe-ingredients/parseRawIngredients";

/**
 * Verify a list of ingredients against USDA, FatSecret, and local estimation.
 * Returns per-ingredient macros (including micros: fiber, sugar, sodium) and totals.
 */
export async function verifyIngredients(opts: {
  ingredients: { name: string; amount: string; unit: string }[];
  servings: number;
  provider?: "auto" | "fatsecret" | "usda";
  overrides?: IngredientOverride[];
}): Promise<VerifyResult> {
  const { ingredients, servings, provider = "auto", overrides = [] } = opts;

  const wantUsda = provider === "usda" || provider === "auto";
  const wantFatSecret = provider === "fatsecret" || provider === "auto";

  const usdaCfg = wantUsda && hasUsdaConfig() ? fdcConfigFromEnv() : null;
  const edamamCfg = provider === "auto" && hasEdamamConfig() ? edamamConfigFromEnv() : null;
  const fatsecretCfg = wantFatSecret && hasFatSecretConfig() ? fatSecretConfigFromEnv() : null;

  // 2026-05-15: bumped from 4 → 8 for the recipe-import critical path
  // (TikTok recipe-import is the viral hook per growth strategy). A
  // 20-ingredient recipe shaves from ~5 batches × ~800ms = 4s down to
  // ~3 batches × ~800ms = 2.4s — directly affects share-loop conversion.
  //
  // Safety: per-user rate limits across USDA / FatSecret / OFF / Edamam
  // all have 60s+ token windows that 8 concurrent in-flight per user
  // can't blow through. Aggregate spike protection is a separate concern
  // handled at the route layer.
  //
  // Env-tunable for emergency rollback without a deploy. Set
  // `VERIFY_INGREDIENTS_CONCURRENCY=4` to revert.
  const CONCURRENCY = Math.max(
    1,
    Math.min(16, parseInt(process.env.VERIFY_INGREDIENTS_CONCURRENCY ?? "8", 10) || 8),
  );

  async function verifyOne(idx: number): Promise<VerifiedIngredient> {
    const raw = ingredients[idx]!;
    const resolved = resolveLine(raw);
    const query = resolved.name;

    if (!query) {
      return {
        input: raw, resolved,
        fatSecretFoodId: null, matchedName: null,
        confidence: 0, source: "Unverified", macros: null,
      };
    }

    const amt = Number.parseFloat(resolved.amount) || 1;
    const grams = measureToGrams({ name: resolved.name, amount: amt, unit: resolved.unit || "", gPerMl: 1 });

    // 1. Barcode override (Open Food Facts)
    const override = overrides.find((o) => o && o.index === idx);
    if (override?.barcode) {
      const off = await fetchProductByBarcode(override.barcode);
      if (off.ok) {
        let gramsToUse = grams;
        if ((resolved.unit === "" || resolved.unit === "count") && off.product.servingSizeG) {
          gramsToUse = off.product.servingSizeG * (Number.parseFloat(resolved.amount) || 1);
        }
        const factor = gramsToUse / 100;
        const barcodeMacros = scaleMacros(
          { ...off.product, sugarG: off.product.sugarG ?? 0, sodiumMg: off.product.sodiumMg ?? 0 },
          factor,
        );
        // P0 (2026-05-26) — post-scale physical-plausibility guard + OFF
        // basis cross-check. `off.product` is the per-100g panel
        // (reconcileOffPer100g already corrected its basis in
        // fetchProductByBarcode). Demote confidence when the basis was
        // corrected so a barcode override can't claim 100% on suspect math.
        if (
          scaledMacrosPlausible(barcodeMacros) &&
          checkScaledLogPlausibility(barcodeMacros, gramsToUse, off.product).ok
        ) {
          return {
            input: raw, resolved,
            fatSecretFoodId: override.barcode,
            matchedName: override.description ?? off.product.name,
            confidence: off.product.basisCorrected ? 0.6 : 1,
            source: "OFF",
            macros: barcodeMacros,
          };
        }
      }
    }

    // 2. Suppr custom food database (user-contributed, verified entries first)
    if (hasSupabaseServiceConfig()) {
      try {
        const userFoodHits = await searchUserFoods(query, { limit: 3 });
        for (const uf of userFoodHits) {
          const conf = confidenceForMatch(query, [uf.brand, uf.name].filter(Boolean).join(" "));
          if (conf < MIN_MATCH_CONFIDENCE) continue;
          // M15 — guard against divide-by-zero when a user_foods row has no
          // serving size recorded. Reconstructing per-100g is meaningless here.
          if (!uf.servingSizeG || uf.servingSizeG === 0) continue;
          const per100g = {
            calories: uf.calories / (uf.servingSizeG / 100),
            protein: uf.protein / (uf.servingSizeG / 100),
            carbs: uf.carbs / (uf.servingSizeG / 100),
            fat: uf.fat / (uf.servingSizeG / 100),
            fiberG: uf.fiberG / (uf.servingSizeG / 100),
            sugarG: uf.sugarG / (uf.servingSizeG / 100),
            sodiumMg: uf.sodiumMg / (uf.servingSizeG / 100),
          };
          if (!per100gPlausible(per100g)) continue;
          const supprMacros = scaleMacros(per100g, grams / 100);
          if (!scaledMacrosPlausible(supprMacros)) continue;
          // P0 (2026-05-26) — post-scale physical-plausibility guard. The
          // per-100g cross-check guards against a corrupt user_foods row
          // (e.g. per-serving values stored where per-100g is expected).
          if (!checkScaledLogPlausibility(supprMacros, grams, per100g).ok) continue;
          // Verified entries get higher confidence boost
          const confBoost = uf.verificationStatus === "verified" ? 0.08 : 0.03;
          return {
            input: raw, resolved,
            fatSecretFoodId: uf.id,
            matchedName: [uf.brand, uf.name].filter(Boolean).join(" · "),
            confidence: Math.min(0.98, conf + confBoost),
            source: "Suppr" as const,
            macros: supprMacros,
          };
        }
      } catch (e) {
        console.error("[verifyIngredients] Suppr DB lookup failed for", query, ":", e instanceof Error ? e.message : e);
      }
    }

    // 3. USDA override or search
    if (usdaCfg) {
      try {
        const usdaOverride = overrides.find((o) => o && o.index === idx && typeof o.fdcId === "number" && !o.barcode);
        if (usdaOverride) {
          const food = await fdcFoodGet(usdaCfg, usdaOverride.fdcId as number);
          if (food?.foodNutrients?.length) {
            const per100g = fdcFoodMacrosPer100g(food);
            return {
              input: raw, resolved,
              fatSecretFoodId: String(usdaOverride.fdcId),
              matchedName: usdaOverride.description ?? food.description,
              confidence: 1,
              source: "USDA",
              macros: scaleMacros(per100g, grams / 100),
            };
          }
        }

        {
          let searchName = applyNameAliases(query);
          // Add context from the unit — "1 tin chickpeas" should search "chickpeas canned"
          const unitLower = resolved.unit.toLowerCase();
          if ((unitLower === "tin" || unitLower === "can") && !/canned|tinned/i.test(searchName)) {
            searchName += " canned";
          }
          const usdaQuery = normalizeQueryForUsda(searchName);
          // Search Foundation/SR Legacy/Survey first (generic whole foods + portion data),
          // then fall back to all data types (Branded) if no good match found.
          let hits = await fdcFoodsSearch(usdaCfg, usdaQuery, {
            dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
          });

          if (hits.length === 0) {
            hits = await fdcFoodsSearch(usdaCfg, usdaQuery);
          }

          // If top hits are low confidence, try a stripped-down core query
          // e.g. "free range chicken breast skinless" → "chicken breast"
          if (hits.length > 0) {
            const topConf = confidenceForMatch(usdaQuery, hits[0].description);
            if (topConf < MIN_MATCH_CONFIDENCE * 0.75) {
              const coreQuery = usdaQuery.replace(/\b(skinless|boneless|skin-on|bone-in|lean|extra lean|thick cut|thin cut)\b/gi, "").replace(/\s+/g, " ").trim();
              if (coreQuery !== usdaQuery && coreQuery.length >= 3) {
                const retryHits = await fdcFoodsSearch(usdaCfg, coreQuery, {
                  dataType: ["Foundation", "SR Legacy", "Survey (FNDDS)"],
                });
                if (retryHits.length > 0) {
                  const retryConf = confidenceForMatch(coreQuery, retryHits[0].description);
                  if (retryConf > topConf) {
                    hits = retryHits;
                  }
                }
              }
            }
          }

          // Rank by: (1) confidence of name overlap, (2) prefer Foundation > SR Legacy > Survey > Branded
          const dataTypeRank = (dt: string): number => {
            const d = (dt ?? "").toLowerCase();
            if (d.includes("foundation")) return 4;
            if (d.includes("sr legacy")) return 3;
            if (d.includes("survey")) return 2;
            return 1; // Branded
          };
          const ranked = hits
            .map((h) => ({
              hit: h,
              conf: confidenceForMatch(usdaQuery, h.description),
              dtRank: dataTypeRank(h.dataType ?? ""),
            }))
            .sort((a, b) => {
              // High confidence first; only use dataType as tiebreaker for very close scores
              const confDiff = b.conf - a.conf;
              if (Math.abs(confDiff) > 0.02) return confDiff;
              return b.dtRank - a.dtRank;
            })
            .slice(0, 5);
          // 2026-05-16 (ENG-560): fdcFoodGet for the top-2 ranked
          // candidates fires in parallel. Pre-fix the loop awaited
          // each fdcFoodGet sequentially — ~700-1500ms per call, and
          // on cases where the top candidate fails plausibility (poor
          // search match, unit-conversion miss) we paid the full
          // serial cost for candidates 2+. Parallelising the top 2
          // catches the most common "fall through to candidate 2"
          // path without inflating USDA quota use beyond ~1.5×.
          //
          // Candidates 3-5 stay serial (rare; covers the tail when
          // both top hits fail).
          //
          // Returns the *first* (highest-confidence) acceptable match
          // even if a lower-ranked one resolves first — preserves the
          // pre-fix ordering contract.
          const processHit = async (hit: typeof ranked[number]["hit"], conf: number): Promise<VerifiedIngredient | null> => {
            if (preparationStateMismatch(usdaQuery, hit.description)) return null;
            try {
              const food = await fdcFoodGet(usdaCfg, hit.fdcId);
              if (!food?.foodNutrients?.length) return null;
              const per100g = fdcFoodMacrosPer100g(food);
              if (!per100gPlausible(per100g)) return null;

              // Use food-specific portion weights when available.
              // E.g. "2 slices ham" — if this USDA food has a "slice" portion = 60g, use that
              // instead of our generic 25g default.
              let effectiveGrams = grams;
              const unit = resolved.unit.toLowerCase();
              if (food.foodPortions?.length && unit && unit !== "g" && unit !== "kg" && unit !== "ml" && unit !== "l" && unit !== "oz" && unit !== "lb") {
                const portionMatch = food.foodPortions.find((p) => {
                  const desc = ((p.portionDescription ?? "") + " " + (p.modifier ?? "") + " " + (p.measureUnit?.name ?? "")).toLowerCase();
                  return desc.includes(unit);
                });
                if (portionMatch?.gramWeight && portionMatch.gramWeight > 0) {
                  const portionGrams = portionMatch.gramWeight * amt;
                  const wantsCooked =
                    QUERY_COOKED_METHOD.test(usdaQuery) ||
                    (QUERY_COOKED_GENERIC.test(usdaQuery) && !QUERY_RAW.test(usdaQuery));
                  if (wantsCooked && candidateLooksRawOnly(hit.description)) {
                    effectiveGrams = measureToGrams({
                      name: resolved.name,
                      amount: amt,
                      unit: resolved.unit || "",
                    });
                  } else {
                    effectiveGrams = portionGrams;
                  }
                }
              }

              const usdaMacros = scaleMacros(per100g, effectiveGrams / 100);
              if (!scaledMacrosPlausible(usdaMacros)) return null;
              // P0 (2026-05-26) — post-scale physical-plausibility guard with
              // the per-100g panel cross-check.
              if (!checkScaledLogPlausibility(usdaMacros, effectiveGrams, per100g).ok) return null;

              return {
                input: raw, resolved,
                fatSecretFoodId: String(hit.fdcId),
                matchedName: hit.description,
                confidence: Math.min(0.98, conf + 0.03),
                source: "USDA",
                macros: usdaMacros,
              };
            } catch {
              return null;
            }
          };

          // Filter candidates that fail the early confidence gate (no
          // point paying the network round-trip on those). Pre-fix
          // used a `break` on `conf < MIN_MATCH_CONFIDENCE` — since
          // `ranked` is sorted desc, all remaining candidates after
          // the first sub-threshold one are also sub-threshold.
          const viable = ranked.filter((r) => r.conf >= MIN_MATCH_CONFIDENCE);
          if (viable.length > 0) {
            // Top-2 in parallel.
            const top = viable.slice(0, 2);
            const topResults = await Promise.all(top.map((r) => processHit(r.hit, r.conf)));
            for (const result of topResults) {
              if (result) return result;
            }
            // Tail (candidates 3-5) serial — rarely hit.
            for (const { hit, conf } of viable.slice(2)) {
              const result = await processHit(hit, conf);
              if (result) return result;
            }
          }
        }
      } catch (e) {
        console.error("[verifyIngredients] USDA lookup failed for", query, ":", e instanceof Error ? e.message : e);
      }
    }

    // 4. Edamam Food Database (branded + restaurant coverage — 900K foods)
    if (edamamCfg) {
      try {
        const edamamHits = await edamamFoodSearch(edamamCfg, query, { pageSize: 5 });
        const edamamPrepQuery = normalizeQueryForUsda(applyNameAliases(query));
        for (const hit of edamamHits) {
          const label = [hit.food.brand, hit.food.label].filter(Boolean).join(" · ");
          const conf = confidenceForMatch(query, label);
          if (conf < MIN_MATCH_CONFIDENCE) continue;
          if (preparationStateMismatch(edamamPrepQuery, label)) continue;
          const per100g = edamamFoodMacrosPer100g(hit.food);
          if (!per100gPlausible(per100g)) continue;
          const edamamMacros = scaleMacros(per100g, grams / 100);
          if (!scaledMacrosPlausible(edamamMacros)) continue;
          // P0 (2026-05-26) — post-scale physical-plausibility guard.
          if (!checkScaledLogPlausibility(edamamMacros, grams, per100g).ok) continue;
          return {
            input: raw, resolved,
            fatSecretFoodId: hit.food.foodId,
            matchedName: label,
            confidence: Math.min(0.92, conf),
            source: "Edamam" as const,
            macros: edamamMacros,
          };
        }
      } catch (e) {
        console.error("[verifyIngredients] Edamam lookup failed for", query, ":", e instanceof Error ? e.message : e);
      }
    }

    // 5. Open Food Facts search (worldwide — good for UK/EU products and local names)
    {
      try {
        const offHits = await searchOffProducts(query, { pageSize: 5 });
        if (offHits.length > 0) {
          const offPrepQuery = normalizeQueryForUsda(applyNameAliases(query));
          const scored = offHits
            .map((h) => ({ hit: h, conf: confidenceForMatch(query, [h.brand, h.name].filter(Boolean).join(" ")) }))
            .sort((a, b) => b.conf - a.conf);
          for (const { hit, conf } of scored) {
            if (conf < MIN_OFF_CONFIDENCE) break;
            const label = [hit.brand, hit.name].filter(Boolean).join(" · ");
            if (preparationStateMismatch(offPrepQuery, label)) continue;
            const per100g = {
              calories: hit.calories,
              protein: hit.protein,
              carbs: hit.carbs,
              fat: hit.fat,
              fiberG: hit.fiberG,
              sugarG: hit.sugarG,
              sodiumMg: hit.sodiumMg,
            };
            if (!per100gPlausible(per100g)) continue;
            const offMacros = scaleMacros(per100g, grams / 100);
            if (!scaledMacrosPlausible(offMacros)) continue;
            // P0 (2026-05-26) — post-scale plausibility + OFF basis cross-
            // check. Catches the "500 g Greek yogurt → 1,325 kcal / 265 g
            // protein" class where a per-serving-basis OFF row's `*_100g`
            // fields were really per-serving. The source-basis arm asserts
            // scaledKcal ≈ per100g.calories × grams/100 within 25%, the most
            // direct catch. reconcileOffPer100g (searchProducts) already
            // rebuilds the basis upstream; this is defence-in-depth at commit.
            if (!checkScaledLogPlausibility(offMacros, grams, per100g).ok) continue;
            // Demote confidence when the upstream reconcile corrected the
            // per-100g basis — the row is real but its label math was suspect.
            // A basis-corrected row stays below the accept floor on purpose:
            // ENG-691 then keeps it out of totals and flags it for human
            // verification. A clean OFF row that cleared the (stricter) OFF
            // gate must not be demoted below the accept floor by the -0.03
            // display nudge — clamp so an accepted clean match stays in totals.
            const offConf = hit._basisCorrected
              ? Math.min(0.6, conf - 0.1)
              : Math.max(MIN_ACCEPT_CONFIDENCE, Math.min(0.9, conf - 0.03));
            return {
              input: raw, resolved,
              fatSecretFoodId: hit.code,
              matchedName: label,
              confidence: offConf,
              source: "OFF",
              macros: offMacros,
            };
          }
        }
      } catch (e) {
        console.error("[verifyIngredients] OFF search failed for", query, ":", e instanceof Error ? e.message : e);
      }
    }

    // 6. FatSecret search
    if (fatsecretCfg) {
      try {
        const results = await fatSecretFoodSearch(fatsecretCfg, query);
        const best = results[0] ?? null;
        if (best) {
          const conf = confidenceForMatch(query, best.food_name);
          if (
            conf >= MIN_MATCH_CONFIDENCE &&
            !preparationStateMismatch(normalizeQueryForUsda(applyNameAliases(query)), best.food_name)
          ) {
            const food = await fatSecretFoodGet(fatsecretCfg, best.food_id);
            const servingNode = food?.servings?.serving;
            if (food && servingNode) {
              const serving = pickBestServing(servingNode);
              const perServing = normalizeServingToMacros(serving);
              // Polish (2026-04-25) — FatSecret occasionally exposes
              // placeholder rows with calories=0 and all macros=0 (e.g. a
              // brand-stub for "olive oil" that has not been populated).
              // scaledMacrosPlausible() lets the all-zero scaled result
              // through (the rule is intentional for tiny rounded-down
              // portions), so the fix is upstream: skip the candidate
              // entirely when the SOURCE serving has no macros at all.
              // This forced the "olive oil at 98% confidence → 0 kcal"
              // bug. Falls through to next source / local estimator.
              const sourceIsAllZero =
                (!Number.isFinite(perServing.calories) || perServing.calories <= 0) &&
                (!Number.isFinite(perServing.protein) || perServing.protein <= 0) &&
                (!Number.isFinite(perServing.carbs) || perServing.carbs <= 0) &&
                (!Number.isFinite(perServing.fat) || perServing.fat <= 0);
              if (sourceIsAllZero) {
                console.warn(
                  `[verifyIngredients] FatSecret returned a zero-macro serving for "${query}" → ${best.food_name} (food_id=${best.food_id}). Skipping candidate; falling through to next source.`,
                );
                // fall through past the FatSecret block to USDA-other / OFF / estimator
              } else {
              const servingG = servingMassGrams(serving) ?? 100;
              const perGram = {
                calories: perServing.calories / servingG,
                protein: perServing.protein / servingG,
                carbs: perServing.carbs / servingG,
                fat: perServing.fat / servingG,
                fiberG: perServing.fiberG / servingG,
                sugarG: perServing.sugarG / servingG,
                sodiumMg: perServing.sodiumMg / servingG,
              };
              const fsMacros: VerifiedMacros = {
                calories: Math.max(0, Math.round(perGram.calories * grams)),
                protein: Math.max(0, Math.round(perGram.protein * grams * 10) / 10),
                carbs: Math.max(0, Math.round(perGram.carbs * grams * 10) / 10),
                fat: Math.max(0, Math.round(perGram.fat * grams * 10) / 10),
                fiberG: Math.max(0, Math.round(perGram.fiberG * grams * 10) / 10),
                sugarG: Math.max(0, Math.round(perGram.sugarG * grams * 10) / 10),
                sodiumMg: Math.max(0, Math.round(perGram.sodiumMg * grams)),
              };
              // P0 (2026-05-26) — post-scale physical-plausibility guard with
              // the reconstructed per-100g panel (perGram × 100) cross-check.
              const fsPer100g = {
                calories: perGram.calories * 100,
                protein: perGram.protein * 100,
                carbs: perGram.carbs * 100,
                fat: perGram.fat * 100,
              };
              if (
                scaledMacrosPlausible(fsMacros) &&
                checkScaledLogPlausibility(fsMacros, grams, fsPer100g).ok
              ) {
                return {
                  input: raw, resolved,
                  fatSecretFoodId: best.food_id,
                  matchedName: best.food_name,
                  confidence: conf,
                  source: "FatSecret",
                  macros: fsMacros,
                };
              }
              } // closes else { (sourceIsAllZero guard, 2026-04-25)
            }
          }
        }
      } catch (e) {
        console.error("[verifyIngredients] FatSecret lookup failed for", query, ":", e instanceof Error ? e.message : e);
      }
    }

    // 7. Local estimation fallback
    const estimated = estimateLineMacros({
      name: resolved.name,
      amount: resolved.amount || "1",
      unit: resolved.unit || "",
    });
    // If the estimator couldn't even resolve a weight or parse an amount,
    // surface the line as Unverified with no macros rather than a zero-filled
    // "Estimated" row — honest failure beats false precision.
    if (estimated.amountUnparseable || estimated.noReliableMatch) {
      return {
        input: raw, resolved,
        fatSecretFoodId: null,
        matchedName: null,
        confidence: 0,
        source: "Unverified",
        macros: null,
      };
    }
    const estConfidence =
      typeof estimated.confidence === "number"
        ? estimated.confidence
        : estimated.isDefaultFallback
          ? 0.15
          : 0.35;
    return {
      input: raw, resolved,
      fatSecretFoodId: null,
      matchedName: resolved.name,
      confidence: estConfidence,
      source: "Estimated",
      macros: {
        calories: estimated.calories,
        protein: estimated.protein,
        carbs: estimated.carbs,
        fat: estimated.fat,
        fiberG: estimated.fiberG,
        // Unknown micros are returned as null from the estimator (M14). For
        // the VerifiedMacros contract (numbers), fall back to 0 while callers
        // migrate; UI can already use the `estimated.densityDefaulted` etc.
        // flags from the local path if needed.
        sugarG: estimated.sugarG ?? 0,
        sodiumMg: estimated.sodiumMg ?? 0,
      },
    };
  }

  // Run ingredient verification concurrently with bounded parallelism
  const rawVerified: VerifiedIngredient[] = [];
  const indices = ingredients.map((_, i) => i);
  for (let i = 0; i < indices.length; i += CONCURRENCY) {
    const batch = indices.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(verifyOne));
    rawVerified.push(...results);
  }

  // ENG-691 (Decision D-05): flag every row whose confidence is below the
  // accept floor. These keep their best-estimate macros on the row (so the UI
  // can show "estimated — please verify") but are EXCLUDED from `totals` /
  // `perServing`. A row with no macros at all (Unverified) is left unflagged —
  // it already contributes nothing and isn't an "ask to verify" estimate.
  const verified: VerifiedIngredient[] = rawVerified.map((v) =>
    v.macros != null && v.confidence < MIN_ACCEPT_CONFIDENCE
      ? { ...v, belowAcceptFloor: true }
      : v,
  );
  const belowAcceptFloorCount = verified.filter((v) => v.belowAcceptFloor).length;

  // Totals — sum only rows at/above the accept floor. Sub-floor rows are
  // surfaced for verification, never silently summed into the headline.
  const totals = verified.reduce(
    (acc, v) => {
      if (!v.macros || v.belowAcceptFloor) return acc;
      acc.calories += v.macros.calories;
      acc.protein += v.macros.protein;
      acc.carbs += v.macros.carbs;
      acc.fat += v.macros.fat;
      acc.fiberG += v.macros.fiberG;
      acc.sugarG += v.macros.sugarG;
      acc.sodiumMg += v.macros.sodiumMg;
      return acc;
    },
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiberG: 0, sugarG: 0, sodiumMg: 0 },
  );

  const sourceCounts = verified.reduce(
    (acc, v) => {
      acc[v.source] = (acc[v.source] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Pick the source that verified the most ingredients
  const primarySource = (["Suppr", "USDA", "Edamam", "OFF", "FatSecret", "Estimated"] as const)
    .filter((s) => (sourceCounts[s] ?? 0) > 0)
    .sort((a, b) => (sourceCounts[b] ?? 0) - (sourceCounts[a] ?? 0))[0]
    ?? "Unverified";

  const perServing: VerifiedMacros = {
    calories: Math.max(0, Math.round(totals.calories / servings)),
    protein: Math.max(0, Math.round((totals.protein / servings) * 10) / 10),
    carbs: Math.max(0, Math.round((totals.carbs / servings) * 10) / 10),
    fat: Math.max(0, Math.round((totals.fat / servings) * 10) / 10),
    fiberG: Math.max(0, Math.round((totals.fiberG / servings) * 10) / 10),
    sugarG: Math.max(0, Math.round((totals.sugarG / servings) * 10) / 10),
    sodiumMg: Math.max(0, Math.round(totals.sodiumMg / servings)),
  };

  const confidences = verified.filter((v) => v.macros != null).map((v) => v.confidence);
  const minIngredientConfidence = confidences.length > 0 ? Math.min(...confidences) : 0;
  const avgIngredientConfidence =
    confidences.length > 0 ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 0;

  return {
    verified,
    totals,
    perServing,
    primarySource,
    sourceCounts,
    minIngredientConfidence,
    avgIngredientConfidence,
    belowAcceptFloorCount,
  };
}

function scaleMacros(
  per100g: { calories: number; protein: number; carbs: number; fat: number; fiberG: number; sugarG: number; sodiumMg: number },
  factor: number,
): VerifiedMacros {
  return {
    calories: Math.max(0, Math.round(per100g.calories * factor)),
    protein: Math.max(0, Math.round(per100g.protein * factor * 10) / 10),
    carbs: Math.max(0, Math.round(per100g.carbs * factor * 10) / 10),
    fat: Math.max(0, Math.round(per100g.fat * factor * 10) / 10),
    fiberG: Math.max(0, Math.round(per100g.fiberG * factor * 10) / 10),
    sugarG: Math.max(0, Math.round((per100g.sugarG ?? 0) * factor * 10) / 10),
    sodiumMg: Math.max(0, Math.round((per100g.sodiumMg ?? 0) * factor)),
  };
}
