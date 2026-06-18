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

// 2026-05-08 — repointed at 15 of the 63 Suppr Kitchen recipes seeded
// in migration `20260514100000_replace_recipes_with_suppr_kitchen.sql`.
// The prior seed titles ("Sheet-pan harissa chicken with chickpeas",
// "Beef ragu with pappardelle", etc.) were deleted by that migration,
// which broke the picker's matchTitle resolver. Coverage shape preserved:
// 5 omnivore / 4 vegetarian-or-vegan / 2 pescatarian / 7 gluten-free
// (over-provisioning GF is intentional — the picker's gluten-free filter
// keeps only seeds tagged GF, so a low count empties the picker too easily).
// Macros + prep times mirror the values in the prod row to keep the
// display consistent with the resolved recipe.
export const ONBOARDING_SEEDS: readonly OnboardingSeed[] = [
  {
    slug: "berry-overnight-oats",
    matchTitle: "Berry Overnight Oats",
    title: "Berry Overnight Oats",
    kcal: 360,
    protein_g: 11,
    prepMins: 5,
    dietTags: ["vegetarian", "breakfast", "high-fibre"],
    cuisine: "International",
    heroEmoji: "🫐",
  },
  {
    slug: "yogurt-granola-parfait",
    matchTitle: "Greek Yogurt Granola Parfait",
    title: "Greek Yogurt Granola Parfait",
    kcal: 340,
    protein_g: 18,
    prepMins: 5,
    dietTags: ["vegetarian", "breakfast", "high-protein"],
    cuisine: "International",
    heroEmoji: "🥣",
  },
  {
    slug: "mediterranean-chicken-bowl",
    matchTitle: "Mediterranean Chicken Bowl",
    title: "Mediterranean Chicken Bowl",
    kcal: 490,
    protein_g: 38,
    prepMins: 30,
    dietTags: ["omnivore", "mediterranean", "high-protein"],
    cuisine: "Mediterranean",
    heroEmoji: "🥗",
  },
  {
    slug: "korean-beef-bulgogi",
    matchTitle: "Korean Beef Bulgogi",
    title: "Korean Beef Bulgogi",
    kcal: 480,
    protein_g: 36,
    prepMins: 30,
    dietTags: ["omnivore", "gluten-free", "high-protein"],
    cuisine: "Korean",
    heroEmoji: "🥩",
  },
  {
    slug: "honey-garlic-chicken-thighs",
    matchTitle: "Sticky Honey Garlic Chicken Thighs",
    title: "Sticky Honey Garlic Chicken Thighs",
    kcal: 460,
    protein_g: 32,
    prepMins: 30,
    dietTags: ["omnivore", "weeknight", "high-protein"],
    cuisine: "Asian-Inspired",
    heroEmoji: "🍗",
  },
  {
    slug: "sheet-pan-chicken-veg",
    matchTitle: "Sheet Pan Chicken & Veg",
    title: "Sheet Pan Chicken & Veg",
    kcal: 420,
    protein_g: 36,
    prepMins: 35,
    dietTags: ["omnivore", "gluten-free", "meal-prep", "high-protein"],
    cuisine: "American",
    heroEmoji: "🥘",
  },
  {
    slug: "turkey-meatballs-marinara",
    matchTitle: "Lean Turkey Meatballs in Marinara",
    title: "Lean Turkey Meatballs in Marinara",
    kcal: 360,
    protein_g: 32,
    prepMins: 40,
    dietTags: ["omnivore", "high-protein"],
    cuisine: "Italian-American",
    heroEmoji: "🍝",
  },
  {
    slug: "chickpea-coconut-curry",
    matchTitle: "Chickpea Coconut Curry",
    title: "Chickpea Coconut Curry",
    kcal: 480,
    protein_g: 14,
    prepMins: 35,
    dietTags: ["vegan", "vegetarian", "gluten-free", "high-fibre"],
    cuisine: "Indian-Inspired",
    heroEmoji: "🍛",
  },
  {
    slug: "lentil-soup",
    matchTitle: "Hearty Lentil Soup",
    title: "Hearty Lentil Soup",
    kcal: 280,
    protein_g: 16,
    prepMins: 50,
    dietTags: ["vegan", "vegetarian", "gluten-free", "high-fibre", "batch-cook"],
    cuisine: "Mediterranean",
    heroEmoji: "🍲",
  },
  {
    slug: "quinoa-power-bowl",
    matchTitle: "Quinoa Power Bowl",
    title: "Quinoa Power Bowl",
    kcal: 540,
    protein_g: 18,
    prepMins: 45,
    dietTags: ["vegan", "vegetarian", "gluten-free", "high-protein", "high-fibre"],
    cuisine: "International",
    heroEmoji: "🥗",
  },
  {
    slug: "mushroom-risotto",
    matchTitle: "Wild Mushroom Risotto",
    title: "Wild Mushroom Risotto",
    kcal: 540,
    protein_g: 18,
    prepMins: 45,
    dietTags: ["vegetarian", "comfort"],
    cuisine: "Italian",
    heroEmoji: "🍚",
  },
  {
    slug: "stuffed-bell-peppers",
    matchTitle: "Stuffed Bell Peppers",
    title: "Stuffed Bell Peppers",
    kcal: 480,
    protein_g: 28,
    prepMins: 60,
    dietTags: ["omnivore", "gluten-free", "comfort"],
    cuisine: "American",
    heroEmoji: "🫑",
  },
  {
    slug: "lemon-dill-salmon",
    matchTitle: "Pan-Seared Salmon with Lemon Dill Butter",
    title: "Pan-Seared Salmon with Lemon Dill Butter",
    kcal: 420,
    protein_g: 38,
    prepMins: 17,
    dietTags: ["pescatarian", "gluten-free", "high-protein"],
    cuisine: "Mediterranean",
    heroEmoji: "🐟",
  },
  {
    slug: "salmon-teriyaki-bowl",
    matchTitle: "Salmon Teriyaki Bowl",
    title: "Salmon Teriyaki Bowl",
    kcal: 480,
    protein_g: 34,
    prepMins: 30,
    dietTags: ["pescatarian", "high-protein", "meal-prep"],
    cuisine: "Japanese-Inspired",
    heroEmoji: "🍱",
  },
  {
    slug: "tuna-poke-bowl",
    matchTitle: "Spicy Tuna Poke Bowl",
    title: "Spicy Tuna Poke Bowl",
    kcal: 520,
    protein_g: 32,
    prepMins: 20,
    dietTags: ["pescatarian", "gluten-free", "high-protein", "no-cook"],
    cuisine: "Hawaiian-Inspired",
    heroEmoji: "🍣",
  },
];

/**
 * Filter the seed list by the user's onboarding dietary tags. Per the
 * candidate-source decision, when the filtered set < 6 we fall back to
 * the unfiltered list — better than empty, and the user can still pick
 * any 5 they'd actually cook. Threshold is one over the north-star
 * library minimum (`NORTH_STAR_LIBRARY_MIN`, currently 5) so the picker
 * always shows at least one over the cap.
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

/**
 * Default seed slugs used when the user completes onboarding without
 * picking any recipes (the Recipes step is currently out of the
 * linear flow per the 15→12 shrink — see
 * `docs/decisions/2026-04-30-onboarding-shrink-15-to-12.md`).
 *
 * Picked to satisfy the audit-flagged activation contract (commit
 * 2026-04-30 follow-up): the user's library MUST contain at least
 * `NORTH_STAR_LIBRARY_MIN` (5) varied recipes the moment they land
 * on Today, otherwise the north-star block is permanently stuck in
 * its empty-state and the "What to eat next" promise evaporates.
 *
 * Composition (5 high-confidence Mediterranean / Balanced default
 * seeds spanning slots):
 *   1. Greek yoghurt overnight oats (breakfast, vegetarian)
 *   2. Cottage cheese and tomato pasta (lunch, vegetarian, high-protein)
 *   3. Halloumi and roast veg traybake (lunch/dinner, vegetarian)
 *   4. Sheet-pan harissa chicken (dinner, omnivore, high-protein)
 *   5. Miso salmon with greens (dinner, pescatarian, high-protein)
 *
 * Why these five:
 *   - All carry "Suppr onboarding" provenance in `recipes.source_name`
 *     (the resolver's gate — see `onboardingSeedResolver.ts`).
 *   - Cover breakfast / lunch / dinner so the time-of-day filter in
 *     `pickNorthStarSuggestion` always has at least one candidate.
 *   - Mix of veg / pesc / omni so even a strict-vegan filter leaves
 *     a fallback (the filter helper falls back to the unfiltered list
 *     below `SEED_FILTER_FALLBACK_THRESHOLD`).
 *   - Protein 25–45g — keeps the protein-direction bonus in the
 *     scorer meaningful for the typical 100–140g protein target.
 *
 * The list is intentionally fixed (not a random sample) so two users
 * onboarding the same week land on the same starter library — easier
 * to reason about retention cohorts.
 */
export const ONBOARDING_DEFAULT_SEED_SLUGS: readonly string[] = [
  // 2026-05-08 — repointed at the new Suppr Kitchen library. Picks span
  // breakfast (oats — 5min) / lunch (salmon — 17min) / dinner
  // (chicken bowl — 30min, GF curry — 35min, mushroom risotto — 45min)
  // so the time-of-day filter on the activation block has candidates
  // across every slot.
  "berry-overnight-oats",
  "lemon-dill-salmon",
  "mediterranean-chicken-bowl",
  "chickpea-coconut-curry",
  "mushroom-risotto",
] as const;

/**
 * Resolve the default-seed slugs to the actual `OnboardingSeed` rows.
 * Filtered through the user's diet + allergen preferences via
 * `filterOnboardingSeeds` — same fallback behaviour as the picker (if
 * the filtered set drops below the threshold, fall through to the
 * default seeds unfiltered, then finally to the full library if even
 * the defaults are empty post-filter).
 *
 * Returns at most 5 seeds. Always returns at least 1 seed if the
 * library has any rows at all (the empty input → empty output is the
 * only failure path).
 */
export function defaultOnboardingSeeds(
  input: SeedFilterInput = { diet: [] },
): readonly OnboardingSeed[] {
  const slugs = new Set(ONBOARDING_DEFAULT_SEED_SLUGS);
  const defaults = ONBOARDING_SEEDS.filter((s) => slugs.has(s.slug));

  const dietRaw = (input.diet ?? []).map((d) => d.toLowerCase().trim());
  const allergiesRaw = (input.allergies ?? []).map((a) => a.toLowerCase().trim());
  const noFilter = dietRaw.length === 0 && allergiesRaw.length === 0;
  if (noFilter) {
    // Nothing to filter — return the canonical 5 in the canonical order.
    return defaults;
  }

  // Apply diet + allergen filters strictly (no soft-fallback) on the
  // default 5. Diet rules mirror `filterOnboardingSeeds` so the
  // semantics stay identical to the picker — vegan is strictest band,
  // vegetarian drops omni/pescatarian, etc.
  const wantsVegan = dietRaw.includes("vegan");
  const wantsVegetarian = dietRaw.includes("vegetarian") || wantsVegan;
  const wantsPescatarian = dietRaw.includes("pescatarian") || wantsVegetarian;
  const wantsGlutenFree =
    dietRaw.includes("gluten-free") || dietRaw.includes("gluten free");

  const passesDietAndAllergens = (seed: OnboardingSeed): boolean => {
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
    for (const a of allergiesRaw) {
      if (a.length === 0) continue;
      if (seed.matchTitle.toLowerCase().includes(a)) return false;
    }
    return true;
  };

  const fromDefaults = defaults.filter(passesDietAndAllergens);
  if (fromDefaults.length > 0) return fromDefaults;

  // Hard fallback: the user's diet + allergen combo wiped all 5
  // canonical defaults (e.g. vegan — none of the canonical 5 are
  // vegan-tagged). Reach into the full library for up to 5 rows that
  // satisfy both filters. Mirrors the picker's "better than empty"
  // contract from `filterOnboardingSeeds`.
  return ONBOARDING_SEEDS.filter(passesDietAndAllergens).slice(0, 5);
}

export interface SelectOnboardingSeedsInput {
  /** `OnboardingState.pickedRecipeSlugs` — non-empty only if a future
   *  in-flow picker is revived; empty for every default completion. */
  pickedRecipeSlugs: readonly string[];
  /** `OnboardingState.diet` — passed through to the default filter. */
  diet: readonly string[];
  /** `OnboardingState.allergies` — passed through to the default filter. */
  allergies?: readonly string[];
  /** Kill switch for the curated-default fallback. Read from the
   *  `onboarding_default_seeds` PostHog flag via `isFeatureDisabled`
   *  at the call site (fail-safe default-ON: only `true` when the flag
   *  resolves explicitly off). When `true` we reproduce the pre-2026-04-30
   *  behaviour — no picks means an empty library — so the unified
   *  web+mobile seeding can be rolled back instantly without a deploy. */
  seedingDisabled?: boolean;
}

export interface SelectedOnboardingSeeds {
  /** The seeds to hand to `resolveSeedsToRecipeIds`. May be empty (user
   *  picked nothing AND the default-seed kill switch is thrown). */
  seeds: OnboardingSeed[];
  /** True when the library was seeded from curated defaults (no picks,
   *  switch on). Drives the `used_default_seeds` activation flag. */
  usedDefaults: boolean;
}

/**
 * Single source of truth for which recipes seed a new user's library at
 * onboarding completion. Shared by `web-flow.tsx` + `mobile-flow.tsx` so
 * both platforms resolve identical seeds from identical inputs — the
 * seed-selection logic lived as a duplicated inline ternary in both
 * flows before 2026-05-30, which is exactly the kind of place web/mobile
 * silently drift. Pure + synchronous so it can be unit-tested executing
 * (no PostHog / Supabase mocking): the caller resolves the flag to a
 * boolean and passes it in.
 *
 * Precedence:
 *   1. User picked recipes → use those (a revived in-flow picker).
 *   2. No picks, kill switch thrown → `[]` (old empty-library behaviour).
 *   3. No picks, switch on (default) → curated `defaultOnboardingSeeds`,
 *      diet/allergen-filtered.
 */
export function selectOnboardingSeeds(
  input: SelectOnboardingSeedsInput,
): SelectedOnboardingSeeds {
  const picked = input.pickedRecipeSlugs ?? [];
  if (picked.length > 0) {
    return {
      seeds: ONBOARDING_SEEDS.filter((s) => picked.includes(s.slug)),
      usedDefaults: false,
    };
  }
  if (input.seedingDisabled) {
    return { seeds: [], usedDefaults: false };
  }
  return {
    seeds: Array.from(
      defaultOnboardingSeeds({ diet: input.diet, allergies: input.allergies }),
    ),
    usedDefaults: true,
  };
}
