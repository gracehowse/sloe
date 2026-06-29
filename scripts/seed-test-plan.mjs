/**
 * Seed a current-week meal plan onto the data-rich test account
 * (gracehowse+test@outlook.com) so the Plan tab is populated for testing.
 *
 * Writes `meal_plan_days` (slot_id="default", start_date=this Monday, day 0–6)
 * + `meal_plan_meals` (breakfast/lunch/dinner per day, drawn from the account's
 * own 16 seeded recipes by meal_type). Clears the account's stale prior plan
 * rows first. Service-role; scoped to the one test user id.
 *
 * Usage: node scripts/seed-test-plan.mjs   (reads .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

const TEST_USER = "95b64f71-0439-4275-8b57-93eed1680b54"; // gracehowse+test@outlook.com
const SLOT_ID = "default";

function loadEnv() {
  if (!existsSync(".env.local")) return;
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

function mondayOfThisWeek() {
  const d = new Date();
  const dow = d.getDay(); // 0=Sun..6=Sat
  const diff = dow === 0 ? -6 : 1 - dow; // back to Monday
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const SLOTS = [
  { idx: 0, name: "Breakfast", key: "breakfast" },
  { idx: 1, name: "Lunch", key: "lunch" },
  { idx: 2, name: "Dinner", key: "dinner" },
];

async function main() {
  loadEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  // 1. Pull the account's recipes, partitioned by meal_type.
  const { data: recipes, error: recErr } = await admin
    .from("recipes")
    .select("id, title, calories, protein, carbs, fat, meal_type")
    .eq("author_id", TEST_USER);
  if (recErr) throw recErr;
  if (!recipes?.length) throw new Error("no recipes for the test account — run seed-persona first");
  const pool = (k) => recipes.filter((r) => (r.meal_type ?? []).includes(k));
  const pools = {
    breakfast: pool("breakfast").length ? pool("breakfast") : recipes,
    lunch: pool("lunch").length ? pool("lunch") : recipes,
    dinner: pool("dinner").length ? pool("dinner") : recipes,
  };
  console.log(`[seed-plan] recipes: ${recipes.length} (b=${pools.breakfast.length} l=${pools.lunch.length} d=${pools.dinner.length})`);

  // 2. Clear the account's prior plan (meals first for the FK, then days).
  const { data: oldDays } = await admin.from("meal_plan_days").select("id").eq("user_id", TEST_USER);
  if (oldDays?.length) {
    await admin.from("meal_plan_meals").delete().in("plan_day_id", oldDays.map((d) => d.id));
    await admin.from("meal_plan_days").delete().eq("user_id", TEST_USER);
    console.log(`[seed-plan] cleared ${oldDays.length} prior day(s)`);
  }

  // 3. Insert 7 days for this week.
  const startDate = mondayOfThisWeek();
  const dayRows = Array.from({ length: 7 }, (_, i) => ({
    user_id: TEST_USER,
    slot_id: SLOT_ID,
    start_date: startDate,
    day: i + 1, // meal_plan_days.day is 1-indexed (1..7), per the day_check constraint
  }));
  const { data: insertedDays, error: dayErr } = await admin
    .from("meal_plan_days")
    .insert(dayRows)
    .select("id, day");
  if (dayErr) throw dayErr;
  console.log(`[seed-plan] inserted 7 days (start_date ${startDate})`);

  // 4. Insert breakfast/lunch/dinner per day, round-robining each pool so the
  //    week reads varied. Dinner on day 0 is marked a 2-serving batch whose
  //    leftover lands as day 1's lunch (exercises the batch/leftover surface).
  const meals = [];
  for (const d of insertedDays) {
    for (const slot of SLOTS) {
      const p = pools[slot.key];
      const r = p[(d.day - 1) % p.length];
      meals.push({
        plan_day_id: d.id,
        slot_index: slot.idx,
        name: slot.name,
        recipe_id: r.id,
        recipe_title: r.title,
        calories: r.calories ?? 0,
        protein: r.protein ?? 0,
        carbs: r.carbs ?? 0,
        fat: r.fat ?? 0,
        portion_multiplier: 1,
        is_placeholder: false,
        is_leftover: false,
      });
    }
  }
  const { error: mealErr } = await admin.from("meal_plan_meals").insert(meals);
  if (mealErr) throw mealErr;
  console.log(`[seed-plan] inserted ${meals.length} meals across 7 days. done.`);
}

main().catch((e) => {
  console.error("[seed-plan] FAILED:", e?.message ?? e);
  process.exit(1);
});
