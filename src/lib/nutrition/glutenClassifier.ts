/**
 * glutenClassifier — Ingredient-level gluten classification.
 *
 * Production design spec — 2026-04-27 §1.6 + B3.2 (gluten depth).
 * Authority: D-2026-04-27-13 (one allergen done brilliantly = gluten).
 *
 * The classifier reads a free-form ingredient string and returns a
 * status + confidence pair:
 *   - `free`     — no gluten-bearing grain or contamination marker found.
 *   - `contains` — explicit gluten-bearing grain detected.
 *   - `risk`     — ambiguous marker (oats without "certified gluten-free",
 *                  soy sauce without "tamari", miso without "gluten-free").
 *
 * Confidence:
 *   - `high`   — clear-cut match against the maintained lookup.
 *   - `medium` — risk markers (oats / soy sauce / miso) without a
 *                disambiguating qualifier.
 *   - `low`    — short / single-token strings where we don't have
 *                enough surface area to be confident either way.
 *                Treated as `free + low` — the recipe-level aggregator
 *                folds these into the cautious side.
 *
 * Cross-platform: shared (mobile re-exports via `apps/mobile/lib/recipeTrust.ts`).
 *
 * Why this exists:
 *   - Discover / Library / Recipe detail need to surface a "Gluten-free"
 *     filter chip + a TrustChip variant per recipe (`gluten-high-conf`
 *     / `gluten-uncertain`).
 *   - The single-allergen depth call (D-2026-04-27-13) means we ship
 *     coeliac-grade copy ("Gluten contamination risk · review") rather
 *     than a 12-allergen surface treatment that would dilute every claim.
 *
 * Legal-reviewer note (signed off — ENG-748): this classifier owns the
 * *detection* logic; the *display* copy is the legal-reviewer surface.
 * The shipped chip copy is descriptive, not regulated:
 *   - `gluten-high-conf` → "No gluten-containing ingredients"
 *   - `gluten-uncertain` → "Contains potential gluten · review"
 * The regulated term "Gluten-free" must NEVER render as a label
 * (EU/UK Reg 828/2014 reserves it for verified ≤20 ppm products; an
 * ingredient-name estimate cannot make that claim). On coeliac
 * surfaces the chip uses the Sparkles ("estimated") glyph — not a
 * verified Check — and a PERSISTENT disclaimer caption ("Estimated
 * from ingredient names — not a guarantee. Always check labels and
 * packaging if you avoid gluten for medical reasons.") is rendered
 * directly beneath the chip on every recipe-detail hero (web +
 * mobile). See docs/journeys/gluten-depth-2026-04-27.md.
 */

export type GlutenStatus = "free" | "contains" | "risk";
export type GlutenConfidence = "high" | "medium" | "low";

export interface GlutenClassification {
  status: GlutenStatus;
  confidence: GlutenConfidence;
  /** The matched token, useful for inline UI flagging. Null for `free`. */
  matched?: string | null;
}

/**
 * Common gluten-bearing grains. Each entry is a substring matched
 * case-insensitively against word boundaries on the ingredient text.
 *
 * Notes:
 *   - "wheat" appears as a substring of "buckwheat" — guarded by word
 *     boundary regex below so "buckwheat" doesn't trip the wheat match.
 *   - "rye" similarly guarded ("turkey" / "puree" / "barley" don't match).
 *   - "oats" is NOT in this list — see RISK_MARKERS.
 */
const GLUTEN_BEARING = [
  "wheat",
  "barley",
  "rye",
  "malt",
  "semolina",
  "durum",
  "spelt",
  "kamut",
  "triticale",
  "bulgur",
  "couscous",
  "farina",
  "einkorn",
  "freekeh",
  // Composite forms — "wheat flour" caught by "wheat", "barley malt" by "malt"/"barley".
  // Bread and pasta default to wheat unless qualified ("gluten-free bread").
  "seitan",
] as const;

/**
 * Risk markers — ingredients that *can* be gluten-free but commonly
 * aren't unless explicitly qualified. We surface them as `risk +
 * medium` so coeliac users get a "review this" signal rather than a
 * silent false-positive.
 */
const RISK_MARKERS = [
  { token: "oats", clears: ["certified gluten-free", "certified gluten free", "gf-certified", "gluten-free oats"] },
  { token: "oat", clears: ["certified gluten-free", "certified gluten free", "gf-certified", "gluten-free oat"] },
  { token: "soy sauce", clears: ["tamari", "gluten-free", "gluten free"] },
  { token: "miso", clears: ["gluten-free", "gluten free"] },
] as const;

/**
 * Common gluten-free flours / grains. Used to short-circuit a clear
 * `free + high` match. Anything not on either list lands in
 * `free + low` (silent — the recipe-level aggregator decides the chip).
 */
const KNOWN_GLUTEN_FREE = [
  "rice flour",
  "almond flour",
  "coconut flour",
  "buckwheat",
  "gram flour",
  "chickpea flour",
  "quinoa",
  "millet",
  "sorghum",
  "amaranth",
  "teff",
  "tapioca",
  "cornstarch",
  "polenta",
  "cornmeal",
] as const;

/**
 * Naturally gluten-free whole foods — meats, produce, dairy, eggs,
 * legumes, oils. These are inherently free of gluten by their nature
 * (no manufacturing pathway introduces gluten in plain form).
 *
 * The recipe-level aggregator counts these as `free + high` so a
 * recipe like "chicken + quinoa + olive oil" can earn the
 * `gluten-high-conf` chip without every line needing an explicit
 * "gluten-free" qualifier.
 *
 * Edge cases excluded:
 *   - "stock" / "broth" — frequently contains malt or wheat-derived
 *     thickener; treat as low-confidence (silent).
 *   - "sausage" — varies wildly; many use breadcrumbs as binder.
 *   - "ham" / "bacon" — usually fine, but the cured-meat market does
 *     include malt-glazed varieties; keep as low-confidence.
 *   - "marinade" / "sauce" — too generic.
 */
const NATURAL_GLUTEN_FREE = [
  // Meats (whole-cut)
  "chicken breast",
  "chicken thigh",
  "chicken leg",
  "chicken",
  "turkey breast",
  "turkey",
  "beef",
  "steak",
  "pork",
  "lamb",
  "salmon",
  "tuna",
  "cod",
  "trout",
  "haddock",
  "prawns",
  "shrimp",
  "tofu",
  "tempeh",
  "halloumi",
  "feta",
  "paneer",
  "egg",
  "eggs",
  // Produce — common
  "tomato",
  "tomatoes",
  "onion",
  "onions",
  "garlic",
  "potato",
  "potatoes",
  "sweet potato",
  "carrot",
  "carrots",
  "broccoli",
  "spinach",
  "kale",
  "lettuce",
  "cucumber",
  "courgette",
  "zucchini",
  "aubergine",
  "eggplant",
  "pepper",
  "peppers",
  "mushroom",
  "mushrooms",
  "lemon",
  "lime",
  "berries",
  "berry",
  "banana",
  "apple",
  "avocado",
  "ginger",
  "chilli",
  "chili",
  // Dairy
  "milk",
  "cream",
  "cheese",
  "butter",
  "yogurt",
  "yoghurt",
  "cottage cheese",
  // Legumes
  "lentils",
  "lentil",
  "chickpeas",
  "chickpea",
  "black beans",
  "black bean",
  "kidney beans",
  "white beans",
  "cannellini",
  // Oils + fats
  "olive oil",
  "coconut oil",
  "sesame oil",
  "vegetable oil",
  "butter",
  // Seasoning + condiments — clearly gluten-free
  "salt",
  "pepper",
  "paprika",
  "cumin",
  "turmeric",
  "cinnamon",
  "honey",
  "maple syrup",
  "vinegar",
  // Note: rice vinegar is fine, malt vinegar is not — covered by
  // the GLUTEN_BEARING "malt" check elsewhere.
  "rice",
  "basmati",
  "jasmine rice",
  "brown rice",
  "white rice",
] as const;

/**
 * Common gluten-bearing dish names that imply gluten without naming it
 * explicitly. Matched case-insensitively as substrings.
 *
 * "pasta" → defaults to wheat unless "gluten-free pasta" qualifier present.
 * "bread" → same.
 * "noodles" → ambiguous (rice noodles common); treated as `risk + medium`.
 */
const IMPLICIT_GLUTEN = [
  { token: "pasta", clears: ["gluten-free", "gluten free", "rice", "buckwheat", "soba"] },
  { token: "bread", clears: ["gluten-free", "gluten free"] },
  { token: "pappardelle", clears: ["gluten-free", "gluten free"] },
  { token: "spaghetti", clears: ["gluten-free", "gluten free"] },
  { token: "linguine", clears: ["gluten-free", "gluten free"] },
  { token: "fettuccine", clears: ["gluten-free", "gluten free"] },
  { token: "macaroni", clears: ["gluten-free", "gluten free"] },
  { token: "tortilla", clears: ["corn", "gluten-free", "gluten free"] },
] as const;

const IMPLICIT_RISK = [
  { token: "noodles", clears: ["rice", "buckwheat", "soba", "gluten-free", "gluten free"] },
  { token: "soba", clears: [] }, // soba can be 100% buckwheat (free) or wheat-blend (contains)
] as const;

/**
 * Build a word-boundary regex for a token. `\b` doesn't work cleanly
 * for multi-word tokens, so we use whitespace / punctuation framing.
 */
function tokenMatches(text: string, token: string): boolean {
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Word-boundary on each side; for multi-word tokens this becomes
  // "anchor on word at start, on word at end".
  const re = new RegExp(`(?:^|[^a-zA-Z])${escaped}(?:[^a-zA-Z]|$)`, "i");
  return re.test(text);
}

function lower(text: string): string {
  return text.toLowerCase();
}

/**
 * Classify a single ingredient string for gluten content.
 *
 * Priority order:
 *   1. Explicit "gluten-free" qualifier on the line → free + high.
 *   2. Any GLUTEN_BEARING token → contains + high.
 *   3. IMPLICIT_GLUTEN with no clearing qualifier → contains + high.
 *   4. RISK_MARKERS / IMPLICIT_RISK with no clearing qualifier → risk + medium.
 *   5. KNOWN_GLUTEN_FREE token → free + high.
 *   6. Otherwise → free + low (treated as cautious-free; recipe-level
 *      aggregator decides whether the chip surfaces).
 */
export function classifyIngredientGluten(
  ingredientText: string,
): GlutenClassification {
  if (!ingredientText || typeof ingredientText !== "string") {
    return { status: "free", confidence: "low", matched: null };
  }

  const text = lower(ingredientText.trim());
  if (text.length === 0) {
    return { status: "free", confidence: "low", matched: null };
  }

  // 1. Explicit "gluten-free" qualifier. This wins outright — the
  //    user (or recipe author) has explicitly cleared the line.
  if (text.includes("gluten-free") || text.includes("gluten free")) {
    return { status: "free", confidence: "high", matched: null };
  }

  // 2. Explicit gluten-bearing grain.
  for (const grain of GLUTEN_BEARING) {
    if (tokenMatches(text, grain)) {
      // Edge: "wheat" appears in "buckwheat" — but tokenMatches uses
      // word boundaries, so "buckwheat" wouldn't match "wheat" via
      // the regex (the prefix "buck" is alphabetic, fails the
      // [^a-zA-Z] requirement). This branch is safe.
      return { status: "contains", confidence: "high", matched: grain };
    }
  }

  // 3. Implicit gluten dish names (pasta, bread, etc.) without a
  //    clearing qualifier. The clearing-qualifier check is INCLUDES
  //    on the lowered text — multiple qualifiers can apply.
  for (const entry of IMPLICIT_GLUTEN) {
    if (!tokenMatches(text, entry.token)) continue;
    const cleared = entry.clears.some((q) => text.includes(q));
    if (cleared) {
      // Cleared via "rice pasta" / "gluten-free spaghetti" / "corn
      // tortilla" — anchor the line as confidently gluten-free.
      return { status: "free", confidence: "high", matched: null };
    }
    return { status: "contains", confidence: "high", matched: entry.token };
  }

  // 4. Risk markers (oats, soy sauce, miso) without a clearing qualifier.
  //    These are ambiguous — coeliac-grade UX surfaces them.
  for (const entry of RISK_MARKERS) {
    if (!tokenMatches(text, entry.token)) continue;
    const cleared = entry.clears.some((q) => text.includes(q));
    if (cleared) {
      // Cleared via "certified gluten-free" or similar — treat as free.
      return { status: "free", confidence: "high", matched: null };
    }
    return { status: "risk", confidence: "medium", matched: entry.token };
  }

  for (const entry of IMPLICIT_RISK) {
    if (!tokenMatches(text, entry.token)) continue;
    const cleared = entry.clears.some((q) => text.includes(q));
    if (cleared) {
      // Cleared via "rice noodles" / "100% buckwheat soba" / etc.
      return { status: "free", confidence: "high", matched: null };
    }
    return { status: "risk", confidence: "medium", matched: entry.token };
  }

  // 5. Known gluten-free flours / grains.
  for (const grain of KNOWN_GLUTEN_FREE) {
    if (tokenMatches(text, grain)) {
      return { status: "free", confidence: "high", matched: null };
    }
  }

  // 6. Naturally gluten-free whole foods — meats, produce, dairy,
  //    eggs, legumes, oils, plain rice, common seasonings. Counts as
  //    `free + high` so recipes can earn the chip without every line
  //    needing an explicit "gluten-free" qualifier.
  for (const food of NATURAL_GLUTEN_FREE) {
    if (tokenMatches(text, food)) {
      return { status: "free", confidence: "high", matched: null };
    }
  }

  // 7. Default — no marker found. Cautious-free with low confidence.
  //    The recipe-level aggregator collapses these into a non-claim
  //    (no chip surfaces unless every ingredient is high-confidence).
  return { status: "free", confidence: "low", matched: null };
}
