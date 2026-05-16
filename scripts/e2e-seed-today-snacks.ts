/**
 * E2E fixture seeder — Today / Snacks slot.
 *
 * Why: Maestro / Playwright flows that validate the Today Snacks header
 * (PR #246, flag `today_log_usual_row_v2`) depend on a known data state:
 *   - 1 saved meal tagged `default_meal_slot = 'Snacks'` with a
 *     deliberately long name so we can verify truncation + the chip
 *     pushing into a dedicated row instead of crowding the header.
 *   - 2 nutrition_entries on today's date with `name = 'Snacks'` so the
 *     slot renders populated (the empty-state path is a separate flow).
 *
 * Without this, tests depend on whatever live state the E2E user
 * happens to have, which is brittle and gave us the "Snacks section
 * never visible" friction during the PR #246 sweep.
 *
 * Idempotent: tagged with `E2E:` prefix so it can be re-run any number
 * of times. Removes prior `E2E:` fixtures for this user / today before
 * inserting.
 *
 * Scope: ONLY the E2E user (resolved from E2E_EMAIL). The script
 * refuses to run against any other email to keep blast radius bounded.
 *
 * Usage: npx tsx scripts/e2e-seed-today-snacks.ts [--clean]
 *   --clean : remove fixtures and exit (no insert)
 *
 * Requires .env.local with:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY (bypasses RLS)
 *   E2E_EMAIL (target user, e.g. gracemturner@hotmail.co.uk)
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

const FIXTURE_PREFIX = "E2E:";
const SAVED_MEAL_NAME = `${FIXTURE_PREFIX} Chocolate Chip Almond Butter Protein Cookie`;
const ITEM_1_NAME = `${FIXTURE_PREFIX} Almond butter protein cookie`;
const ITEM_2_NAME = `${FIXTURE_PREFIX} Greek yogurt with blueberries`;
const SLOT = "Snacks";
const ALLOWED_EMAIL_DOMAINS = ["hotmail.co.uk", "outlook.com", "test.suppr.club"];

function loadEnvLocal(): void {
  const p = ".env.local";
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!process.env[k]) process.env[k] = v;
  }
}

function todayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.E2E_EMAIL;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  }
  if (!email) throw new Error("Missing E2E_EMAIL in .env.local");

  // Refuse to run against anything outside the allowed domains — a
  // misconfigured E2E_EMAIL pointing at a real customer would wipe their
  // fixtures even though they have none. Belt and braces.
  const domain = email.split("@")[1] ?? "";
  if (!ALLOWED_EMAIL_DOMAINS.some((d) => domain.endsWith(d))) {
    throw new Error(
      `E2E_EMAIL=${email} not in allowed domains (${ALLOWED_EMAIL_DOMAINS.join(", ")})`,
    );
  }

  const clean = process.argv.includes("--clean");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  // Resolve user_id via service-role auth admin API (no public table
  // exposes email-to-id, which is correct).
  const { data: usersResp, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw listErr;
  const user = usersResp.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`No auth user found for E2E_EMAIL=${email}`);

  console.log(`[seed] target user=${email} (${user.id}) date_key=${todayDateKey()}`);

  // 1. Remove prior E2E fixtures for this user.
  console.log(`[seed] removing prior ${FIXTURE_PREFIX} fixtures…`);
  // saved meal items cascade from saved meal via FK — delete parents.
  const { data: priorSaved, error: priorSavedErr } = await admin
    .from("user_saved_meals")
    .select("id")
    .eq("user_id", user.id)
    .like("name", `${FIXTURE_PREFIX}%`);
  if (priorSavedErr) throw priorSavedErr;
  if (priorSaved && priorSaved.length > 0) {
    const ids = priorSaved.map((r) => r.id);
    const { error: delItemsErr } = await admin
      .from("user_saved_meal_items")
      .delete()
      .in("saved_meal_id", ids);
    if (delItemsErr) throw delItemsErr;
    const { error: delSavedErr } = await admin
      .from("user_saved_meals")
      .delete()
      .in("id", ids);
    if (delSavedErr) throw delSavedErr;
    console.log(`[seed]   removed ${priorSaved.length} prior saved meal(s)`);
  }

  const { error: delEntriesErr } = await admin
    .from("nutrition_entries")
    .delete()
    .eq("user_id", user.id)
    .eq("date_key", todayDateKey())
    .like("recipe_title", `${FIXTURE_PREFIX}%`);
  if (delEntriesErr) throw delEntriesErr;

  if (clean) {
    console.log("[seed] --clean done");
    return;
  }

  // 2. Insert the saved meal (long name, Snacks slot).
  const { data: savedMeal, error: insSavedErr } = await admin
    .from("user_saved_meals")
    .insert({
      user_id: user.id,
      name: SAVED_MEAL_NAME,
      default_meal_slot: SLOT,
      log_count: 0,
    })
    .select("id")
    .single();
  if (insSavedErr) throw insSavedErr;
  console.log(`[seed] inserted saved meal id=${savedMeal.id} name="${SAVED_MEAL_NAME}"`);

  // 3. Items inside the saved meal.
  const { error: insItemsErr } = await admin.from("user_saved_meal_items").insert([
    {
      saved_meal_id: savedMeal.id,
      position: 0,
      recipe_title: ITEM_1_NAME,
      calories: 140,
      protein: 6,
      carbs: 14,
      fat: 7,
      fiber: 1,
      portion_multiplier: 1,
      source: "manual",
    },
    {
      saved_meal_id: savedMeal.id,
      position: 1,
      recipe_title: ITEM_2_NAME,
      calories: 110,
      protein: 12,
      carbs: 8,
      fat: 3,
      fiber: 1,
      portion_multiplier: 1,
      source: "manual",
    },
  ]);
  if (insItemsErr) throw insItemsErr;
  console.log(`[seed] inserted 2 saved-meal items`);

  // 4. Today's Snacks slot with 2 logged entries — populates the slot
  //    so the header renders with the kcal trailing cluster + chevron.
  //    `name = 'Snacks'` is the canonical journal slot string (see
  //    src/lib/nutrition/recipeJournalSlot.ts).
  const { error: insEntriesErr } = await admin.from("nutrition_entries").insert([
    {
      user_id: user.id,
      date_key: todayDateKey(),
      name: SLOT,
      recipe_title: ITEM_1_NAME,
      time_label: "15:30",
      calories: 140,
      protein: 6,
      carbs: 14,
      fat: 7,
      fiber_g: 1,
      portion_multiplier: 1,
      source: "manual",
    },
    {
      user_id: user.id,
      date_key: todayDateKey(),
      name: SLOT,
      recipe_title: ITEM_2_NAME,
      time_label: "15:45",
      calories: 110,
      protein: 12,
      carbs: 8,
      fat: 3,
      fiber_g: 1,
      portion_multiplier: 1,
      source: "manual",
    },
  ]);
  if (insEntriesErr) throw insEntriesErr;
  console.log(`[seed] inserted 2 Snacks entries on today (date_key=${todayDateKey()})`);

  // 5. Suppress the weekly check-in modal for this validation window.
  //    The modal pops on every cold launch when `last_weekly_checkin_shown_at`
  //    is stale enough, and blocks the Today screen so Maestro can't
  //    reach the meals section. Bumping the shown-at timestamp to now()
  //    defers the next prompt without changing any other surface
  //    behaviour. We deliberately don't touch `_decision` — it has a
  //    CHECK constraint and the trigger logic is the modal's own
  //    concern; suppressing the *prompt* is what we need.
  const { error: updProfileErr } = await admin
    .from("profiles")
    .update({
      last_weekly_checkin_shown_at: new Date().toISOString(),
    })
    .eq("id", user.id);
  if (updProfileErr) throw updProfileErr;
  console.log("[seed] suppressed weekly check-in modal for this user");

  console.log("[seed] done.");
}

main().catch((err) => {
  console.error("[seed] FAILED:", err.message ?? err);
  process.exit(1);
});
