/**
 * T12 (full-sweep 2026-04-24) — the 14 regulated allergens.
 *
 * EU FIC (Regulation 1169/2011 Annex II) + UK FSA + FDA's major-allergen
 * list. These are the allergens a food business legally has to declare.
 * Distinct from `DIETARY_PREFERENCE_ENTRIES` which models lifestyle
 * choices (vegetarian / vegan / halal / kosher …).
 *
 * Each entry carries:
 *  - `id`: canonical slug stored in `recipes.allergens text[]`.
 *  - `label`: human UI label (EU-style naming).
 *  - `usLabel?`: US label when it diverges (e.g. "Shellfish" covers both
 *    crustaceans + molluscs under US law).
 *  - `keywords`: lowercase substrings used by `inferAllergensFromIngredients`
 *    for v0 auto-population from ingredient lines. Not exhaustive; the
 *    matcher errs on the side of FLAGGING when unsure (it's safer to
 *    surface "Contains: nuts" on a false-positive than to miss a real
 *    allergen). See `docs/product/nutrition-approximation-policy.md`
 *    for the approximation contract.
 *  - `exclusions`: substrings that should NOT trigger a match even if a
 *    keyword appears (e.g. "coconut" is not a tree nut under FDA rules;
 *    "coconut milk" must not trigger Milk).
 *
 * Policy reference: `docs/decisions/2026-04-24-phase2-architecture-choices.md` §T12.
 */

export interface RegulatedAllergen {
  id: string;
  label: string;
  usLabel?: string;
  keywords: readonly string[];
  exclusions?: readonly string[];
}

export const REGULATED_ALLERGENS: readonly RegulatedAllergen[] = [
  {
    id: "peanuts",
    label: "Peanuts",
    keywords: ["peanut", "groundnut", "goober", "arachis"],
  },
  {
    id: "tree_nuts",
    label: "Tree nuts",
    keywords: [
      "almond",
      "hazelnut",
      "filbert",
      "walnut",
      "cashew",
      "pecan",
      "brazil nut",
      "pistachio",
      "macadamia",
      "pine nut",
      "chestnut",
      "nut butter",
      "nutmeat",
    ],
    // Nutmeg, nutritional yeast, coconut, butternut squash, water
    // chestnut, doughnut, peanut(s) — all contain the substring "nut"
    // but are not tree nuts under any major regulator's list.
    exclusions: [
      "nutmeg",
      "nutritional yeast",
      "coconut",
      "butternut",
      "water chestnut",
      "doughnut",
      "donut",
      "peanut",
      "groundnut",
    ],
  },
  {
    id: "milk",
    label: "Milk",
    keywords: [
      "milk",
      "butter",
      "cream",
      "cheese",
      "yogurt",
      "yoghurt",
      "whey",
      "casein",
      "lactose",
      "ghee",
      "kefir",
      "paneer",
      "ricotta",
      "mozzarella",
      "parmesan",
      "feta",
      "custard",
    ],
    // Coconut milk / almond milk / soy milk / oat milk / rice milk are
    // not milk for allergen purposes; "peanut butter" / "almond butter"
    // are not dairy butter; "cocoa butter" is not dairy; "buttermilk"
    // IS dairy so we can't exclude "butter" outright — exclusions are
    // specific strings. "butternut" catches butternut squash whose
    // substring spans "butter" without implying dairy.
    exclusions: [
      "coconut milk",
      "coconut cream",
      "almond milk",
      "soy milk",
      "soya milk",
      "oat milk",
      "rice milk",
      "cashew milk",
      "hemp milk",
      "pea milk",
      "peanut butter",
      "almond butter",
      "cashew butter",
      "sunflower butter",
      "cocoa butter",
      "apple butter",
      "butternut",
    ],
  },
  {
    id: "eggs",
    label: "Eggs",
    keywords: ["egg", "albumen", "ovalbumin", "meringue", "mayonnaise", "mayo"],
    // "Eggplant" / "aubergine" has the substring "egg" but is not egg.
    exclusions: ["eggplant"],
  },
  {
    id: "fish",
    label: "Fish",
    keywords: [
      "fish",
      "salmon",
      "tuna",
      "cod",
      "haddock",
      "halibut",
      "mackerel",
      "sardine",
      "anchov", // anchovy / anchovies
      "trout",
      "bass",
      "snapper",
      "tilapia",
      "swordfish",
      "pollock",
      "catfish",
      "sea bass",
    ],
  },
  {
    id: "crustaceans",
    label: "Crustaceans",
    usLabel: "Shellfish",
    keywords: [
      "shrimp",
      "prawn",
      "crab",
      "lobster",
      "crayfish",
      "crawfish",
      "langoustine",
      "scampi",
      "krill",
    ],
  },
  {
    id: "molluscs",
    label: "Molluscs",
    usLabel: "Shellfish",
    keywords: [
      "oyster",
      "mussel",
      "clam",
      "scallop",
      "squid",
      "calamari",
      "octopus",
      "snail",
      "escargot",
      "abalone",
      "cockle",
      "whelk",
    ],
  },
  {
    id: "soy",
    label: "Soy",
    keywords: [
      "soy",
      "soya",
      "soybean",
      "edamame",
      "tofu",
      "tempeh",
      "miso",
      "tamari",
      "natto",
    ],
  },
  {
    id: "wheat",
    label: "Wheat",
    keywords: [
      "wheat",
      "flour",
      "bread",
      "pasta",
      "spaghetti",
      "couscous",
      "bulgur",
      "semolina",
      "farro",
      "spelt",
      "seitan",
      "durum",
      "kamut",
      "tortilla",
      "noodle",
    ],
    // Rice flour / almond flour / buckwheat etc. are wheat-free; listing
    // them as exclusions means a recipe with only "almond flour" won't
    // trigger Wheat. Callers should treat this list as a v0 starter;
    // verification pipelines are expected to refine.
    exclusions: [
      "almond flour",
      "coconut flour",
      "rice flour",
      "chickpea flour",
      "buckwheat flour",
      "buckwheat",
      "corn flour",
      "corn tortilla",
      "rice noodle",
      "rice noodles",
      "lupin flour",
      "oat flour",
      "oat noodle",
      "cassava flour",
    ],
  },
  {
    id: "sesame",
    label: "Sesame",
    keywords: ["sesame", "tahini", "benne", "gingelly"],
  },
  {
    id: "mustard",
    label: "Mustard",
    keywords: ["mustard", "dijon"],
  },
  {
    id: "celery",
    label: "Celery",
    keywords: ["celery", "celeriac"],
  },
  {
    id: "sulfites",
    label: "Sulfites",
    // SO2 at >10 mg/kg. Keyword match is necessarily incomplete — sulfites
    // are a preservative that may be present in wine, dried fruit, and
    // commercial vinegars without being listed in a recipe ingredient
    // line. Treat the absence of an inferred sulfites tag as "unknown,"
    // not "confirmed absent."
    keywords: [
      "sulfite",
      "sulphite",
      "sulfur dioxide",
      "sulphur dioxide",
      "e220",
      "e221",
      "e222",
      "e223",
      "e224",
      "e225",
      "e226",
      "e227",
      "e228",
    ],
  },
  {
    id: "lupin",
    label: "Lupin",
    keywords: ["lupin", "lupine"],
  },
] as const;

export type RegulatedAllergenId = (typeof REGULATED_ALLERGENS)[number]["id"];

const ALLOWED_ALLERGEN_IDS = new Set<string>(
  REGULATED_ALLERGENS.map((a) => a.id),
);

/**
 * Keep unknown strings out of the `recipes.allergens` array. Used on
 * both the write path (when applying an inferred or user-supplied
 * list) and the read path (when surfacing a "Contains:" line).
 */
export function normaliseAllergenIds(raw: unknown): RegulatedAllergenId[] {
  if (!Array.isArray(raw)) return [];
  const out: RegulatedAllergenId[] = [];
  const seen = new Set<string>();
  for (const x of raw) {
    if (typeof x !== "string") continue;
    if (!ALLOWED_ALLERGEN_IDS.has(x)) continue;
    if (seen.has(x)) continue;
    seen.add(x);
    out.push(x as RegulatedAllergenId);
  }
  // Preserve canonical order so UI is stable.
  const order = new Map<string, number>();
  REGULATED_ALLERGENS.forEach((a, i) => order.set(a.id, i));
  out.sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  return out;
}

/**
 * Human-readable "Contains: …" label suitable for rendering on a recipe
 * detail card. Falls back to "—" when the list is empty.
 *
 * `region: "us"` uses `usLabel` where defined (e.g. "Shellfish" for
 * crustaceans + molluscs combined). `region: "eu"` (default) uses the
 * EU FIC-aligned labels.
 */
export function formatContainsLine(
  allergens: readonly RegulatedAllergenId[],
  region: "us" | "eu" = "eu",
): string | null {
  if (allergens.length === 0) return null;
  const byId = new Map(REGULATED_ALLERGENS.map((a) => [a.id, a]));
  const labels: string[] = [];
  const seenUsLabels = new Set<string>();
  for (const id of allergens) {
    const row = byId.get(id);
    if (!row) continue;
    if (region === "us" && row.usLabel) {
      if (seenUsLabels.has(row.usLabel)) continue;
      seenUsLabels.add(row.usLabel);
      labels.push(row.usLabel);
    } else {
      labels.push(row.label);
    }
  }
  return labels.length ? `Contains: ${labels.join(", ")}` : null;
}
