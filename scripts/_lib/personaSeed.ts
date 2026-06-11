/**
 * Synthetic-persona seeding — pure, testable core.
 *
 * `scripts/seed-persona.mts` is the thin Supabase-facing entry; everything
 * that can be reasoned about without a live database lives here so it can be
 * unit-tested in isolation (see `tests/unit/personaSeed.test.ts`):
 *
 *   - the HARD ACCOUNT ALLOWLIST guard (the safety-critical bit — never let a
 *     seed/wipe run against a real account),
 *   - the persona roster definitions (data shape per persona), and
 *   - the deterministic row-shaping functions that turn a persona + a target
 *     user id + an anchor date into the exact rows the entry script inserts.
 *
 * Determinism: every shaping function takes the anchor date explicitly and uses
 * a seeded PRNG keyed on (persona, dayOffset), so the same inputs always yield
 * the same rows. No `Math.random`, no bare `new Date()` inside the shapers —
 * that keeps the unit tests stable across calendar days and lets `--dry-run`
 * print exactly what a real run would write.
 *
 * Provenance for the data shapes:
 *   - `docs/growth/tiktok-instagram-viral-plan.md` (MFP-refugee + recipe-saver
 *     audience),
 *   - `docs/ux/research/2026-06-10-adaptive-tdee-review.md` (the real
 *     partial-day pattern that dragged adaptive TDEE to 1,314 — the
 *     lazy-partial-logger mirrors it),
 *   - `docs/ux/research/2026-06-10-tdee-methodology-survey.md` (the
 *     watch-athlete / wearable-energy cohort).
 */

// ---------------------------------------------------------------------------
// 1. ACCOUNT ALLOWLIST — the safety-critical guard.
// ---------------------------------------------------------------------------

/**
 * The ONLY email shapes this seeder may ever touch. Two families:
 *   - `gracehowse+<anything>@outlook.com` — the plus-addressed test inboxes
 *     (the bare `gracehowse@outlook.com` is NOT matched: the regex requires a
 *     `+` sub-address).
 *   - dedicated throwaway test domains (seznam / newacct) Grace stood up for
 *     non-Gmail-style providers.
 *
 * Anything else — and in particular the two real daily-driver accounts
 * (`gracehowse@outlook.com` bare and `gracemturner@hotmail.co.uk`) — is
 * rejected by `assertSeedableEmail` before any database call is made.
 */
export const PERSONA_ALLOWLIST_PATTERNS: readonly RegExp[] = [
  // Plus-addressed Outlook test inboxes. The `\+.+` makes the sub-address
  // mandatory, so the bare account can never match.
  /^gracehowse\+.+@outlook\.com$/i,
  // Dedicated test accounts on alternate providers.
  /^gracehowse\+.+@seznam\.cz$/i,
  /^suppr\.newacct\+.+@gmail\.com$/i,
];

/**
 * Accounts that must NEVER be seeded or wiped, even by accident. These are
 * checked FIRST and produce a distinct, louder error — they are Grace's real
 * data (the TDEE forensic review confirmed `gracemturner@hotmail.co.uk` holds
 * her live daily-driver rows; `gracehowse@outlook.com` bare is her other real
 * account). Belt-and-braces on top of the allowlist: even if a future edit
 * loosens a pattern, these stay forbidden.
 */
export const PERSONA_FORBIDDEN_EMAILS: readonly string[] = [
  "gracehowse@outlook.com",
  "gracemturner@hotmail.co.uk",
];

export type AllowlistVerdict =
  | { ok: true; email: string }
  | { ok: false; email: string; reason: string };

/**
 * Decide whether an email is safe to seed against. Pure — no I/O, no throw —
 * so it can be exhaustively unit-tested. The entry script calls
 * `assertSeedableEmail` (the throwing wrapper) at the top, before it ever
 * constructs a Supabase client.
 */
export function classifyEmail(rawEmail: string): AllowlistVerdict {
  const email = String(rawEmail ?? "").trim();
  if (!email) {
    return { ok: false, email, reason: "empty email" };
  }
  const lower = email.toLowerCase();

  // Forbidden list wins over everything.
  if (PERSONA_FORBIDDEN_EMAILS.some((f) => f.toLowerCase() === lower)) {
    return {
      ok: false,
      email,
      reason: `FORBIDDEN account (${email}) — this is a real Suppr account and must never be seeded or wiped`,
    };
  }

  if (PERSONA_ALLOWLIST_PATTERNS.some((re) => re.test(email))) {
    return { ok: true, email };
  }

  return {
    ok: false,
    email,
    reason: `${email} is not on the persona test-account allowlist (expected gracehowse+<tag>@outlook.com or a dedicated test account)`,
  };
}

/**
 * Throwing wrapper for the entry script. Returns the normalised email on
 * success; throws a descriptive Error otherwise. The seeder calls this BEFORE
 * resolving a user id or opening any DB connection — blast radius is bounded at
 * the door.
 */
export function assertSeedableEmail(rawEmail: string): string {
  const verdict = classifyEmail(rawEmail);
  if (!verdict.ok) {
    throw new Error(`[seed-persona] refusing to run: ${verdict.reason}`);
  }
  return verdict.email;
}

// ---------------------------------------------------------------------------
// 2. PERSONA ROSTER — data shape definitions.
// ---------------------------------------------------------------------------

export type PersonaName =
  | "mfp-refugee-power-logger"
  | "instagram-recipe-saver"
  | "lazy-partial-logger"
  | "watch-athlete"
  | "cold-start-newcomer";

export type DayKind =
  /** A plausibly complete day (≥ ~1,000 kcal across ≥ 2 entries). */
  | "full"
  /** A partial day — a single snack or two, well under a full day. */
  | "partial"
  /** No entries at all (a genuine gap). */
  | "empty";

export type PersonaProfile = {
  goal: "cut" | "maintain" | "bulk"; // DB vocabulary (goalEditorPace.ts:41)
  activity_level: "sedentary" | "light" | "moderate" | "active" | "very_active"; // tdee.ts ActivityLevel
  sex: "female" | "male";
  age: number;
  height_cm: number;
  /** Starting weight at the OLDEST seeded day; the series trends from here. */
  start_weight_kg: number;
  /** kg/day applied across the window (signed; negative = losing). */
  weight_trend_kg_per_day: number;
  goal_weight_kg: number | null;
  /** Daily calorie target for the account (drives the Today ring). */
  target_calories: number;
  target_protein: number;
  target_carbs: number;
  target_fat: number;
  display_name: string;
  onboarding_completed: boolean;
};

export type PersonaDefinition = {
  name: PersonaName;
  /** One-line identity used in dry-run output + session reports. */
  headline: string;
  /** Total days of history to lay down (anchor day inclusive, going back). */
  historyDays: number;
  /**
   * How many weigh-ins fall inside the window. Spread roughly evenly across
   * `historyDays`; the shaper picks the exact days deterministically.
   */
  weighIns: number;
  /** How many library recipes (saved/imported) the account starts with. */
  libraryRecipes: number;
  profile: PersonaProfile;
  /**
   * Day-kind for each offset from the anchor (index 0 = anchor/"today",
   * index N = N days ago). Length must equal `historyDays`. This is the
   * load-bearing behavioural signature — e.g. the lazy logger's partial-day
   * cadence mirrors the real series in the TDEE review.
   */
  dayKinds: DayKind[];
};

/** Build a day-kind array of `len` "full" days. */
function allFull(len: number): DayKind[] {
  return Array.from({ length: len }, () => "full" as DayKind);
}

/**
 * The lazy-partial-logger's day cadence, modelled on the real 28-day series in
 * `docs/ux/research/2026-06-10-adaptive-tdee-review.md` §2 (7 partial days, 3
 * zero days, the rest full). Index 0 is the anchor day. This is the pattern
 * that, pre-R1-gate, dragged adaptive TDEE from ~1,675 down to 1,314 — the
 * persona exists to keep that surface honest as the gate evolves.
 */
const LAZY_LOGGER_DAY_KINDS: DayKind[] = [
  "full", // 0  anchor (today)
  "full", // 1
  "partial", // 2  single snack
  "empty", // 3
  "partial", // 4
  "full", // 5
  "full", // 6
  "full", // 7
  "full", // 8
  "partial", // 9
  "empty", // 10
  "full", // 11
  "full", // 12
  "full", // 13
  "full", // 14
  "partial", // 15
  "partial", // 16
  "full", // 17
  "full", // 18
  "full", // 19
  "partial", // 20
  "empty", // 21
  "full", // 22
  "full", // 23
  "partial", // 24
  "full", // 25
  "full", // 26
  "full", // 27
];

export const PERSONAS: Record<PersonaName, PersonaDefinition> = {
  "mfp-refugee-power-logger": {
    name: "mfp-refugee-power-logger",
    headline:
      "Ex-MyFitnessPal power user, 4 years of disciplined logging, switched after the paywall — expects complete diaries and trustworthy macros.",
    historyDays: 21,
    weighIns: 9,
    libraryRecipes: 4,
    // Dense, complete logging — this cohort logs every meal, every day.
    dayKinds: allFull(21),
    profile: {
      goal: "cut",
      activity_level: "moderate",
      sex: "female",
      age: 34,
      height_cm: 168,
      start_weight_kg: 72.0,
      weight_trend_kg_per_day: -0.02, // ~0.14 kg/week, a clean deficit
      goal_weight_kg: 65,
      target_calories: 1850,
      target_protein: 140,
      target_carbs: 170,
      target_fat: 60,
      display_name: "Power Logger (persona)",
      onboarding_completed: true,
    },
  },

  "instagram-recipe-saver": {
    name: "instagram-recipe-saver",
    headline:
      "Saves cooking Reels constantly, came for the recipe-import magic moment — logs loosely, judges the app on whether saved recipes turn into a real plan.",
    historyDays: 14,
    weighIns: 4,
    libraryRecipes: 9, // recipe-heavy — the whole point of the account
    // Logs when she cooks something from the app; gaps on takeaway days.
    dayKinds: [
      "full",
      "full",
      "partial",
      "full",
      "empty",
      "full",
      "full",
      "partial",
      "full",
      "full",
      "empty",
      "full",
      "partial",
      "full",
    ],
    profile: {
      goal: "maintain",
      activity_level: "light",
      sex: "female",
      age: 28,
      height_cm: 165,
      start_weight_kg: 63.0,
      weight_trend_kg_per_day: 0.0,
      goal_weight_kg: null,
      target_calories: 2050,
      target_protein: 110,
      target_carbs: 230,
      target_fat: 70,
      display_name: "Recipe Saver (persona)",
      onboarding_completed: true,
    },
  },

  "lazy-partial-logger": {
    name: "lazy-partial-logger",
    headline:
      "Logs breakfast, forgets the rest — the real partial-day pattern that dragged adaptive TDEE to 1,314. Expects the number to be trustworthy DESPITE the gaps.",
    historyDays: 28,
    weighIns: 6, // sparse weigh-ins, exactly like the forensic series
    libraryRecipes: 2,
    dayKinds: LAZY_LOGGER_DAY_KINDS,
    profile: {
      goal: "cut",
      activity_level: "light",
      sex: "female",
      age: 31,
      height_cm: 157,
      start_weight_kg: 54.4, // the forensic review's actual start weight
      weight_trend_kg_per_day: 0.021, // +0.6 kg across 28 days while "eating 1,369"
      goal_weight_kg: 52,
      target_calories: 1450,
      target_protein: 100,
      target_carbs: 140,
      target_fat: 50,
      display_name: "Partial Logger (persona)",
      onboarding_completed: true,
    },
  },

  "watch-athlete": {
    name: "watch-athlete",
    headline:
      "Wears an Apple Watch, trains 5x/week, high + variable burn — expects the calorie target to respond to activity and the maintenance estimate to respect their watch.",
    historyDays: 21,
    weighIns: 10, // weighs in most days
    libraryRecipes: 5,
    dayKinds: allFull(21),
    profile: {
      goal: "maintain",
      activity_level: "active",
      sex: "male",
      age: 29,
      height_cm: 182,
      start_weight_kg: 81.0,
      weight_trend_kg_per_day: 0.0,
      goal_weight_kg: null,
      target_calories: 2900, // higher target — large active male
      target_protein: 190,
      target_carbs: 320,
      target_fat: 95,
      display_name: "Watch Athlete (persona)",
      onboarding_completed: true,
    },
  },

  "cold-start-newcomer": {
    name: "cold-start-newcomer",
    headline:
      "Brand-new account, no history — judges the app on the empty-state experience and whether the first log is obvious. The hardest first impression to get right.",
    historyDays: 0, // no journal history at all
    weighIns: 0,
    libraryRecipes: 0,
    dayKinds: [],
    profile: {
      goal: "cut",
      activity_level: "sedentary",
      sex: "female",
      age: 26,
      height_cm: 170,
      start_weight_kg: 78.0,
      weight_trend_kg_per_day: 0.0,
      goal_weight_kg: 70,
      target_calories: 1600,
      target_protein: 120,
      target_carbs: 150,
      target_fat: 53,
      display_name: "Newcomer (persona)",
      // The newcomer has NOT finished onboarding — that's the whole point.
      onboarding_completed: false,
    },
  },
};

export function getPersona(name: string): PersonaDefinition {
  const p = (PERSONAS as Record<string, PersonaDefinition>)[name];
  if (!p) {
    throw new Error(
      `[seed-persona] unknown persona "${name}". Known: ${Object.keys(PERSONAS).join(", ")}`,
    );
  }
  return p;
}

// ---------------------------------------------------------------------------
// 3. DETERMINISTIC ROW SHAPING.
// ---------------------------------------------------------------------------

/**
 * A tag stamped on every seeded row's free-text field so a `--reset` can
 * remove exactly (and only) this framework's rows, and a human reading the
 * diary can tell synthetic data from real. Scoped by user_id in every delete
 * regardless, but the tag is a second layer of intent.
 */
export const PERSONA_ROW_TAG = "PERSONA:";

/** Small deterministic string hash → 32-bit unsigned int. */
function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Seeded PRNG (mulberry32). Deterministic per seed — used to give meals
 * believable per-day variation (a 1,850-target day might log 1,790 or 1,910)
 * without ever calling `Math.random`. Same persona + same day offset → same
 * numbers, every run.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** YYYY-MM-DD for `anchor` shifted back by `dayOffset` days (UTC-stable). */
export function dateKeyForOffset(anchorDateKey: string, dayOffset: number): string {
  const [y, m, d] = anchorDateKey.split("-").map((n) => Number(n));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() - dayOffset);
  const yy = dt.getUTCFullYear();
  const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dt.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export type SeededNutritionEntry = {
  user_id: string;
  date_key: string;
  /** Canonical meal slot — `nutrition_entries.name`. */
  name: "Breakfast" | "Lunch" | "Snacks" | "Dinner";
  recipe_title: string;
  time_label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number;
  portion_multiplier: number;
  source: string;
};

type MealTemplate = {
  slot: SeededNutritionEntry["name"];
  title: string;
  time_label: string;
  /** Fraction of the day's calorie budget this meal carries. */
  share: number;
};

/** A believable four-slot day: breakfast / lunch / dinner / snack. */
const FULL_DAY_MEALS: MealTemplate[] = [
  { slot: "Breakfast", title: "Greek yogurt, oats & berries", time_label: "08:00", share: 0.25 },
  { slot: "Lunch", title: "Chicken & rice bowl", time_label: "12:45", share: 0.32 },
  { slot: "Dinner", title: "Salmon, potatoes & greens", time_label: "19:15", share: 0.33 },
  { slot: "Snacks", title: "Apple & peanut butter", time_label: "16:00", share: 0.1 },
];

/** A partial day: a single small snack — the under-logged signature. */
const PARTIAL_DAY_MEALS: MealTemplate[] = [
  { slot: "Breakfast", title: "Flat white & banana", time_label: "08:30", share: 1.0 },
];

/**
 * Shape the nutrition entries for one day. Returns `[]` for an empty day.
 * Macro split is roughly 30P / 40C / 30F by calories, jittered deterministically
 * so two days never read identically but the same seed always reproduces.
 */
export function shapeDayEntries(
  persona: PersonaDefinition,
  userId: string,
  anchorDateKey: string,
  dayOffset: number,
): SeededNutritionEntry[] {
  const kind = persona.dayKinds[dayOffset] ?? "empty";
  if (kind === "empty") return [];

  const dateKey = dateKeyForOffset(anchorDateKey, dayOffset);
  const rng = mulberry32(hashString(`${persona.name}:${dayOffset}`));

  // Full days vary ±6% around target; partial days are a fixed small amount
  // (the forensic partials averaged ~537 kcal).
  const dayKcal =
    kind === "full"
      ? Math.round(persona.profile.target_calories * (0.94 + rng() * 0.12))
      : Math.round(380 + rng() * 320); // 380–700 kcal partial

  const meals = kind === "full" ? FULL_DAY_MEALS : PARTIAL_DAY_MEALS;

  return meals.map((meal) => {
    const kcal = Math.round(dayKcal * meal.share);
    // 30/40/30 kcal split → grams (4/4/9 kcal per g).
    const protein = Math.round((kcal * 0.3) / 4);
    const carbs = Math.round((kcal * 0.4) / 4);
    const fat = Math.round((kcal * 0.3) / 9);
    const fiber = Math.max(1, Math.round(carbs * 0.08));
    return {
      user_id: userId,
      date_key: dateKey,
      name: meal.slot,
      recipe_title: `${PERSONA_ROW_TAG} ${meal.title}`,
      time_label: meal.time_label,
      calories: kcal,
      protein,
      carbs,
      fat,
      fiber_g: fiber,
      portion_multiplier: 1,
      source: "manual",
    };
  });
}

/** All nutrition entries across the persona's whole window. */
export function shapeAllEntries(
  persona: PersonaDefinition,
  userId: string,
  anchorDateKey: string,
): SeededNutritionEntry[] {
  const out: SeededNutritionEntry[] = [];
  for (let offset = 0; offset < persona.historyDays; offset++) {
    out.push(...shapeDayEntries(persona, userId, anchorDateKey, offset));
  }
  return out;
}

/**
 * The `weight_kg_by_day` JSON blob: a sparse map of date_key → kg. Weigh-ins
 * are spread roughly evenly across the window and the weight trends linearly
 * from `start_weight_kg` (oldest day) toward the anchor at
 * `weight_trend_kg_per_day`. Deterministic — the chosen weigh-in offsets and
 * the (small) per-reading jitter are seeded.
 */
export function shapeWeightByDay(
  persona: PersonaDefinition,
  anchorDateKey: string,
): Record<string, number> {
  const out: Record<string, number> = {};
  const { weighIns, historyDays } = persona;
  if (weighIns <= 0 || historyDays <= 0) return out;

  const rng = mulberry32(hashString(`${persona.name}:weight`));
  const { start_weight_kg, weight_trend_kg_per_day } = persona.profile;

  // Evenly spaced offsets across [0, historyDays-1], oldest → newest.
  const offsets: number[] = [];
  for (let i = 0; i < weighIns; i++) {
    const frac = weighIns === 1 ? 0 : i / (weighIns - 1);
    offsets.push(Math.round((historyDays - 1) * (1 - frac))); // newest-first
  }

  for (const offset of offsets) {
    const dateKey = dateKeyForOffset(anchorDateKey, offset);
    // Days elapsed since the oldest day = (historyDays-1 - offset).
    const daysElapsed = historyDays - 1 - offset;
    const base = start_weight_kg + weight_trend_kg_per_day * daysElapsed;
    const jitter = (rng() - 0.5) * 0.3; // ±0.15 kg water-weight noise
    out[dateKey] = Math.round((base + jitter) * 10) / 10;
  }
  return out;
}

export type SeededRecipe = {
  /** Stable per-(persona,index) id so re-runs upsert rather than duplicate. */
  title: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number;
  servings: number;
  cuisine: string;
  source_name: string;
  meal_type: string[];
};

const RECIPE_LIBRARY: SeededRecipe[] = [
  { title: "Crispy gochujang tofu bowl", calories: 540, protein: 28, carbs: 62, fat: 20, fiber_g: 9, servings: 2, cuisine: "Korean", source_name: "Instagram Reel", meal_type: ["dinner"] },
  { title: "High-protein overnight oats", calories: 410, protein: 32, carbs: 48, fat: 11, fiber_g: 8, servings: 1, cuisine: "American", source_name: "TikTok", meal_type: ["breakfast"] },
  { title: "Sheet-pan harissa chicken", calories: 620, protein: 48, carbs: 38, fat: 30, fiber_g: 7, servings: 4, cuisine: "Middle Eastern", source_name: "Instagram Reel", meal_type: ["dinner"] },
  { title: "Cottage-cheese pasta", calories: 480, protein: 30, carbs: 64, fat: 12, fiber_g: 5, servings: 2, cuisine: "Italian", source_name: "TikTok", meal_type: ["lunch", "dinner"] },
  { title: "Green smoothie that actually tastes good", calories: 280, protein: 24, carbs: 34, fat: 6, fiber_g: 7, servings: 1, cuisine: "American", source_name: "Instagram Reel", meal_type: ["breakfast", "snack"] },
  { title: "Smashed chickpea salad sandwich", calories: 450, protein: 18, carbs: 58, fat: 16, fiber_g: 11, servings: 2, cuisine: "American", source_name: "TikTok", meal_type: ["lunch"] },
  { title: "Miso-butter salmon", calories: 560, protein: 42, carbs: 12, fat: 38, fiber_g: 2, servings: 2, cuisine: "Japanese", source_name: "Instagram Reel", meal_type: ["dinner"] },
  { title: "Protein banana bread", calories: 230, protein: 12, carbs: 30, fat: 7, fiber_g: 3, servings: 8, cuisine: "American", source_name: "TikTok", meal_type: ["snack"] },
  { title: "One-pan creamy tuscan gnocchi", calories: 590, protein: 22, carbs: 70, fat: 26, fiber_g: 5, servings: 3, cuisine: "Italian", source_name: "Instagram Reel", meal_type: ["dinner"] },
];

/** The first N recipes from the library — deterministic per persona count. */
export function shapeRecipes(persona: PersonaDefinition): SeededRecipe[] {
  return RECIPE_LIBRARY.slice(0, persona.libraryRecipes);
}

export type SeedPlan = {
  email: string;
  persona: PersonaName;
  userId: string;
  anchorDateKey: string;
  entries: SeededNutritionEntry[];
  weightByDay: Record<string, number>;
  recipes: SeededRecipe[];
  profile: PersonaProfile;
  counts: {
    fullDays: number;
    partialDays: number;
    emptyDays: number;
    totalEntries: number;
    weighIns: number;
    recipes: number;
  };
};

/**
 * Assemble the full seed plan for a persona. Pure — this is exactly what
 * `--dry-run` prints and what the live path inserts, so the dry-run can never
 * diverge from the real write.
 */
export function buildSeedPlan(
  persona: PersonaDefinition,
  email: string,
  userId: string,
  anchorDateKey: string,
): SeedPlan {
  const entries = shapeAllEntries(persona, userId, anchorDateKey);
  const weightByDay = shapeWeightByDay(persona, anchorDateKey);
  const recipes = shapeRecipes(persona);

  let fullDays = 0;
  let partialDays = 0;
  let emptyDays = 0;
  for (const kind of persona.dayKinds) {
    if (kind === "full") fullDays++;
    else if (kind === "partial") partialDays++;
    else emptyDays++;
  }

  return {
    email,
    persona: persona.name,
    userId,
    anchorDateKey,
    entries,
    weightByDay,
    recipes,
    profile: persona.profile,
    counts: {
      fullDays,
      partialDays,
      emptyDays,
      totalEntries: entries.length,
      weighIns: Object.keys(weightByDay).length,
      recipes: recipes.length,
    },
  };
}
