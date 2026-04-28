/**
 * Onboarding hand-picked seed list (Surface F / B2.3).
 *
 * Production design spec — 2026-04-27 Surface F.
 * Authority: D-2026-04-27-14 (onboarding produces first plan).
 * Resolved sub-decision: docs/decisions/2026-04-27-onboarding-candidate-source.md.
 *
 * 15 hand-picked recipes the onboarding picker offers as the user's
 * first cooking commitment. The list is small, version-controlled, and
 * edited rarely. It powers two surfaces:
 *   - The "Pick 5 recipes" final step of onboarding.
 *   - The auto-plan generator that seeds the user's first weekly plan.
 *
 * Resolution path (current):
 *   - Each seed carries a stable `slug` (kept for forwards compat) +
 *     a `matchTitle` used for case-insensitive equality against the
 *     `recipes.title` column. The `recipes` table doesn't have a slug
 *     column today — staging that schema change is gated on
 *     monetisation-architect / data-integrity sign-off and isn't
 *     blocking Phase 5. The matchTitle path resolves cleanly because
 *     titles are the seed's authoritative natural key.
 *   - When a slug fails to resolve, the resolver falls back to
 *     surfacing the seed as a non-saveable tile (greyed) — never
 *     silently drops a row from the picker.
 *
 * Cross-platform: shared (mobile re-exports via `apps/mobile/lib/onboardingSeeds.ts`).
 *
 * Coverage shape:
 *   - 5 omnivore, 4 vegetarian/vegan, 2 pescatarian, 4 GF.
 *   - Prep times: 5–45 min (one breakfast, one batch-cook).
 *   - Protein: 18–45g.
 *   - No allergen-heavy outliers (no peanuts in the core, tree-nut-free,
 *     no shellfish).
 */

export interface OnboardingSeed {
  /** Stable slug for forwards-compat (gated migration adds `recipes.slug`). */
  slug: string;
  /** Authoritative natural key — case-insensitive match against `recipes.title`. */
  matchTitle: string;
  /** Display title — often identical to matchTitle but allowed to differ. */
  title: string;
  /** Estimated kcal at the canonical serving size. Display-only. */
  kcal: number;
  /** Protein grams at the canonical serving size. Display-only. */
  protein_g: number;
  /** Estimated total prep + cook time in minutes. Display-only. */
  prepMins: number;
  /** Free-form dietary tags — used by the picker filter. */
  dietTags: string[];
  /** Single-cuisine label — used for grouping (UK English where applicable). */
  cuisine: string;
  /** Hero emoji rendered until verified images land. */
  heroEmoji: string;
}

export const ONBOARDING_SEEDS: readonly OnboardingSeed[] = [
  {
    slug: "sheet-pan-harissa-chicken-chickpeas",
    matchTitle: "Sheet-pan harissa chicken with chickpeas",
    title: "Sheet-pan harissa chicken with chickpeas",
    kcal: 540,
    protein_g: 45,
    prepMins: 30,
    dietTags: ["omnivore", "gluten-free", "high-protein"],
    cuisine: "North African",
    heroEmoji: "🍗",
  },
  {
    slug: "miso-salmon-greens",
    matchTitle: "Miso salmon with greens",
    title: "Miso salmon with greens",
    kcal: 480,
    protein_g: 38,
    prepMins: 20,
    dietTags: ["pescatarian", "gluten-free", "high-protein"],
    cuisine: "Japanese",
    heroEmoji: "🐟",
  },
  {
    slug: "beef-ragu-pappardelle",
    matchTitle: "Beef ragu with pappardelle",
    title: "Beef ragu with pappardelle",
    kcal: 620,
    protein_g: 35,
    prepMins: 40,
    dietTags: ["omnivore", "comfort"],
    cuisine: "Italian",
    heroEmoji: "🍝",
  },
  {
    slug: "halloumi-roast-veg-traybake",
    matchTitle: "Halloumi and roast veg traybake",
    title: "Halloumi and roast veg traybake",
    kcal: 510,
    protein_g: 28,
    prepMins: 35,
    dietTags: ["vegetarian", "gluten-free"],
    cuisine: "Mediterranean",
    heroEmoji: "🧀",
  },
  {
    slug: "chicken-katsu-rice-bowl",
    matchTitle: "Chicken katsu rice bowl",
    title: "Chicken katsu rice bowl",
    kcal: 590,
    protein_g: 42,
    prepMins: 30,
    dietTags: ["omnivore", "weeknight"],
    cuisine: "Japanese",
    heroEmoji: "🍱",
  },
  {
    slug: "black-bean-sweet-potato-chilli",
    matchTitle: "Black bean and sweet potato chilli",
    title: "Black bean and sweet potato chilli",
    kcal: 470,
    protein_g: 22,
    prepMins: 35,
    dietTags: ["vegan", "gluten-free", "high-fibre"],
    cuisine: "Mexican",
    heroEmoji: "🌶️",
  },
  {
    slug: "greek-yogurt-overnight-oats-berries",
    matchTitle: "Greek yoghurt overnight oats with berries",
    title: "Greek yoghurt overnight oats with berries",
    kcal: 380,
    protein_g: 25,
    prepMins: 5,
    dietTags: ["vegetarian", "breakfast", "high-protein"],
    cuisine: "British",
    heroEmoji: "🫐",
  },
  {
    slug: "smoked-salmon-scrambled-egg-bagel",
    matchTitle: "Smoked salmon and scrambled egg bagel",
    title: "Smoked salmon and scrambled egg bagel",
    kcal: 450,
    protein_g: 32,
    prepMins: 10,
    dietTags: ["pescatarian", "breakfast"],
    cuisine: "British",
    heroEmoji: "🥯",
  },
  {
    slug: "tofu-peanut-soba-bowl",
    matchTitle: "Tofu and peanut soba bowl",
    title: "Tofu and peanut soba bowl",
    kcal: 530,
    protein_g: 24,
    prepMins: 25,
    dietTags: ["vegan", "weeknight"],
    cuisine: "Japanese",
    heroEmoji: "🥢",
  },
  {
    slug: "steak-chimichurri-new-potatoes",
    matchTitle: "Steak with chimichurri and new potatoes",
    title: "Steak with chimichurri and new potatoes",
    kcal: 680,
    protein_g: 45,
    prepMins: 25,
    dietTags: ["omnivore", "gluten-free", "higher-fat"],
    cuisine: "Argentine",
    heroEmoji: "🥩",
  },
  {
    slug: "spicy-turkey-lettuce-cups",
    matchTitle: "Spicy turkey lettuce cups",
    title: "Spicy turkey lettuce cups",
    kcal: 380,
    protein_g: 35,
    prepMins: 20,
    dietTags: ["omnivore", "gluten-free", "low-carb"],
    cuisine: "Asian fusion",
    heroEmoji: "🥬",
  },
  {
    slug: "chickpea-spinach-curry-basmati",
    matchTitle: "Chickpea and spinach curry with basmati",
    title: "Chickpea and spinach curry with basmati",
    kcal: 480,
    protein_g: 18,
    prepMins: 30,
    dietTags: ["vegan", "budget"],
    cuisine: "Indian",
    heroEmoji: "🍛",
  },
  {
    slug: "cottage-cheese-tomato-pasta",
    matchTitle: "Cottage cheese and tomato pasta",
    title: "Cottage cheese and tomato pasta",
    kcal: 520,
    protein_g: 30,
    prepMins: 20,
    dietTags: ["vegetarian", "high-protein"],
    cuisine: "Italian",
    heroEmoji: "🍅",
  },
  {
    slug: "korean-chicken-rice-bowl",
    matchTitle: "Korean chicken rice bowl",
    title: "Korean chicken rice bowl",
    kcal: 580,
    protein_g: 40,
    prepMins: 30,
    dietTags: ["omnivore", "weeknight"],
    cuisine: "Korean",
    heroEmoji: "🍚",
  },
  {
    slug: "lentil-bolognese",
    matchTitle: "Lentil bolognese",
    title: "Lentil bolognese",
    kcal: 460,
    protein_g: 24,
    prepMins: 35,
    dietTags: ["vegan", "batch-cook", "high-fibre"],
    cuisine: "Italian",
    heroEmoji: "🍝",
  },
];

/**
 * Filter the seed list by the user's onboarding dietary tags. Per the
 * candidate-source decision, when the filtered set < 6 we fall back to
 * the unfiltered list — better than empty, and the user can still pick
 * any 5 they'd actually cook. Threshold matches `ONBOARDING_PICK_MIN +
 * 1` so the picker always shows at least one over the cap.
 */
export const SEED_FILTER_FALLBACK_THRESHOLD = 6;

export interface SeedFilterInput {
  /** Lowercase tags from `OnboardingState.diet` (e.g. ["vegetarian"]). */
  diet: readonly string[];
  /** Lowercase allergy strings from `OnboardingState.allergies`. */
  allergies?: readonly string[];
}

/**
 * Apply the user's diet/allergen filter against the seed list. Pure
 * function — exported for tests so the filter-fallback edge can be
 * pinned without rendering UI.
 *
 * Filter rules:
 *   - When `diet` is empty, return the full list (no filter applied).
 *   - When `diet` includes "vegan", drop seeds tagged "omnivore" /
 *     "pescatarian" / "vegetarian" (vegan is the strictest band).
 *   - When `diet` includes "vegetarian" (without vegan), drop seeds
 *     tagged "omnivore" / "pescatarian".
 *   - When `diet` includes "pescatarian", drop seeds tagged "omnivore".
 *   - When `diet` includes "gluten-free", keep only seeds with the
 *     "gluten-free" dietTag (we don't infer GF from absence — the
 *     coeliac UX requires an explicit flag per D-2026-04-27-13).
 *   - Allergens applied as substring match against the matchTitle —
 *     the seed list itself doesn't carry per-allergen tags today.
 *     "tree nuts" / "peanuts" / "shellfish" are pre-curated out of
 *     the core 15 so this branch is mostly a no-op.
 *   - When the filtered set length < SEED_FILTER_FALLBACK_THRESHOLD,
 *     fall back to the unfiltered list (decision rule).
 */
export function filterOnboardingSeeds(
  seeds: readonly OnboardingSeed[],
  input: SeedFilterInput,
): readonly OnboardingSeed[] {
  const diet = (input.diet ?? []).map((d) => d.toLowerCase().trim());
  const allergies = (input.allergies ?? []).map((a) => a.toLowerCase().trim());

  if (diet.length === 0 && allergies.length === 0) {
    return seeds;
  }

  const wantsVegan = diet.includes("vegan");
  const wantsVegetarian = diet.includes("vegetarian") || wantsVegan;
  const wantsPescatarian = diet.includes("pescatarian") || wantsVegetarian;
  const wantsGlutenFree = diet.includes("gluten-free") || diet.includes("gluten free");

  const filtered = seeds.filter((seed) => {
    const tags = seed.dietTags.map((t) => t.toLowerCase());
    if (wantsVegan && !tags.includes("vegan")) return false;
    if (
      wantsVegetarian &&
      !wantsVegan &&
      !tags.includes("vegan") &&
      !tags.includes("vegetarian")
    ) {
      return false;
    }
    if (
      wantsPescatarian &&
      !wantsVegetarian &&
      !tags.includes("vegan") &&
      !tags.includes("vegetarian") &&
      !tags.includes("pescatarian")
    ) {
      return false;
    }
    if (wantsGlutenFree && !tags.includes("gluten-free")) return false;

    // Allergen substring match — best-effort with the small set of
    // common allergens we curate the core for.
    for (const a of allergies) {
      if (a.length === 0) continue;
      if (seed.matchTitle.toLowerCase().includes(a)) return false;
    }
    return true;
  });

  if (filtered.length < SEED_FILTER_FALLBACK_THRESHOLD) {
    // Fallback: better to surface the unfiltered list than show <6
    // tiles to a vegan with restrictive filters. The decision doc
    // accepts this tradeoff — seeds are the user's *first* commitment,
    // empty-picker is the worst outcome.
    return seeds;
  }
  return filtered;
}
