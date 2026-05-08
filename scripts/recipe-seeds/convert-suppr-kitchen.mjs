#!/usr/bin/env node
/**
 * Convert the 63-recipe Suppr Kitchen library (SQLite shape) into a
 * Postgres migration that wipes existing platform-curated recipes and
 * inserts the new set as `source_name = 'Suppr Kitchen'`,
 * `author_id = NULL`, `published = true`.
 *
 * Source SQL: the recipes.sql produced by the recipe-library generator.
 * Target: supabase/migrations/<timestamp>_replace_recipes_with_suppr_kitchen.sql
 *
 * Run:
 *   node scripts/recipe-seeds/convert-suppr-kitchen.mjs \
 *     "/path/to/recipes.sql" \
 *     "supabase/migrations/20260514100000_replace_recipes_with_suppr_kitchen.sql"
 *
 * Field mapping (SQLite → Postgres `public.recipes`):
 *   title           → title
 *   description     → description
 *   cuisine         → cuisine (normalised to one of italian/asian/
 *                     mediterranean/mexican/indian/american/
 *                     middle-eastern/other)
 *   course          → meal_type text[] (breakfast/lunch/dinner/snack)
 *   prep_minutes    → prep_time_min
 *   cook_minutes    → cook_time_min
 *   servings        → servings
 *   calories        → calories
 *   protein_g       → protein
 *   carbs_g         → carbs
 *   fat_g           → fat
 *   fiber_g         → fiber_g
 *   sugar_g         → sugar_g
 *   sodium_mg       → sodium_mg
 *   ingredients[]   → public.recipe_ingredients rows
 *   steps[]         → joined into instructions (numbered, newline-sep)
 *   tags[]          → dietary jsonb + allergens text[] when matched
 *   equipment[]     → dropped (no analog)
 *   images[]        → dropped (no files; image_url left NULL)
 *
 * `source_name = 'Suppr Kitchen'` is the brand attribution Grace
 * picked for now (memo: app might rebrand later, attribution can be
 * remapped via a one-line UPDATE).
 */
import fs from "node:fs";

const [, , inPath, outPath] = process.argv;
if (!inPath || !outPath) {
  console.error(
    "Usage: node convert-suppr-kitchen.mjs <input.sql> <output.sql>",
  );
  process.exit(2);
}
const SRC = fs.readFileSync(inPath, "utf8");

// ─── Parse the SQLite SQL ──────────────────────────────────────────────

/**
 * Tokenise SQL VALUES (...) with proper string handling. Returns an
 * array of values; strings keep their surrounding quotes stripped and
 * escaped quotes (`''`) collapsed; NULL becomes JS null; bare numbers
 * stay numeric; everything else is left as a string.
 */
function parseValues(s) {
  const out = [];
  let i = 0;
  while (i < s.length) {
    // Skip whitespace, commas, and stray top-level `)` (the outer regex
    // strips the outermost parens but balanced subqueries can leave
    // unmatched closers in the values text).
    while (i < s.length && /[\s,)]/.test(s[i])) i++;
    if (i >= s.length) break;
    if (s[i] === "'") {
      // String — handle '' as embedded quote.
      let str = "";
      i++;
      while (i < s.length) {
        if (s[i] === "'" && s[i + 1] === "'") {
          str += "'";
          i += 2;
        } else if (s[i] === "'") {
          i++;
          break;
        } else {
          str += s[i];
          i++;
        }
      }
      out.push(str);
    } else if (s[i] === "(") {
      // Balanced parenthesised expression — capture raw (e.g. SELECT
      // subquery used to resolve a recipe id by slug).
      let depth = 1;
      let str = "(";
      i++;
      while (i < s.length && depth > 0) {
        if (s[i] === "'") {
          str += s[i];
          i++;
          while (i < s.length) {
            if (s[i] === "'" && s[i + 1] === "'") {
              str += "''";
              i += 2;
            } else if (s[i] === "'") {
              str += s[i];
              i++;
              break;
            } else {
              str += s[i];
              i++;
            }
          }
        } else {
          if (s[i] === "(") depth++;
          else if (s[i] === ")") depth--;
          str += s[i];
          i++;
        }
      }
      out.push(str);
    } else {
      let tok = "";
      while (i < s.length && !",)".includes(s[i])) {
        tok += s[i];
        i++;
      }
      tok = tok.trim();
      if (!tok.length) continue;
      if (/^null$/i.test(tok)) out.push(null);
      else if (/^-?\d+(?:\.\d+)?$/.test(tok)) out.push(Number(tok));
      else out.push(tok);
    }
  }
  return out;
}

/**
 * Find every INSERT INTO <table> (col, …) VALUES (…); statement and
 * yield {table, cols, values}.
 */
function* iterInserts(src) {
  const re =
    /INSERT\s+(?:OR\s+IGNORE\s+)?INTO\s+(\w+)\s*\(([^)]+)\)\s*VALUES\s*\((.*?)\);/gis;
  let m;
  while ((m = re.exec(src)) !== null) {
    const [, table, colList, valList] = m;
    const cols = colList.split(",").map((c) => c.trim());
    const values = parseValues(valList);
    yield { table, cols, values };
  }
}

/**
 * Materialise rows by joining values to columns.
 */
function rowOf({ cols, values }) {
  const row = {};
  for (let i = 0; i < cols.length; i++) row[cols[i]] = values[i];
  return row;
}

// ─── Build the in-memory recipe model ──────────────────────────────────

const recipes = new Map(); // slug → recipe model

// First pass: recipes only.
for (const ins of iterInserts(SRC)) {
  if (ins.table !== "recipes") continue;
  const r = rowOf(ins);
  recipes.set(r.slug, {
    slug: r.slug,
    title: r.title,
    description: r.description,
    cuisine: r.cuisine,
    course: r.course,
    difficulty: r.difficulty,
    prep_minutes: r.prep_minutes ?? 0,
    cook_minutes: r.cook_minutes ?? 0,
    servings: r.servings ?? 1,
    calories: r.calories,
    protein_g: r.protein_g,
    carbs_g: r.carbs_g,
    fat_g: r.fat_g,
    fiber_g: r.fiber_g,
    sugar_g: r.sugar_g,
    sodium_mg: r.sodium_mg,
    ingredients: [],
    steps: [],
    tags: new Set(),
  });
}

// Second pass: child rows. The SQLite SQL uses SELECT id FROM recipes
// WHERE slug = '…' inside child INSERTs. We don't care about the
// resolution — we just need to pull the slug literal out of the column
// containing it, regardless of its position. Easier to re-scan with a
// custom regex per child table.

function recipeByChildInsert(s) {
  const m = /WHERE\s+slug\s*=\s*'([^']+)'/i.exec(s);
  return m ? recipes.get(m[1]) : null;
}

for (const ins of iterInserts(SRC)) {
  if (ins.table === "ingredients") {
    const recipe = recipeByChildInsert(ins.values.join("|"));
    if (!recipe) continue;
    // Skip the recipe-resolver column; the rest follows the SQLite
    // schema order: position, quantity, unit, item, note, section.
    // The first value is the (SELECT id …) string — drop it.
    const [, position, quantity, unit, item, note, section] = ins.values;
    recipe.ingredients.push({
      position: Number(position),
      quantity: quantity ?? null,
      unit: unit ?? null,
      item: item ?? "",
      note: note ?? null,
      section: section ?? null,
    });
  } else if (ins.table === "steps") {
    const recipe = recipeByChildInsert(ins.values.join("|"));
    if (!recipe) continue;
    const [, position, instruction] = ins.values;
    recipe.steps.push({
      position: Number(position),
      instruction: instruction ?? "",
    });
  } else if (ins.table === "recipe_tags") {
    // Form: VALUES ((SELECT id FROM recipes WHERE slug='…'),
    //                (SELECT id FROM tags WHERE name='…'))
    // ins.values has both subqueries as raw strings. Pull both names
    // out via regex.
    const blob = ins.values.map((v) => String(v ?? "")).join("|");
    const slugMatch = /recipes\s+WHERE\s+slug\s*=\s*'([^']+)'/i.exec(blob);
    const tagMatch = /tags\s+WHERE\s+name\s*=\s*'([^']+)'/i.exec(blob);
    if (!slugMatch || !tagMatch) continue;
    const recipe = recipes.get(slugMatch[1]);
    if (!recipe) continue;
    recipe.tags.add(tagMatch[1]);
  }
}

// Sort children by position.
for (const r of recipes.values()) {
  r.ingredients.sort((a, b) => a.position - b.position);
  r.steps.sort((a, b) => a.position - b.position);
}

console.error(`Parsed ${recipes.size} recipes`);

// ─── Field normalisation ───────────────────────────────────────────────

const CUISINE_MAP = {
  american: "american",
  "american-inspired": "american",
  italian: "italian",
  "italian-american": "italian",
  "italian-inspired": "italian",
  mexican: "mexican",
  "mexican-inspired": "mexican",
  "mexican-american": "mexican",
  indian: "indian",
  "indian-inspired": "indian",
  thai: "asian",
  korean: "asian",
  "chinese-american": "asian",
  "chinese-inspired": "asian",
  "japanese-inspired": "asian",
  "asian-inspired": "asian",
  mediterranean: "mediterranean",
  "mediterranean-inspired": "mediterranean",
  greek: "mediterranean",
  "middle eastern": "middle-eastern",
  cafe: "other",
  european: "other",
  "hawaiian-inspired": "other",
  international: "other",
};

function normaliseCuisine(raw) {
  if (!raw) return "other";
  const key = String(raw).toLowerCase().trim();
  return CUISINE_MAP[key] ?? "other";
}

function mealTypeFromCourse(course) {
  switch ((course || "").toLowerCase()) {
    case "breakfast":
      return ["breakfast"];
    case "main":
    case "soup":
      return ["lunch", "dinner"];
    case "side":
      return ["lunch", "dinner"];
    case "salad":
      return ["lunch"];
    case "dessert":
    case "drink":
    case "snack":
      return ["snack"];
    default:
      return ["lunch", "dinner"];
  }
}

// Allergen detection — purely keyword-based on combined ingredient text.
// 8 conventional allergen buckets matching the existing dataset.
const ALLERGEN_RULES = [
  {
    key: "dairy",
    re: /\b(milk|butter|cream|cheese|yogurt|yoghurt|feta|parmesan|mozzarella|pecorino|cheddar|sour cream|cottage cheese|halloumi|ricotta|ghee|buttermilk)\b/i,
  },
  {
    key: "gluten",
    re: /\b(flour|bread|pasta|sourdough|noodles?|tortilla|panko|breadcrumbs?|spaghetti|linguine|pappardelle|fettuccine|tonnarelli|couscous|naan|bun|graham|wheat)\b/i,
  },
  { key: "egg", re: /\beggs?\b|egg yolks?|egg whites?/i },
  {
    key: "fish",
    re: /\b(fish|salmon|tuna|cod|mahi-mahi|anchov[yi])\b/i,
  },
  { key: "shellfish", re: /\b(shrimp|prawn|crab|lobster|scallop)\b/i },
  { key: "peanut", re: /\bpeanut/i },
  {
    key: "tree-nuts",
    re: /\b(almond|walnut|pecan|cashew|pine nuts|hazelnut|pistachio)\b/i,
  },
  {
    key: "soy",
    re: /\b(soy sauce|tofu|edamame|miso|tamari|tempeh)\b|\bsoy\b/i,
  },
  { key: "sesame", re: /\bsesame|tahini\b/i },
];

function detectAllergens(ingredients) {
  const blob = ingredients.map((i) => `${i.item} ${i.note ?? ""}`).join(" ");
  const out = new Set();
  for (const rule of ALLERGEN_RULES) {
    if (rule.re.test(blob)) out.add(rule.key);
  }
  return [...out].sort();
}

// Dietary tags from the SQL `tags` table — keep only the meaningful ones.
const DIETARY_TAGS = new Set([
  "vegan",
  "vegetarian",
  "gluten-free",
  "dairy-free",
  "low-carb",
  "low-fat",
  "low-sodium",
  "high-protein",
  "high-fiber",
  "pescatarian",
  "weight-loss",
  "post-workout",
  "kid-friendly",
  "comfort-food",
  "freezer-friendly",
  "make-ahead",
  "no-cook",
  "one-pan",
  "meal-prep",
]);

function dietaryFlagsFromTags(tags) {
  const out = {};
  for (const t of tags) {
    if (DIETARY_TAGS.has(t)) out[t] = true;
  }
  return out;
}

function buildInstructions(steps) {
  return steps
    .map((s, i) => `${i + 1}. ${s.instruction}`)
    .join("\n\n");
}

// ─── Postgres SQL emission ─────────────────────────────────────────────

function pgString(v) {
  if (v == null) return "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function pgArray(arr) {
  if (!arr || !arr.length) return "ARRAY[]::text[]";
  return `ARRAY[${arr.map(pgString).join(",")}]::text[]`;
}

function pgJsonb(obj) {
  if (!obj) return "NULL";
  const json = JSON.stringify(obj);
  return `'${json.replace(/'/g, "''")}'::jsonb`;
}

function pgNumber(v, fallback = 0) {
  if (v == null || Number.isNaN(Number(v))) return String(fallback);
  return String(Number(v));
}

const lines = [];
lines.push(`-- 20260514100000_replace_recipes_with_suppr_kitchen.sql`);
lines.push(`--`);
lines.push(
  `-- Replace all platform-curated recipes (author_id IS NULL) with the`,
);
lines.push(
  `-- 63-recipe Suppr Kitchen library. User-authored recipes are left`,
);
lines.push(`-- alone.`);
lines.push(`--`);
lines.push(
  `-- Generated by scripts/recipe-seeds/convert-suppr-kitchen.mjs.`,
);
lines.push(`-- Source: outputs/recipe-library/recipes.sql.`);
lines.push(`--`);
lines.push(
  `-- Apply: \`supabase db push --linked\` (per CLAUDE.md, never via MCP).`,
);
lines.push(``);
lines.push(`begin;`);
lines.push(``);
lines.push(`-- 1. Wipe the existing platform-curated set.`);
lines.push(
  `--    Cascades through recipe_ingredients, saves, recipe_cook_history,`,
);
lines.push(
  `--    user_recipe_notes, recipe_plan_add_events. Sets household_meals`,
);
lines.push(`--    + app_notifications recipe_id to NULL (per FK rule).`);
lines.push(`delete from public.recipes where author_id is null;`);
lines.push(``);
lines.push(`-- 2. Insert the 63 Suppr Kitchen recipes.`);
lines.push(``);

// Sort by slug so the migration is reproducible.
const slugs = [...recipes.keys()].sort();
for (const slug of slugs) {
  const r = recipes.get(slug);
  const cuisine = normaliseCuisine(r.cuisine);
  const mealTypes = mealTypeFromCourse(r.course);
  const dietary = dietaryFlagsFromTags([...r.tags]);
  const allergens = detectAllergens(r.ingredients);
  const instructions = buildInstructions(r.steps);

  lines.push(
    `-- ── ${r.title}`,
  );
  lines.push(
    `with new_recipe as (
  insert into public.recipes (
    title, description, cuisine, meal_type, allergens, dietary,
    prep_time_min, cook_time_min, servings,
    calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg,
    instructions, image_url, source_name, source_url,
    author_id, creator_id, published, is_verified
  ) values (
    ${pgString(r.title)},
    ${pgString(r.description)},
    ${pgString(cuisine)},
    ${pgArray(mealTypes)},
    ${pgArray(allergens)},
    ${pgJsonb(dietary)},
    ${pgNumber(r.prep_minutes, 0)},
    ${pgNumber(r.cook_minutes, 0)},
    ${pgNumber(r.servings, 1)},
    ${pgNumber(r.calories, 0)},
    ${pgNumber(r.protein_g, 0)},
    ${pgNumber(r.carbs_g, 0)},
    ${pgNumber(r.fat_g, 0)},
    ${pgNumber(r.fiber_g, 0)},
    ${pgNumber(r.sugar_g, 0)},
    ${pgNumber(r.sodium_mg, 0)},
    ${pgString(instructions)},
    NULL,
    'Suppr Kitchen',
    NULL,
    NULL, NULL, true, true
  )
  returning id
)`,
  );

  if (r.ingredients.length === 0) {
    lines.push(`select 1 from new_recipe;`);
  } else {
    lines.push(
      `insert into public.recipe_ingredients (recipe_id, name, amount, unit, source, is_verified)`,
    );
    lines.push(`select new_recipe.id, x.name, x.amount, x.unit, x.source, false`);
    lines.push(`from new_recipe, (values`);
    const valueRows = r.ingredients.map((ing) => {
      // SQLite quantity is text ("1 1/2", "2-3", null) — try to coerce
      // to a leading numeric for `amount`. When the leading token is a
      // mixed number ("1 1/2") or a range ("2-3"), fall back to null
      // and surface the raw text in `unit` so the UI can render the
      // verbal hint without inventing a number.
      const rawQty = ing.quantity == null ? null : String(ing.quantity).trim();
      let amount = null;
      let unit = ing.unit == null ? null : String(ing.unit);
      if (rawQty) {
        const fracMatch = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(
          rawQty,
        );
        const mixedMatch = /^(\d+)\s+(\d+)\s*\/\s*(\d+)$/.exec(rawQty);
        if (mixedMatch) {
          amount =
            Number(mixedMatch[1]) +
            Number(mixedMatch[2]) / Number(mixedMatch[3]);
        } else if (fracMatch) {
          amount = Number(fracMatch[1]) / Number(fracMatch[2]);
        } else if (/^-?\d+(?:\.\d+)?$/.test(rawQty)) {
          amount = Number(rawQty);
        } else if (/^\d+\s*-\s*\d+$/.test(rawQty)) {
          // Range — take the midpoint.
          const [lo, hi] = rawQty.split("-").map((s) => Number(s.trim()));
          amount = (lo + hi) / 2;
        } else {
          // Token like "to taste" or odd shape — leave amount NULL and
          // prepend the raw quantity into the unit hint.
          unit = unit ? `${rawQty} ${unit}` : rawQty;
        }
      }
      const fullName = ing.section
        ? `${ing.item}${ing.note ? ` (${ing.note})` : ""}  [${ing.section}]`
        : `${ing.item}${ing.note ? ` (${ing.note})` : ""}`;
      return `    (${pgString(fullName)}, ${amount == null ? "NULL" : amount}, ${pgString(unit)}, 'suppr-kitchen-seed')`;
    });
    lines.push(valueRows.join(",\n"));
    lines.push(`) as x(name, amount, unit, source);`);
  }
  lines.push(``);
}

lines.push(`commit;`);
lines.push(``);
lines.push(`-- expected post-conditions:`);
lines.push(
  `--   select count(*) from public.recipes where source_name = 'Suppr Kitchen' = 63`,
);
lines.push(
  `--   select count(*) from public.recipes where author_id is null = 63`,
);

fs.writeFileSync(outPath, lines.join("\n"));
console.error(`Wrote ${outPath} (${lines.length} lines)`);
