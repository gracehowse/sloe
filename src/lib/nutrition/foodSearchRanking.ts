/**
 * Shared food-search ranking + honest-confidence helpers (ENG-706, ENG-807).
 *
 * Web `FoodSearchPanel` and mobile `verifyRecipe.mergeResults` both rank
 * multi-source hits and (ENG-807) derive a per-row confidence tier +
 * Best-matches / More-results split from the SAME math here, so the two
 * platforms can never drift. Keep this module dependency-free of any
 * server-only code (FatSecret / USDA clients live in `verifyIngredients.ts`)
 * so the mobile bundle can import it.
 *
 * ENG-807 strengthened the scorer:
 *   - stemming (eggs ↔ egg, tomatoes ↔ tomato, berries ↔ berry)
 *   - exact-name + prefix boost (the candidate IS the food, not a
 *     sub-ingredient)
 *   - precision penalty for long "containing" candidates ("Bread, zucchini"
 *     loses to "Zucchini, raw" for query "zucchini")
 *   - optional recently-logged boost (small, never overrides relevance)
 * and made confidence REAL: the tier is derived from BOTH provenance AND the
 * computed match score — never from source alone (see `searchRowConfidenceTier`).
 */

import {
  foodNameIncludesUkRetailer,
  queryLeadingUkRetailer,
} from "./foodSearchLocale";

export type FoodSearchTrustSource =
  | "USDA"
  | "OFF"
  | "Edamam"
  | "FatSecret"
  | "CUSTOM"
  | "GenericBeverage"
  | "GenericFood"
  | string;

// ── Pure matching core (ported from verifyIngredients.confidenceForMatch) ──
//
// `confidenceForMatch` lives in `verifyIngredients.ts`, which imports
// server-only clients — it cannot be pulled into this mobile-safe module.
// The scoring MACHINERY (stemming, stopwords, neutral descriptors, dish-word
// penalty, precision blend) is ported here so the search ranker and the
// ingredient verifier agree on what "a good name match" means.

const MATCH_STOPWORDS = new Set([
  "with", "and", "or", "in", "of", "the", "a", "an", "ns", "nfs", "not",
  "further", "specified",
]);

/**
 * USDA descriptor words that are expected/neutral — qualifiers on a food, not
 * "extra" noise that would mean a different food. USDA generic names are
 * verbose by design ("Lentils, mature seeds, cooked, boiled, without salt"),
 * so an honest scorer must treat these qualifiers as neutral or the canonical
 * verified row loses to a terse branded dish.
 */
const NEUTRAL_DESCRIPTORS = new Set([
  "raw", "cooked", "fresh", "frozen", "canned", "tinned",
  "uncooked", "boiled", "roasted", "grilled", "steamed", "braised", "smoked", "sauteed",
  "pan", // USDA "pan-fried" splits into pan + fried; "pan" alone is neutral
  "peeled", "boneless", "skinless", "trimmed", "drained", "pitted",
  "plain", "whole", "enriched", "unenriched", "bleached", "unbleached",
  "includes", "skin", "meat", "only",
  "all", "purpose", "self", "rising",
  "large", "medium", "small",
  "grade",
  "salad", "cooking",
  // Common USDA qualifier words — neutral, present on many authoritative
  // generic rows. These describe state / variety / serving, not a different
  // food. (Deliberately NOT including "fried"/"breaded"/"dried" etc. — those
  // stay in DISH_WORDS because they change the food, e.g. "fried chicken".)
  "mature", "seeds", "seed", "without", "added", "salt", "unsalted",
  "salted", "prepared", "regular", "long", "short", "grain", "style",
  "lean", "milkfat", "lowfat", "nonfat", "reduced",
  "variety", "varieties", "commercial", "vitamin", "wild", "farmed",
  "solids", "liquid", "ready", "eat", "shelf", "stable",
  "unsweetened", "sweetened",
  "quick", "instant", "fortified",
  // USDA poultry classification filler — describes the bird grade, not a
  // different food ("Chicken, broilers or fryers, breast, …").
  "broilers", "broiler", "fryers", "fryer", "roasters", "roaster",
  "atlantic", "pacific", "farmed",
]);

/**
 * Dish / processing / brand words that mean the candidate is a DIFFERENT
 * food, not the queried one ("Bread, zucchini" is bread; "egg yolk" ≠ "eggs").
 */
const DISH_WORDS = new Set([
  "bread", "cake", "pie", "soup", "stew", "salad", "sandwich", "casserole",
  "pizza", "taco", "burrito", "nachos", "wrap", "muffin", "pancake", "waffle",
  "cookie", "biscuit", "cracker", "cereal", "bar", "juice", "smoothie",
  "sauce", "dressing", "spread", "dip", "paste", "oil",
  "rings", "nuggets", "strips", "patty", "patties", "bites", "tots",
  "bagels", "bagel", "chips", "crisps", "crackers",
  "bits", "flakes", "powder", "extract", "concentrate",
  "fried", "breaded", "battered", "tempura", "pickled", "candied", "glazed",
  "baked", "dried", "dehydrated",
  "meatless", "substitute", "imitation", "analog", "alternative", "plant",
  "yolk", "whites",
  "dirty",
  "restaurant", "fast", "foods", "border",
  // Prepared-dish nouns that recur in branded / Edamam category-tag rows —
  // unambiguous "this is a finished dish, not the ingredient" signals.
  "burger", "cheeseburger", "curry", "bowl", "stir", "fry", "roll", "sushi",
  "toast", "latte", "shake", "milkshake", "fries", "lasagna", "pate",
  "cups", "cup", "syrup", "jerky", "cake", "loaf", "pita", "quesadilla",
]);

/**
 * Naive English stemming — strip trailing s/es/ies (eggs↔egg, berries↔berry,
 * tomatoes↔tomato). The "-es" rule only fires after a sibilant (s/x/z/ch/sh)
 * where English actually adds "-es" ("tomatoes", "boxes"); otherwise we strip
 * just the plural "-s" so "apples" → "apple" (not the broken "appl").
 */
function stem(word: string): string {
  if (word.length <= 3) return word;
  if (word.endsWith("ies") && word.length > 4) return word.slice(0, -3) + "y"; // berries → berry
  if (word.endsWith("es") && word.length > 3) {
    const beforeEs = word.slice(0, -2);
    // "-es" plural of a sibilant stem: tomatoes→tomato, boxes→box, dishes→dish.
    if (/(s|x|z|ch|sh|o)$/.test(beforeEs)) return beforeEs;
    // Otherwise it's an "-e" stem with a plural "-s": apples→apple, grapes→grape.
    return word.slice(0, -1);
  }
  if (word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1); // eggs → egg
  return word;
}

function normalize(s: string): string {
  // Strip diacritics first (Pâté → Pate, jalapeño → jalapeno) so accented
  // brand/dish words still match the dish-word list and query tokens.
  const deaccented = s.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return deaccented
    .toLowerCase()
    // Drop percentages + standalone numbers — they're nutrition-fact fragments
    // (USDA "85% lean meat / 15% fat", "3.25% milkfat"), never food-identity
    // words, and they wrongly inflate the extra-word penalty + precision divisor.
    .replace(/\b\d+(?:\.\d+)?%?\b/g, " ")
    .replace(/[^a-z0-9 ·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strong relevance score in [0, 1] for "how well does this candidate NAME
 * answer this query". Stemmed recall × precision, penalised for dish words
 * and brand noise, boosted when the candidate STARTS with the queried food.
 *
 * This is the ENG-807 strengthening of the old token-overlap `searchRelevance`
 * and shares its contract: 1 on exact normalized match, 0 on empty input.
 */
export function searchMatchScore(query: string, name: string): number {
  const q = normalize(query);
  // Drop an OFF-style brand prefix ("Lidl · Eggs" → "Eggs") for matching so a
  // brand name can't dilute precision; the brand is shown, not matched-against.
  const nameNoBrand = name.includes(" · ") ? name.split(" · ").slice(-1)[0]! : name;
  const c = normalize(nameNoBrand);
  if (!q || !c) return 0;
  if (q === c) return 1;

  const qTokens = q.split(" ").filter((t) => t.length > 1 && !MATCH_STOPWORDS.has(t));
  const cTokens = c.split(" ").filter((t) => t.length > 1 && !MATCH_STOPWORDS.has(t));
  if (qTokens.length === 0 || cTokens.length === 0) return 0;
  const qStemSet = new Set(qTokens.map(stem));
  const cStemSet = new Set(cTokens.map(stem));

  // Recall: how many query words appear in the candidate (stemmed)?
  let queryHits = 0;
  for (const t of qTokens) if (cStemSet.has(stem(t))) queryHits++;
  const recall = queryHits / qTokens.length;

  // Extra-word penalty: count genuinely irrelevant candidate words. Dish /
  // brand words bite harder ("Bread, zucchini" is not zucchini).
  const origTokens = name.replace(/[^a-zA-Z0-9' ]/g, " ").split(/\s+/).filter(Boolean);
  let hasBrand = false;
  for (const t of origTokens) {
    if (t.length >= 3 && t === t.toUpperCase() && /[A-Z]/.test(t)) { hasBrand = true; break; }
  }
  let extraPenaltyScore = hasBrand ? 0.5 : 0;
  for (const t of cTokens) {
    const st = stem(t);
    if (qStemSet.has(st) || NEUTRAL_DESCRIPTORS.has(t) || NEUTRAL_DESCRIPTORS.has(st)) continue;
    // Dish/processing words bite hard (the food IS a different dish). Plain
    // unrecognised descriptors bite gently — USDA generic rows are verbose by
    // design ("Oats, whole grain, rolled, old fashioned"), and a stack of
    // legitimate qualifiers must not annihilate a full-recall verified match.
    extraPenaltyScore += DISH_WORDS.has(t) || DISH_WORDS.has(st) ? 0.5 : 0.15;
  }
  // Floor the penalty factor so a single dish/processing word can't annihilate
  // a row that otherwise has full recall. Genuinely off-topic rows are already
  // caught by low recall + precision + the lead-segment penalty.
  const extraPenalty = Math.max(0.3, 1 - extraPenaltyScore);

  // Precision: of the candidate's SIGNIFICANT (non-descriptor) tokens, how
  // many are query words? A long candidate that merely CONTAINS the food as a
  // sub-ingredient scores low precision → demoted for short queries.
  const significantCandidateTokens = cTokens.filter(
    (t) => !NEUTRAL_DESCRIPTORS.has(stem(t)) && !NEUTRAL_DESCRIPTORS.has(t) && !MATCH_STOPWORDS.has(t),
  );
  const sigStemSet = new Set(significantCandidateTokens.map(stem));
  const precision = significantCandidateTokens.length > 0
    ? qTokens.filter((t) => sigStemSet.has(stem(t))).length / significantCandidateTokens.length
    : 0;

  // Lead-segment boost: USDA generic names follow a "Category, specifier,
  // qualifier…" shape ("Pork, cured, bacon, …" / "Fish, salmon, …" /
  // "Beef, ground, …"). The food the user means is in the lead — the category
  // plus its head specifiers — not buried as a sub-ingredient. We look at the
  // first TWO comma segments because USDA prefixes a broad category ("Fish,
  // salmon"; "Beef, ground"). "Bread, zucchini" (query "zucchini") has the
  // food only in segment 2, so it earns the boost too — but it's already
  // demoted hard by the dish-word "bread" penalty, which dominates. The signal
  // we want is "the queried food is structurally a HEAD term, not a trailing
  // sub-ingredient buried in segment 3+".
  const leadSegments = normalize(nameNoBrand.split(",").slice(0, 2).join(" "));
  const leadStems = new Set(
    leadSegments.split(" ").filter((t) => t.length > 1 && !MATCH_STOPWORDS.has(t)).map(stem),
  );
  // Strong boost when EVERY query token appears in the lead (the candidate is
  // squarely about the queried food); weak boost when only some do; small
  // penalty when the food is entirely trailing.
  const queryTokensInLead = qTokens.filter((t) => leadStems.has(stem(t))).length;
  const firstWordBonus =
    queryTokensInLead === qTokens.length ? 0.12 : queryTokensInLead > 0 ? 0.05 : -0.05;

  // Prefix boost: candidate's whole-string normalized form begins with the
  // full query ("greek yogurt" → "Greek Yogurt, Plain, Nonfat").
  const prefixBonus = c.startsWith(q) ? 0.08 : 0;

  // Recall (did the candidate contain what we searched?) is weighted well above
  // precision (is the candidate terse about it?) because authoritative verified
  // rows are verbose by design — a high-recall verified generic must not lose
  // to a terse branded dish that merely name-checks the food. Precision still
  // matters for sub-ingredient discrimination but is the lighter term.
  const blended = recall * 0.72 + precision * 0.28;
  return Math.min(1, Math.max(0, blended * extraPenalty + firstWordBonus + prefixBonus));
}

/**
 * Word-overlap relevance in [0, 1], with a brevity tie-break.
 *
 * Retained for back-compat (existing web custom-food sort imports it) but now
 * delegates to {@link searchMatchScore} so every consumer shares one scorer.
 */
export function searchRelevance(query: string, name: string): number {
  return searchMatchScore(query, name);
}

/**
 * Source trust delta added to the relevance score before sorting.
 * Verified USDA wins on tie; generic OFF rows demote hardest.
 */
export function foodSearchTrustWeight(input: {
  source: FoodSearchTrustSource;
  verified?: boolean;
  /** Display name — OFF brand detection uses the · separator. */
  name: string;
}): number {
  if (input.source === "USDA" && input.verified) return 0.10;
  if (input.source === "USDA") return -0.15;
  if (input.source === "Edamam") return -0.05;
  if (input.source === "FatSecret") return -0.05;
  if (input.source === "OFF") {
    const hasBrand = /·/.test(input.name);
    return hasBrand ? -0.10 : -0.20;
  }
  return 0;
}

/**
 * Small additive boost for foods the user logged recently. Capped low so it
 * can break a near-tie but never float an irrelevant row above a real match
 * (the lane: relevance leads, recency is a tie-break only).
 */
export const RECENTLY_LOGGED_BOOST = 0.05;

/** Boost when the user typed a chain/grocery brand and the row is that brand's product. */
export const BRANDED_CHAIN_QUERY_BOOST = 0.18;

function normalizeBrandToken(s: string): string {
  return s
    .toLowerCase()
    .replace(/[''´`]/g, "")
    .replace(/[^a-z0-9]+/g, "");
}

/**
 * Multi-word queries like "starbucks latte" or "tesco chicken" should prefer
 * FatSecret/OFF branded rows over a terse USDA generic that only matches the
 * food noun ("Latte, coffee").
 */
export function brandedChainQueryBoost(input: {
  query: string;
  name: string;
  source: FoodSearchTrustSource;
}): number {
  if (input.source !== "FatSecret" && input.source !== "OFF") return 0;
  const sep = input.name.indexOf("·");
  if (sep < 0) return 0;
  const brandPart = input.name.slice(0, sep).trim();
  if (!brandPart) return 0;

  const qTokens = input.query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1 && !MATCH_STOPWORDS.has(t));
  if (qTokens.length < 2) return 0;

  const brandNorm = normalizeBrandToken(brandPart);
  const firstNorm = normalizeBrandToken(qTokens[0]!);
  if (!firstNorm || !brandNorm.includes(firstNorm) && !firstNorm.includes(brandNorm)) return 0;

  const productPart = input.name.slice(sep + 1).toLowerCase();
  const tailTokens = qTokens.slice(1);
  const FOOD_SPELLING_ALIASES: Record<string, string[]> = {
    hummus: ["houmous", "humus"],
    houmous: ["hummus"],
  };
  const tailTokenHits = (t: string): boolean => {
    if (productPart.includes(t)) return true;
    for (const alias of FOOD_SPELLING_ALIASES[t] ?? []) {
      if (productPart.includes(alias)) return true;
    }
    const stemmed = stem(t);
    return productPart.split(/\s+/).some((w) => stem(w) === stemmed);
  };
  const tailQuery = tailTokens.join(" ");
  const tailMatch = searchMatchScore(tailQuery, productPart) * 0.08;
  if (tailTokens.every(tailTokenHits)) return BRANDED_CHAIN_QUERY_BOOST + 0.06 + tailMatch;
  if (tailTokens.some(tailTokenHits)) return BRANDED_CHAIN_QUERY_BOOST + tailMatch;
  return 0;
}

/** Fast-food / chain-restaurant brands — not grocery (Tropicana, Chobani, Tesco). */
const CHAIN_RESTAURANT_BRAND_RE =
  /\b(mcdonald|burger\s*king|wendy|subway|kfc|chipotle|starbucks|taco\s*bell|domino|pizza\s*hut|five\s*guys|panda\s*express|panera|dunkin|nandos|pret)\b/i;

function brandSegmentIsChainRestaurant(brandPart: string): boolean {
  const norm = normalizeBrandToken(brandPart);
  if (!norm) return false;
  if (CHAIN_RESTAURANT_BRAND_RE.test(brandPart)) return true;
  // normalizeBrandToken strips spaces — "burgerking" still matches substring checks
  const CHAIN_NORMS = [
    "mcdonald",
    "burgerking",
    "wendy",
    "subway",
    "kfc",
    "chipotle",
    "starbucks",
    "tacobell",
    "dominos",
    "pizzahut",
    "fiveguys",
    "pandaexpress",
    "panera",
    "dunkin",
    "nandos",
    "pret",
  ];
  return CHAIN_NORMS.some((c) => norm.includes(c) || c.includes(norm));
}

/**
 * Menu-item queries without a brand token ("big mac", "egg mcmuffin") — boost
 * FatSecret/OFF when the product segment exactly matches the query and the row
 * is from a chain restaurant (not grocery branded SKUs like "Orange Juice").
 */
export function brandedMenuProductBoost(input: {
  query: string;
  name: string;
  source: FoodSearchTrustSource;
}): number {
  if (input.source !== "FatSecret" && input.source !== "OFF") return 0;
  const sep = input.name.indexOf("·");
  if (sep < 0) return 0;
  const brandPart = input.name.slice(0, sep).trim();
  if (!brandSegmentIsChainRestaurant(brandPart)) return 0;
  const productPart = input.name.slice(sep + 1).trim();
  if (!productPart) return 0;
  const q = input.query.trim().toLowerCase();
  if (q.split(/\s+/).filter((t) => t.length > 1).length < 2) return 0;
  if (brandedChainQueryBoost(input) > 0) return 0;
  // Exact menu-item match only — "Greek Yogurt Strawberry" must not beat USDA.
  if (normalize(q) !== normalize(productPart)) return 0;
  return BRANDED_CHAIN_QUERY_BOOST + 0.06;
}

/**
 * Demote USDA Branded scrapes that match a menu-item query but aren't the
 * authoritative branded row ("Big Mac (McDonalds)" losing to FS).
 */
export function usdaBrandedMenuPenalty(input: {
  query: string;
  name: string;
  source: FoodSearchTrustSource;
  verified?: boolean;
}): number {
  if (input.source !== "USDA") return 0;
  const qNorm = normalizeBrandToken(input.query);
  if (qNorm.length < 4) return 0;
  const raw = input.name.trim();
  const head = raw.split(/[,(]/)[0]?.trim() ?? "";
  if (!head || normalizeBrandToken(head) !== qNorm) return 0;
  const hasParenBrand = /\([^)]{3,}\)/.test(raw);
  const hasChainInName = /\b(mcdonald|burger king|wendy|subway|kfc|chipotle|starbucks)\b/i.test(
    raw,
  );
  if (!hasParenBrand && !hasChainInName) return 0;
  return input.verified ? -0.28 : -0.18;
}

/**
 * Penalise generic FatSecret rows when the user named a UK retailer
 * ("tesco chicken" → plain "Chicken" without Tesco in the name).
 */
export function ukRetailerGenericRowPenalty(input: {
  query: string;
  name: string;
  source: FoodSearchTrustSource;
}): number {
  const retailer = queryLeadingUkRetailer(input.query);
  if (!retailer) return 0;
  if (input.source !== "FatSecret" && input.source !== "OFF") return 0;
  if (/·/.test(input.name) && foodNameIncludesUkRetailer(input.name, retailer)) return 0;
  if (foodNameIncludesUkRetailer(input.name, retailer)) return 0;
  return -0.35;
}

/**
 * When the query leads with a UK retailer, demote USDA rows that do not
 * mention that retailer ("tesco chicken" → "Chicken skin" loses to Tesco FS).
 */
export function ukRetailerQueryUsdaPenalty(input: {
  query: string;
  name: string;
  source: FoodSearchTrustSource;
}): number {
  const retailer = queryLeadingUkRetailer(input.query);
  if (!retailer) return 0;
  if (input.source !== "USDA") return 0;
  if (foodNameIncludesUkRetailer(input.name, retailer)) return 0;
  return -0.42;
}

/**
 * Boost FatSecret/OFF rows that include the queried UK retailer token.
 */
export function ukRetailerBrandedBoost(input: {
  query: string;
  name: string;
  source: FoodSearchTrustSource;
}): number {
  const retailer = queryLeadingUkRetailer(input.query);
  if (!retailer) return 0;
  if (input.source !== "FatSecret" && input.source !== "OFF") return 0;
  if (!foodNameIncludesUkRetailer(input.name, retailer)) return 0;
  return 0.38;
}

/**
 * When the user typed a multi-word query whose first token looks like a brand
 * ("starbucks latte"), demote verified USDA generics that don't mention that
 * brand ("Latte, coffee") so FatSecret/OFF branded rows can win honestly.
 */
export function genericBrandQueryPenalty(input: {
  query: string;
  name: string;
  source: FoodSearchTrustSource;
  verified?: boolean;
}): number {
  if (input.source !== "USDA") return 0;
  const qTokens = input.query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 1 && !MATCH_STOPWORDS.has(t));
  if (qTokens.length < 2) return 0;
  const brandish = normalizeBrandToken(qTokens[0]!);
  if (!brandish || brandish.length < 3) return 0;
  const segments = input.name.split(",").map((s) => normalizeBrandToken(s.trim()));
  const firstSeg = segments[0] ?? "";
  if (firstSeg.includes(brandish)) return 0;

  // "Bowl, chipotle, with chicken" for query "chipotle bowl" — chipotle is a
  // trailing qualifier on a dish row, not the Chipotle restaurant brand.
  const DISH_HEADS = new Set([
    "bowl",
    "salad",
    "sandwich",
    "wrap",
    "burger",
    "pizza",
    "coffee",
    "latte",
    "soup",
    "taco",
    "burrito",
  ]);
  const trailingOnly = segments.slice(1).some((s) => s.includes(brandish));
  if (trailingOnly && DISH_HEADS.has(firstSeg)) return -0.38;

  // "Latte, coffee" for query "starbucks latte" — brand token absent entirely.
  if (!trailingOnly) return -0.16;
  return 0;
}

/** Combined rank score used when sorting merged search rows. */
export function foodSearchRankScore(input: {
  query: string;
  name: string;
  source: FoodSearchTrustSource;
  verified?: boolean;
  /** True when this exact food appears in the user's recent-log history. */
  recentlyLogged?: boolean;
}): number {
  const brandBoost = brandedChainQueryBoost({
    query: input.query,
    name: input.name,
    source: input.source,
  });
  const menuBoost = brandedMenuProductBoost({
    query: input.query,
    name: input.name,
    source: input.source,
  });
  const brandedLift = Math.max(brandBoost, menuBoost);
  const base =
    searchMatchScore(input.query, input.name) +
    foodSearchTrustWeight({ source: input.source, verified: input.verified, name: input.name }) +
    brandBoost +
    menuBoost +
    genericBrandQueryPenalty({
      query: input.query,
      name: input.name,
      source: input.source,
      verified: input.verified,
    }) +
    usdaBrandedMenuPenalty({
      query: input.query,
      name: input.name,
      source: input.source,
      verified: input.verified,
    }) +
    ukRetailerGenericRowPenalty({
      query: input.query,
      name: input.name,
      source: input.source,
    }) +
    ukRetailerQueryUsdaPenalty({
      query: input.query,
      name: input.name,
      source: input.source,
    }) +
    ukRetailerBrandedBoost({
      query: input.query,
      name: input.name,
      source: input.source,
    });
  // Branded grocery/chain rows must not lose to a generic USDA row when the
  // user's query names the brand explicitly (houmous/hummus spelling drift).
  const floored = brandedLift > 0 ? Math.max(base, 0.62 + brandedLift * 0.25) : base;
  const boosted = input.recentlyLogged ? floored + RECENTLY_LOGGED_BOOST : floored;
  return Math.max(0, boosted);
}

// ── Honest confidence tier (ENG-807) ────────────────────────────────────
//
// A row is "Verified" ONLY when it has trustworthy provenance AND its name
// actually matches what the user typed. Source alone is never enough — a USDA
// Branded "EGGS" row or a weak-match Foundation row must read "Estimated", not
// flash a soft-blue Verified chip the data doesn't earn (CLAUDE.md trust
// posture: never show a confidence label not backed by the real signal).

export type SearchRowConfidenceTier = "verified" | "estimated";

/**
 * Provenance is verifiable when the row comes from a curated/authoritative
 * corpus: verified USDA (Foundation / SR Legacy / Survey) or Suppr's own
 * seeded generic foods/beverages. Branded rows (USDA Branded, OFF, Edamam,
 * FatSecret) are community/commercial product data — never auto-"Verified".
 */
function hasVerifiableProvenance(source: FoodSearchTrustSource, verified: boolean): boolean {
  if (source === "USDA") return verified === true;
  if (source === "GenericFood" || source === "GenericBeverage") return true;
  return false;
}

/**
 * Minimum match score a verifiable-provenance row must clear to earn the
 * "Verified" chip. Below this the name match is too weak to honestly claim the
 * row IS what the user typed — it renders "Estimated" instead.
 */
export const VERIFIED_TIER_MIN_SCORE = 0.55;

/**
 * Derive the honest confidence tier for a search row from BOTH provenance and
 * the computed relevance/match score. Returns "verified" only when the source
 * is authoritative AND the name match is strong; everything else is
 * "estimated" (the UI renders the amber chip — see ENG-798 prototype).
 */
export function searchRowConfidenceTier(input: {
  source: FoodSearchTrustSource;
  verified?: boolean;
  /** Relevance/match score for this row vs the query, in [0, 1]. */
  matchScore: number;
}): SearchRowConfidenceTier {
  const provenanceOk = hasVerifiableProvenance(input.source, Boolean(input.verified));
  if (provenanceOk && input.matchScore >= VERIFIED_TIER_MIN_SCORE) return "verified";
  return "estimated";
}

// ── Best-matches / More-results split (ENG-807) ─────────────────────────
//
// The approved prototype (surface-search-results.html) splits the ranked list
// into a "Best matches" section and a "More results" section. The split is a
// SCORE threshold on the combined rank score — independent of the tier (both
// Verified and Estimated rows appear in both sections in the prototype).

/**
 * Combined-rank-score threshold above which a row is a "best match". Rows below
 * it fall into "More results". Tuned so a clean on-target hit (recall 1,
 * precision high, neutral-or-better trust) lands in Best matches while
 * containing/peripheral hits drop to More results.
 */
export const BEST_MATCH_MIN_SCORE = 0.6;

export type SectionedSearchRows<T> = {
  best: T[];
  more: T[];
};

/**
 * Split an already-RANKED (descending by score) list into Best matches / More
 * results by {@link BEST_MATCH_MIN_SCORE}. Order within each section is
 * preserved.
 *
 * Guarantees at least one Best match when the list is non-empty: if no row
 * clears the threshold, the single highest-scoring row is promoted to Best so
 * the user always has a clear lead candidate (never an empty Best section over
 * a populated More section).
 */
export function splitBestMatches<T>(
  rows: T[],
  scoreOf: (row: T) => number,
): SectionedSearchRows<T> {
  if (rows.length === 0) return { best: [], more: [] };
  const best: T[] = [];
  const more: T[] = [];
  for (const r of rows) {
    if (scoreOf(r) >= BEST_MATCH_MIN_SCORE) best.push(r);
    else more.push(r);
  }
  if (best.length === 0) {
    // Promote the top row so Best is never empty while More has rows.
    best.push(more.shift()!);
  }
  return { best, more };
}
