/**
 * Shared ingredient verification pipeline.
 * Tries: USDA → Open Food Facts → FatSecret → local estimation fallback.
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
import { hasFatSecretConfig, hasUsdaConfig } from "@/lib/server/serverEnv";
import { estimateLineMacros } from "@/lib/nutrition/estimateIngredientMacros";

export type VerifiedIngredient = {
  input: { name: string; amount: string; unit: string };
  resolved: { name: string; amount: string; unit: string };
  fatSecretFoodId: string | null;
  matchedName: string | null;
  confidence: number;
  source: "USDA" | "OFF" | "FatSecret" | "Estimated" | "Unverified";
  macros: VerifiedMacros | null;
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
};

export type IngredientOverride = {
  index: number;
  fdcId?: number;
  barcode?: string;
  description?: string;
};

/**
 * Minimum confidence for USDA / FatSecret name overlap before accepting a match.
 * Raised from 0.25 → 0.42 (nutrition-engine: reject weak overlaps).
 */
export const MIN_MATCH_CONFIDENCE = 0.42;

/** Minimum confidence for Open Food Facts (stricter — noisy product names). */
export const MIN_OFF_CONFIDENCE = 0.52;

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
  [/^tofu$/i, "tofu firm raw"],
  // Poultry cuts
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

function applyNameAliases(name: string): string {
  let result = name;
  for (const [pattern, replacement] of NAME_ALIASES) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

function normalizeQueryForUsda(name: string): string {
  // Extract ingredient hints from parenthetical notes like "(we used unsweetened almond milk)"
  // or "(such as cheddar)" — use the hint as the primary search term instead of discarding it
  let t = name;
  const parenHint = t.match(/\(\s*(?:we (?:used|like|prefer)|such as|e\.?g\.?|like|preferably|ideally)\s+(.+?)\s*\)/i);
  if (parenHint) {
    t = parenHint[1]!;
  } else {
    t = t.replace(/\([^)]*\)/g, " ");
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

/** Parse raw ingredient strings (e.g. "200g chicken breast") into structured input. */
export function parseRawIngredients(lines: string[]): { name: string; amount: string; unit: string }[] {
  return lines.map((line) => {
    const p = parseIngredientLine(line);
    return { name: p.name || line, amount: p.amount || "1", unit: p.unit || "" };
  });
}

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
  const fatsecretCfg = wantFatSecret && hasFatSecretConfig() ? fatSecretConfigFromEnv() : null;

  const CONCURRENCY = 4;

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
        if (scaledMacrosPlausible(barcodeMacros)) {
          return {
            input: raw, resolved,
            fatSecretFoodId: override.barcode,
            matchedName: override.description ?? off.product.name,
            confidence: 1,
            source: "OFF",
            macros: barcodeMacros,
          };
        }
      }
    }

    // 2. USDA override or search
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
          for (const { hit, conf } of ranked) {
            if (conf < MIN_MATCH_CONFIDENCE) break; // sorted desc — no better hits after this
            if (preparationStateMismatch(usdaQuery, hit.description)) continue;
            try {
              const food = await fdcFoodGet(usdaCfg, hit.fdcId);
              if (!food?.foodNutrients?.length) continue;
              const per100g = fdcFoodMacrosPer100g(food);

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
                  effectiveGrams = portionMatch.gramWeight * amt;
                }
              }

              const usdaMacros = scaleMacros(per100g, effectiveGrams / 100);
              if (!scaledMacrosPlausible(usdaMacros)) continue;

              return {
                input: raw, resolved,
                fatSecretFoodId: String(hit.fdcId),
                matchedName: hit.description,
                confidence: Math.min(0.95, conf + 0.1),
                source: "USDA",
                macros: usdaMacros,
              };
            } catch {
              continue;
            }
          }
        }
      } catch (e) {
        console.error("[verifyIngredients] USDA lookup failed for", query, ":", e instanceof Error ? e.message : e);
      }
    }

    // 3. Open Food Facts search (worldwide — good for UK/EU products and local names)
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
            const offMacros = scaleMacros(per100g, grams / 100);
            if (!scaledMacrosPlausible(offMacros)) continue;
            return {
              input: raw, resolved,
              fatSecretFoodId: hit.code,
              matchedName: label,
              confidence: Math.min(0.85, conf),
              source: "OFF",
              macros: offMacros,
            };
          }
        }
      } catch (e) {
        console.error("[verifyIngredients] OFF search failed for", query, ":", e instanceof Error ? e.message : e);
      }
    }

    // 4. FatSecret search
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
              if (scaledMacrosPlausible(fsMacros)) {
                return {
                  input: raw, resolved,
                  fatSecretFoodId: best.food_id,
                  matchedName: best.food_name,
                  confidence: conf,
                  source: "FatSecret",
                  macros: fsMacros,
                };
              }
            }
          }
        }
      } catch (e) {
        console.error("[verifyIngredients] FatSecret lookup failed for", query, ":", e instanceof Error ? e.message : e);
      }
    }

    // 4. Local estimation fallback
    const estimated = estimateLineMacros({
      name: resolved.name,
      amount: resolved.amount || "1",
      unit: resolved.unit || "",
    });
    return {
      input: raw, resolved,
      fatSecretFoodId: null,
      matchedName: resolved.name,
      confidence: 0.32,
      source: "Estimated",
      macros: {
        calories: estimated.calories,
        protein: estimated.protein,
        carbs: estimated.carbs,
        fat: estimated.fat,
        fiberG: estimated.fiberG,
        sugarG: estimated.sugarG,
        sodiumMg: estimated.sodiumMg,
      },
    };
  }

  // Run ingredient verification concurrently with bounded parallelism
  const verified: VerifiedIngredient[] = [];
  const indices = ingredients.map((_, i) => i);
  for (let i = 0; i < indices.length; i += CONCURRENCY) {
    const batch = indices.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(verifyOne));
    verified.push(...results);
  }

  // Totals
  const totals = verified.reduce(
    (acc, v) => {
      if (!v.macros) return acc;
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
  const primarySource = (["USDA", "OFF", "FatSecret", "Estimated"] as const)
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
