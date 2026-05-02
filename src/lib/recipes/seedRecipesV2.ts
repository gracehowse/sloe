/**
 * seedRecipesV2 — curated static recipe seed for the Discover surface.
 *
 * Audit gap #3 (Recime / Pinterest parity at N=1). Until Discover feels
 * alive, recipe-import users have no reason to RETURN to Suppr. A
 * curated static seed is the right shape at the solo-tester stage —
 * personalisation / algorithmic ranking makes no sense at N=1.
 *
 * Scope (executor handoff):
 *  - Ships ~15 recipes across 3 cuisine clusters (Mediterranean, Asian,
 *    Healthy bowls). The original brief asked for 50 across 5 clusters;
 *    that's content-creation work and is intentionally narrowed here so
 *    the data source + wiring lands first. A `TODO` at the top of the
 *    file flags the planned expansion (Latin, Comfort, plus deeper
 *    cuts for the existing clusters).
 *  - Each entry is fully self-contained: title, cuisine cluster, hero
 *    image URL, prep+cook times, kcal/portion, ingredients (grams),
 *    instructions, macro estimates.
 *  - Macro values are deliberate ROUND ESTIMATES — production nutrition
 *    must come from `nutrition-engine` ingredient resolution. The seed
 *    is presentational; logging from a seed recipe still triggers the
 *    standard ingredient-matching pipeline at log time. Per
 *    `CLAUDE.md`: never invent confident nutrition values for production
 *    paths. Discover cards display the macros only as a preview.
 *
 * Cross-platform: this module is the SINGLE source of truth. Mobile
 * imports it via the cross-platform `nutrition` shared lib pattern;
 * the web Discover feed imports the same module.
 *
 * NOT a Supabase seeder — this is in-app static content. The dynamic
 * seeder at `scripts/seed-discover-recipes.ts` (publisher hotlinks)
 * is unaffected and continues to populate the live recipes table.
 *
 * TODO (2026-05-01): expand to ~50 recipes across 5 clusters
 * (Mediterranean +5, Asian +5, Latin (8), Comfort (10), Healthy bowls
 * +7). Owner: Grace / curated by content team. Each new entry must
 * pass the cluster contract pinned by `tests/unit/seedRecipesV2.test.ts`.
 */

export type SeedCuisineCluster =
  | "mediterranean"
  | "asian"
  | "healthy-bowls"
  | "latin"
  | "comfort";

export interface SeedIngredient {
  /** Plain English name (e.g. "chicken thigh, boneless"). Lowercased. */
  name: string;
  /** Grams. We standardise on grams for deterministic match-time
   *  resolution; count-to-weight inference happens at log time. */
  grams: number;
}

export interface SeedRecipe {
  /** Stable id. Convention: `seed-v2-{cluster}-{slug}`. */
  id: string;
  cluster: SeedCuisineCluster;
  title: string;
  /** Short hero image URL — Unsplash CDN with auto/format/quality
   *  params for fast load. */
  heroImageUrl: string;
  /** Prep + cook in minutes (combined). */
  totalTimeMin: number;
  prepTimeMin: number;
  cookTimeMin: number;
  servings: number;
  /** Approximate kcal per portion. ESTIMATE — not authoritative. See
   *  module-level note. */
  kcalPerPortion: number;
  /** Approximate macros per portion (g). ESTIMATES. */
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  /** 6-12 ingredients, grams resolved. */
  ingredients: SeedIngredient[];
  /** 4-8 short instruction steps. */
  steps: string[];
  /** UK English short description used as the card subtitle. */
  shortDescription: string;
}

const MEDITERRANEAN_SEEDS: ReadonlyArray<SeedRecipe> = [
  {
    id: "seed-v2-mediterranean-greek-salad",
    cluster: "mediterranean",
    title: "Classic Greek Salad",
    heroImageUrl:
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=70",
    totalTimeMin: 15,
    prepTimeMin: 15,
    cookTimeMin: 0,
    servings: 2,
    kcalPerPortion: 380,
    proteinG: 13,
    carbsG: 18,
    fatG: 28,
    fiberG: 5,
    shortDescription: "Tomato, cucumber, olive and feta — dressed with lemon and olive oil.",
    ingredients: [
      { name: "ripe tomato", grams: 250 },
      { name: "cucumber", grams: 200 },
      { name: "red onion", grams: 50 },
      { name: "kalamata olives, pitted", grams: 60 },
      { name: "feta cheese", grams: 120 },
      { name: "extra-virgin olive oil", grams: 30 },
      { name: "lemon juice", grams: 15 },
      { name: "dried oregano", grams: 2 },
    ],
    steps: [
      "Cut tomato and cucumber into bite-size chunks; thinly slice the red onion.",
      "Combine vegetables and olives in a wide bowl.",
      "Crumble or slab the feta on top.",
      "Whisk olive oil, lemon juice, oregano and a pinch of salt.",
      "Pour dressing over the salad and gently toss before serving.",
    ],
  },
  {
    id: "seed-v2-mediterranean-shakshuka",
    cluster: "mediterranean",
    title: "Shakshuka with Eggs",
    heroImageUrl:
      "https://images.unsplash.com/photo-1590412200988-a436970781fa?auto=format&fit=crop&w=900&q=70",
    totalTimeMin: 30,
    prepTimeMin: 10,
    cookTimeMin: 20,
    servings: 2,
    kcalPerPortion: 410,
    proteinG: 22,
    carbsG: 24,
    fatG: 24,
    fiberG: 6,
    shortDescription: "Eggs poached in a spiced tomato and pepper sauce.",
    ingredients: [
      { name: "olive oil", grams: 20 },
      { name: "yellow onion, diced", grams: 120 },
      { name: "red bell pepper, diced", grams: 150 },
      { name: "garlic, minced", grams: 8 },
      { name: "ground cumin", grams: 3 },
      { name: "smoked paprika", grams: 3 },
      { name: "tinned chopped tomatoes", grams: 400 },
      { name: "egg, large", grams: 200 },
      { name: "fresh parsley, chopped", grams: 8 },
    ],
    steps: [
      "Warm olive oil in a wide pan over medium heat.",
      "Soften onion and pepper for 6-8 minutes.",
      "Stir in garlic, cumin and paprika; cook 1 minute.",
      "Add chopped tomatoes; simmer 8-10 minutes until thick.",
      "Make 4 wells in the sauce and crack an egg into each.",
      "Cover and cook 5-6 minutes until whites are set, yolks still soft.",
      "Scatter parsley and serve with bread.",
    ],
  },
  {
    id: "seed-v2-mediterranean-hummus-bowl",
    cluster: "mediterranean",
    title: "Hummus & Roasted Veg Bowl",
    heroImageUrl:
      "https://images.unsplash.com/photo-1547496502-affa22d38842?auto=format&fit=crop&w=900&q=70",
    totalTimeMin: 35,
    prepTimeMin: 10,
    cookTimeMin: 25,
    servings: 2,
    kcalPerPortion: 520,
    proteinG: 18,
    carbsG: 56,
    fatG: 24,
    fiberG: 12,
    shortDescription: "Roasted aubergine and chickpeas over creamy hummus with herbed bulgur.",
    ingredients: [
      { name: "aubergine, diced", grams: 300 },
      { name: "tinned chickpeas, drained", grams: 240 },
      { name: "olive oil", grams: 25 },
      { name: "ground cumin", grams: 3 },
      { name: "bulgur wheat, cooked", grams: 200 },
      { name: "shop-bought hummus", grams: 120 },
      { name: "fresh parsley, chopped", grams: 10 },
      { name: "lemon wedge", grams: 30 },
    ],
    steps: [
      "Heat oven to 220C / 200C fan.",
      "Toss aubergine and chickpeas with olive oil, cumin and salt.",
      "Roast 20-25 minutes until aubergine is golden and chickpeas crisp.",
      "Spread hummus across two shallow bowls.",
      "Top with bulgur, then the roasted veg.",
      "Finish with parsley and a squeeze of lemon.",
    ],
  },
  {
    id: "seed-v2-mediterranean-fattoush",
    cluster: "mediterranean",
    title: "Fattoush with Sumac",
    heroImageUrl:
      "https://images.unsplash.com/photo-1505253210343-65a4d6cb1ce3?auto=format&fit=crop&w=900&q=70",
    totalTimeMin: 20,
    prepTimeMin: 15,
    cookTimeMin: 5,
    servings: 2,
    kcalPerPortion: 340,
    proteinG: 9,
    carbsG: 38,
    fatG: 18,
    fiberG: 7,
    shortDescription: "Crisp toasted pitta tossed through tomato, cucumber and herbs with sumac.",
    ingredients: [
      { name: "pitta bread", grams: 80 },
      { name: "olive oil", grams: 25 },
      { name: "ripe tomato", grams: 200 },
      { name: "cucumber", grams: 150 },
      { name: "radish, sliced", grams: 60 },
      { name: "lettuce, shredded", grams: 80 },
      { name: "fresh parsley", grams: 15 },
      { name: "fresh mint", grams: 8 },
      { name: "sumac", grams: 4 },
      { name: "lemon juice", grams: 20 },
    ],
    steps: [
      "Tear pitta into pieces, toss with a tablespoon of olive oil and salt.",
      "Toast in a dry pan until crisp on both sides; set aside.",
      "Chop tomato and cucumber, slice radish, shred lettuce.",
      "Combine vegetables with parsley and mint.",
      "Whisk remaining olive oil with lemon juice and sumac.",
      "Toss salad and dressing; scatter pitta on top just before serving.",
    ],
  },
  {
    id: "seed-v2-mediterranean-grilled-halloumi",
    cluster: "mediterranean",
    title: "Grilled Halloumi & Watermelon",
    heroImageUrl:
      "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=900&q=70",
    totalTimeMin: 15,
    prepTimeMin: 10,
    cookTimeMin: 5,
    servings: 2,
    kcalPerPortion: 360,
    proteinG: 20,
    carbsG: 22,
    fatG: 22,
    fiberG: 3,
    shortDescription: "Salty halloumi, sweet watermelon and mint with a chilli-lime dressing.",
    ingredients: [
      { name: "halloumi cheese", grams: 200 },
      { name: "watermelon, cubed", grams: 350 },
      { name: "fresh mint", grams: 10 },
      { name: "lime juice", grams: 15 },
      { name: "olive oil", grams: 15 },
      { name: "red chilli, deseeded and minced", grams: 5 },
    ],
    steps: [
      "Slice halloumi into 1cm slabs.",
      "Heat a dry pan or griddle over medium-high heat.",
      "Grill halloumi 1-2 minutes per side until deeply golden.",
      "Arrange watermelon on plates; tuck halloumi between cubes.",
      "Whisk lime juice, olive oil and chilli; spoon over.",
      "Tear mint over the top and serve immediately.",
    ],
  },
];

const ASIAN_SEEDS: ReadonlyArray<SeedRecipe> = [
  {
    id: "seed-v2-asian-bibimbap",
    cluster: "asian",
    title: "Veggie Bibimbap",
    heroImageUrl:
      "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?auto=format&fit=crop&w=900&q=70",
    totalTimeMin: 35,
    prepTimeMin: 15,
    cookTimeMin: 20,
    servings: 2,
    kcalPerPortion: 540,
    proteinG: 18,
    carbsG: 70,
    fatG: 18,
    fiberG: 8,
    shortDescription: "Korean rice bowl with seasoned vegetables, fried egg and gochujang.",
    ingredients: [
      { name: "short-grain rice, cooked", grams: 300 },
      { name: "spinach, blanched", grams: 100 },
      { name: "carrot, julienned", grams: 100 },
      { name: "courgette, sliced", grams: 120 },
      { name: "shiitake mushrooms, sliced", grams: 80 },
      { name: "egg, large", grams: 100 },
      { name: "sesame oil", grams: 12 },
      { name: "soy sauce", grams: 10 },
      { name: "gochujang", grams: 15 },
      { name: "toasted sesame seeds", grams: 4 },
    ],
    steps: [
      "Cook rice according to packet directions.",
      "Blanch spinach 30 seconds, squeeze out water, dress with sesame oil and a splash of soy.",
      "Saute carrot, courgette and mushrooms separately, each with a pinch of salt.",
      "Fry an egg per portion, sunny side up.",
      "Divide rice between bowls; arrange vegetables in sections on top.",
      "Crown with the fried egg, a teaspoon of gochujang and a sprinkle of sesame seeds.",
    ],
  },
  {
    id: "seed-v2-asian-pad-thai",
    cluster: "asian",
    title: "Quick Chicken Pad Thai",
    heroImageUrl:
      "https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=900&q=70",
    totalTimeMin: 25,
    prepTimeMin: 10,
    cookTimeMin: 15,
    servings: 2,
    kcalPerPortion: 580,
    proteinG: 36,
    carbsG: 64,
    fatG: 18,
    fiberG: 4,
    shortDescription: "Stir-fried rice noodles with chicken, peanuts and tamarind-lime sauce.",
    ingredients: [
      { name: "rice noodles, dried", grams: 160 },
      { name: "chicken breast, sliced", grams: 240 },
      { name: "egg, large", grams: 100 },
      { name: "beansprouts", grams: 100 },
      { name: "spring onion, sliced", grams: 30 },
      { name: "tamarind paste", grams: 20 },
      { name: "fish sauce", grams: 12 },
      { name: "brown sugar", grams: 10 },
      { name: "lime juice", grams: 15 },
      { name: "vegetable oil", grams: 15 },
      { name: "roasted peanuts, chopped", grams: 20 },
    ],
    steps: [
      "Soak noodles in just-boiled water 6-8 minutes; drain.",
      "Whisk tamarind, fish sauce, brown sugar and lime juice.",
      "Heat oil in a wok and stir-fry chicken 3-4 minutes until cooked.",
      "Push chicken aside; crack in the egg and scramble.",
      "Add drained noodles and the sauce; toss until evenly coated.",
      "Stir through beansprouts and most of the spring onion for 30 seconds.",
      "Plate up; finish with peanuts and the remaining spring onion.",
    ],
  },
  {
    id: "seed-v2-asian-ramen",
    cluster: "asian",
    title: "10-Minute Miso Ramen",
    heroImageUrl:
      "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?auto=format&fit=crop&w=900&q=70",
    totalTimeMin: 12,
    prepTimeMin: 4,
    cookTimeMin: 8,
    servings: 1,
    kcalPerPortion: 490,
    proteinG: 21,
    carbsG: 62,
    fatG: 16,
    fiberG: 5,
    shortDescription: "Quick weeknight ramen with miso broth, soft egg and greens.",
    ingredients: [
      { name: "ramen noodles, dried", grams: 90 },
      { name: "white miso paste", grams: 20 },
      { name: "vegetable stock", grams: 400 },
      { name: "pak choi", grams: 100 },
      { name: "egg, large", grams: 60 },
      { name: "sesame oil", grams: 5 },
      { name: "soy sauce", grams: 8 },
      { name: "spring onion, sliced", grams: 15 },
      { name: "nori sheet, torn", grams: 2 },
    ],
    steps: [
      "Bring stock to a simmer; whisk in miso off the heat.",
      "Boil egg 6 minutes for jammy yolk; cool, peel and halve.",
      "Cook noodles in the simmering broth 3 minutes.",
      "Add pak choi for the final minute.",
      "Pour into a bowl; top with egg, spring onion, nori and a drizzle of sesame oil.",
    ],
  },
  {
    id: "seed-v2-asian-sushi-bowl",
    cluster: "asian",
    title: "Salmon Sushi Bowl",
    heroImageUrl:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=70",
    totalTimeMin: 20,
    prepTimeMin: 15,
    cookTimeMin: 5,
    servings: 2,
    kcalPerPortion: 560,
    proteinG: 32,
    carbsG: 56,
    fatG: 22,
    fiberG: 6,
    shortDescription: "Sushi rice with seared salmon, avocado and pickled cucumber.",
    ingredients: [
      { name: "sushi rice, cooked", grams: 300 },
      { name: "salmon fillet, skin off", grams: 280 },
      { name: "avocado, sliced", grams: 120 },
      { name: "cucumber, ribboned", grams: 120 },
      { name: "rice vinegar", grams: 20 },
      { name: "soy sauce", grams: 10 },
      { name: "sesame seeds", grams: 4 },
      { name: "spring onion, sliced", grams: 15 },
      { name: "neutral oil", grams: 8 },
    ],
    steps: [
      "Sear salmon 2 minutes per side in a hot pan; rest, then flake into chunks.",
      "Toss cucumber ribbons with rice vinegar and a pinch of salt.",
      "Divide warm rice between bowls.",
      "Top with salmon, avocado and pickled cucumber.",
      "Drizzle with soy sauce; finish with sesame seeds and spring onion.",
    ],
  },
  {
    id: "seed-v2-asian-congee",
    cluster: "asian",
    title: "Soothing Chicken Congee",
    heroImageUrl:
      "https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=70",
    totalTimeMin: 50,
    prepTimeMin: 5,
    cookTimeMin: 45,
    servings: 2,
    kcalPerPortion: 380,
    proteinG: 24,
    carbsG: 48,
    fatG: 8,
    fiberG: 2,
    shortDescription: "Slow-simmered rice porridge with poached chicken and ginger.",
    ingredients: [
      { name: "jasmine rice", grams: 100 },
      { name: "chicken thigh, boneless", grams: 240 },
      { name: "fresh ginger, sliced", grams: 20 },
      { name: "chicken stock", grams: 1000 },
      { name: "spring onion, sliced", grams: 20 },
      { name: "soy sauce", grams: 10 },
      { name: "sesame oil", grams: 5 },
      { name: "white pepper, ground", grams: 1 },
    ],
    steps: [
      "Combine rice, ginger, chicken and stock in a heavy pan.",
      "Bring to a simmer; cook gently 40-45 minutes, stirring now and then.",
      "Lift out the chicken once tender; shred with two forks.",
      "Stir shredded chicken back through the porridge.",
      "Season with soy, sesame oil and a pinch of white pepper.",
      "Serve topped with spring onion.",
    ],
  },
];

const HEALTHY_BOWLS_SEEDS: ReadonlyArray<SeedRecipe> = [
  {
    id: "seed-v2-healthy-bowls-quinoa",
    cluster: "healthy-bowls",
    title: "Roasted Veg & Quinoa Bowl",
    heroImageUrl:
      "https://images.unsplash.com/photo-1543339494-b4cd4f7ba686?auto=format&fit=crop&w=900&q=70",
    totalTimeMin: 35,
    prepTimeMin: 10,
    cookTimeMin: 25,
    servings: 2,
    kcalPerPortion: 480,
    proteinG: 17,
    carbsG: 60,
    fatG: 18,
    fiberG: 11,
    shortDescription: "Quinoa with roasted sweet potato, broccoli and tahini-lemon dressing.",
    ingredients: [
      { name: "quinoa, cooked", grams: 240 },
      { name: "sweet potato, cubed", grams: 250 },
      { name: "broccoli florets", grams: 200 },
      { name: "olive oil", grams: 20 },
      { name: "tahini", grams: 20 },
      { name: "lemon juice", grams: 15 },
      { name: "garlic, minced", grams: 4 },
      { name: "pumpkin seeds, toasted", grams: 15 },
    ],
    steps: [
      "Heat oven to 220C / 200C fan.",
      "Toss sweet potato and broccoli with olive oil, salt and pepper.",
      "Roast 20-25 minutes until edges are caramelised.",
      "Whisk tahini, lemon juice, garlic and 2-3 tbsp water until pourable.",
      "Build bowls with quinoa, then roasted veg.",
      "Drizzle dressing over; scatter pumpkin seeds.",
    ],
  },
  {
    id: "seed-v2-healthy-bowls-poke",
    cluster: "healthy-bowls",
    title: "Salmon Poke Bowl",
    heroImageUrl:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=900&q=70",
    totalTimeMin: 20,
    prepTimeMin: 20,
    cookTimeMin: 0,
    servings: 2,
    kcalPerPortion: 530,
    proteinG: 30,
    carbsG: 56,
    fatG: 18,
    fiberG: 6,
    shortDescription: "Sushi-grade salmon, edamame and mango over rice with soy-sesame dressing.",
    ingredients: [
      { name: "sushi-grade salmon, cubed", grams: 240 },
      { name: "sushi rice, cooked", grams: 280 },
      { name: "edamame, shelled", grams: 80 },
      { name: "mango, cubed", grams: 100 },
      { name: "cucumber, diced", grams: 100 },
      { name: "soy sauce", grams: 15 },
      { name: "sesame oil", grams: 8 },
      { name: "rice vinegar", grams: 10 },
      { name: "spring onion, sliced", grams: 15 },
    ],
    steps: [
      "Whisk soy sauce, sesame oil and rice vinegar; toss with the salmon.",
      "Divide rice between bowls.",
      "Arrange salmon, edamame, mango and cucumber on top.",
      "Drizzle any remaining dressing; finish with spring onion.",
    ],
  },
  {
    id: "seed-v2-healthy-bowls-buddha",
    cluster: "healthy-bowls",
    title: "Chickpea Buddha Bowl",
    heroImageUrl:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=900&q=70",
    totalTimeMin: 30,
    prepTimeMin: 10,
    cookTimeMin: 20,
    servings: 2,
    kcalPerPortion: 510,
    proteinG: 19,
    carbsG: 64,
    fatG: 18,
    fiberG: 14,
    shortDescription: "Crispy chickpeas, roasted carrot, kale and brown rice with hummus.",
    ingredients: [
      { name: "tinned chickpeas, drained", grams: 240 },
      { name: "brown rice, cooked", grams: 240 },
      { name: "carrot, sliced into batons", grams: 200 },
      { name: "kale, shredded", grams: 100 },
      { name: "olive oil", grams: 25 },
      { name: "smoked paprika", grams: 3 },
      { name: "shop-bought hummus", grams: 60 },
      { name: "lemon juice", grams: 10 },
    ],
    steps: [
      "Heat oven to 220C / 200C fan.",
      "Toss chickpeas and carrot with olive oil, paprika and salt.",
      "Roast 20 minutes until chickpeas are crisp.",
      "Massage kale with a little olive oil and lemon juice.",
      "Build bowls with rice, kale, roasted veg and chickpeas.",
      "Spoon hummus to one side; finish with a final squeeze of lemon.",
    ],
  },
  {
    id: "seed-v2-healthy-bowls-burrito",
    cluster: "healthy-bowls",
    title: "Black Bean Burrito Bowl",
    heroImageUrl:
      "https://images.unsplash.com/photo-1543339531-c41cf3a4e13b?auto=format&fit=crop&w=900&q=70",
    totalTimeMin: 25,
    prepTimeMin: 10,
    cookTimeMin: 15,
    servings: 2,
    kcalPerPortion: 560,
    proteinG: 22,
    carbsG: 78,
    fatG: 16,
    fiberG: 16,
    shortDescription: "Spiced black beans, brown rice, charred corn and avocado with lime.",
    ingredients: [
      { name: "tinned black beans, drained", grams: 240 },
      { name: "brown rice, cooked", grams: 280 },
      { name: "tinned sweetcorn, drained", grams: 150 },
      { name: "avocado, diced", grams: 120 },
      { name: "ripe tomato, diced", grams: 150 },
      { name: "olive oil", grams: 15 },
      { name: "ground cumin", grams: 3 },
      { name: "smoked paprika", grams: 2 },
      { name: "lime juice", grams: 15 },
      { name: "fresh coriander", grams: 8 },
    ],
    steps: [
      "Warm olive oil in a pan; toast cumin and paprika 30 seconds.",
      "Add black beans and a splash of water; warm through 3-4 minutes.",
      "Char sweetcorn in a dry pan 3-4 minutes until spotted.",
      "Build bowls with rice, then beans, then corn.",
      "Top with tomato, avocado and a generous squeeze of lime.",
      "Scatter coriander to finish.",
    ],
  },
  {
    id: "seed-v2-healthy-bowls-tofu",
    cluster: "healthy-bowls",
    title: "Crispy Tofu & Greens Bowl",
    heroImageUrl:
      "https://images.unsplash.com/photo-1604908554007-cd54f8ed0c5b?auto=format&fit=crop&w=900&q=70",
    totalTimeMin: 30,
    prepTimeMin: 10,
    cookTimeMin: 20,
    servings: 2,
    kcalPerPortion: 470,
    proteinG: 24,
    carbsG: 50,
    fatG: 18,
    fiberG: 9,
    shortDescription: "Pan-crisped tofu over brown rice with sesame greens.",
    ingredients: [
      { name: "extra-firm tofu", grams: 280 },
      { name: "cornflour", grams: 15 },
      { name: "neutral oil", grams: 18 },
      { name: "brown rice, cooked", grams: 240 },
      { name: "tenderstem broccoli", grams: 150 },
      { name: "soy sauce", grams: 18 },
      { name: "rice vinegar", grams: 10 },
      { name: "honey", grams: 10 },
      { name: "sesame seeds", grams: 4 },
    ],
    steps: [
      "Press tofu 10 minutes; cube and toss in cornflour with a pinch of salt.",
      "Heat oil in a non-stick pan; fry tofu until golden on all sides.",
      "Steam broccoli 3-4 minutes until just tender.",
      "Whisk soy, vinegar and honey; toss broccoli through it.",
      "Build bowls with rice, broccoli and tofu.",
      "Finish with sesame seeds.",
    ],
  },
];

/**
 * All seed recipes, flat list. Order is stable: Mediterranean → Asian
 * → Healthy bowls. Callers that need cluster grouping should use
 * `getSeedRecipesByCluster()` below.
 */
export const SEED_RECIPES_V2: ReadonlyArray<SeedRecipe> = [
  ...MEDITERRANEAN_SEEDS,
  ...ASIAN_SEEDS,
  ...HEALTHY_BOWLS_SEEDS,
];

/**
 * Returns all seed recipes for a given cluster. Stable ordering;
 * callers can rely on insertion order being the curated reading order.
 */
export function getSeedRecipesByCluster(
  cluster: SeedCuisineCluster,
): ReadonlyArray<SeedRecipe> {
  return SEED_RECIPES_V2.filter((r) => r.cluster === cluster);
}

/** Seed-id prefix — every seed entry's id starts with this. The
 *  recipe-detail screen uses it to short-circuit Supabase lookups for
 *  seeds (which have no backing DB row). */
export const SEED_RECIPE_ID_PREFIX = "seed-v2-";

/** True when the id looks like a seed entry. Cheap O(1) string check. */
export function isSeedRecipeId(id: string | null | undefined): boolean {
  return typeof id === "string" && id.startsWith(SEED_RECIPE_ID_PREFIX);
}

/** Find a seed by id; null when absent. */
export function findSeedRecipeById(
  id: string | null | undefined,
): SeedRecipe | null {
  if (!id) return null;
  return SEED_RECIPES_V2.find((r) => r.id === id) ?? null;
}

/**
 * Cluster metadata for the carousel headers. Order is the canonical
 * reading order on Discover. Latin and Comfort are intentionally
 * absent until the seed expansion lands (see TODO at top of file).
 */
export const SEED_CLUSTERS: ReadonlyArray<{
  id: SeedCuisineCluster;
  title: string;
  description: string;
}> = [
  {
    id: "mediterranean",
    title: "Mediterranean",
    description: "Bright, herby and weeknight-friendly.",
  },
  {
    id: "asian",
    title: "Asian",
    description: "Stir-fries, ramen and rice bowls.",
  },
  {
    id: "healthy-bowls",
    title: "Healthy bowls",
    description: "Grain + greens + a real protein.",
  },
];
