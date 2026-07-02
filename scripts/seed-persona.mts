/**
 * Synthetic-persona account seeder.
 *
 * Seeds a believable history (journal entries, weight series, library recipes,
 * profile targets) onto a Suppr TEST account so a persona-session agent can
 * sign in and explore the app as that user would. This is the data half of the
 * synthetic-user persona testing framework — see
 * `docs/testing/personas/README.md` for the roster and
 * `docs/testing/personas/RUNNER.md` for the session protocol.
 *
 * ─── SAFETY ────────────────────────────────────────────────────────────────
 * This script writes and (with --reset) DELETES rows. It refuses to run against
 * any account not on the hard allowlist in `scripts/_lib/personaSeed.ts`
 * (gracehowse+<tag>@outlook.com and the dedicated test accounts). The two real
 * daily-driver accounts (gracehowse@outlook.com bare, gracemturner@hotmail.co.uk)
 * are explicitly FORBIDDEN and abort before any DB call. Every delete is scoped
 * by user_id. The allowlist guard is unit-tested (tests/unit/personaSeed.test.ts).
 *
 * ─── USAGE ─────────────────────────────────────────────────────────────────
 *   node --import tsx scripts/seed-persona.mts \
 *     --persona <name> --email gracehowse+<tag>@outlook.com [--reset] [--dry-run]
 *
 *   --persona  one of: mfp-refugee-power-logger | instagram-recipe-saver |
 *              lazy-partial-logger | watch-athlete | cold-start-newcomer
 *   --email    target TEST account (must be on the allowlist)
 *   --reset    wipe ONLY this account's persona rows (and weight/profile) first
 *   --dry-run  print the plan; touch nothing
 *
 * Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY.
 * (Deliberately does NOT read E2E_EMAIL — that var points at a real account.)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import {
  assertSeedableEmail,
  buildSeedPlan,
  getPersona,
  PERSONA_ROW_TAG,
  type SeedPlan,
} from "./_lib/personaSeed.ts";

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

function arg(flag: string): string | undefined {
  const i = process.argv.indexOf(flag);
  if (i === -1) return undefined;
  return process.argv[i + 1];
}

function todayDateKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function log(msg: string): void {
  console.log(`[seed-persona] ${msg}`);
}

async function resolveUserId(
  admin: SupabaseClient,
  email: string,
): Promise<string> {
  // No public table maps email→id (correct), so use the service-role admin
  // API. Page through in case the project has grown past one page.
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const match = data.users.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );
    if (match) return match.id;
    if (data.users.length < 200) break; // last page
  }
  throw new Error(
    `no auth user found for ${email} — create the test account (or accept its sign-up) first`,
  );
}

/** Delete every persona-tagged row for this user. Scoped by user_id always. */
async function resetAccount(admin: SupabaseClient, userId: string): Promise<void> {
  log("--reset: removing prior persona rows for this user…");

  // 1. Journal entries — persona-tagged, scoped to this user.
  const { error: delEntries } = await admin
    .from("nutrition_entries")
    .delete()
    .eq("user_id", userId)
    .like("recipe_title", `${PERSONA_ROW_TAG}%`);
  if (delEntries) throw delEntries;

  // 2. Saved-recipe links + the recipes this user authored as persona seed.
  //    Recipes are tagged via source_name carrying the persona tag prefix.
  const { data: priorRecipes, error: findRecipes } = await admin
    .from("recipes")
    .select("id")
    .eq("author_id", userId)
    .like("source_name", `${PERSONA_ROW_TAG}%`);
  if (findRecipes) throw findRecipes;
  if (priorRecipes && priorRecipes.length > 0) {
    const ids = priorRecipes.map((r) => r.id);
    // Remove save links + ingredient rows first (FK), then the recipes.
    const { error: delSaves } = await admin
      .from("saves")
      .delete()
      .eq("user_id", userId)
      .in("recipe_id", ids);
    if (delSaves) throw delSaves;
    // ENG-1330 — persona recipes now seed whole-recipe bundles including
    // recipe_ingredients rows; clear them before deleting the parents.
    const { error: delIngredients } = await admin
      .from("recipe_ingredients")
      .delete()
      .in("recipe_id", ids);
    if (delIngredients) throw delIngredients;
    const { error: delRecipes } = await admin
      .from("recipes")
      .delete()
      .eq("author_id", userId)
      .in("id", ids);
    if (delRecipes) throw delRecipes;
    log(`  removed ${ids.length} persona recipe(s) + their save links + ingredients`);
  }

  // 3. Clear the weight series + persona daily_targets snapshots.
  const { error: clearWeight } = await admin
    .from("profiles")
    .update({ weight_kg_by_day: {} })
    .eq("id", userId);
  if (clearWeight) throw clearWeight;

  const { error: delTargets } = await admin
    .from("daily_targets")
    .delete()
    .eq("user_id", userId);
  if (delTargets) throw delTargets;

  log("  reset complete");
}

async function applyPlan(admin: SupabaseClient, plan: SeedPlan): Promise<void> {
  const { userId } = plan;

  // 1. Profile — goal/activity/targets/weight series in one update.
  const { error: profErr } = await admin
    .from("profiles")
    .update({
      goal: plan.profile.goal,
      activity_level: plan.profile.activity_level,
      sex: plan.profile.sex,
      age: plan.profile.age,
      height_cm: plan.profile.height_cm,
      weight_kg: plan.profile.start_weight_kg,
      goal_weight_kg: plan.profile.goal_weight_kg,
      target_calories: plan.profile.target_calories,
      target_protein: plan.profile.target_protein,
      target_carbs: plan.profile.target_carbs,
      target_fat: plan.profile.target_fat,
      display_name: plan.profile.display_name,
      onboarding_completed: plan.profile.onboarding_completed,
      weight_kg_by_day: plan.weightByDay,
    })
    .eq("id", userId);
  if (profErr) throw profErr;
  log(`profile updated (goal=${plan.profile.goal}, ${plan.counts.weighIns} weigh-ins)`);

  // 2. Journal entries (chunked to stay well under any payload limit).
  if (plan.entries.length > 0) {
    const CHUNK = 200;
    for (let i = 0; i < plan.entries.length; i += CHUNK) {
      const { error } = await admin
        .from("nutrition_entries")
        .insert(plan.entries.slice(i, i + CHUNK));
      if (error) throw error;
    }
    log(`inserted ${plan.entries.length} journal entries across ${plan.counts.fullDays + plan.counts.partialDays} days`);
  }

  // 3. Library recipes (authored by this user, tagged, then self-saved).
  //    ENG-1330: each row is a coherent whole-recipe bundle — description,
  //    method and recipe_ingredients rows land together with the title so
  //    seeded content never mixes one dish's title with another's ingredients.
  if (plan.recipes.length > 0) {
    const recipeRows = plan.recipes.map((r) => ({
      author_id: userId,
      title: r.title,
      description: r.description,
      instructions: r.instructions.join("\n"),
      calories: r.calories,
      protein: r.protein,
      carbs: r.carbs,
      fat: r.fat,
      fiber_g: r.fiber_g,
      servings: r.servings,
      prep_time_min: r.prep_time_min,
      cook_time_min: r.cook_time_min,
      cuisine: r.cuisine,
      // Tag the recipe via source_name so --reset can find it precisely.
      source_name: `${PERSONA_ROW_TAG} ${r.source_name}`,
      meal_type: r.meal_type,
      published: false,
      is_verified: false,
    }));
    const { data: inserted, error: recErr } = await admin
      .from("recipes")
      .insert(recipeRows)
      .select("id, title");
    if (recErr) throw recErr;
    const insertedRows = inserted ?? [];

    // Ingredient rows — matched to parents by TITLE (not insert order) so a
    // reordered response can never re-create the decoupling bug. Macros seed
    // at 0: the standard log-time / auto-verify pipeline owns row nutrition
    // (mirrors the catalog-seed posture — never invent per-row values here).
    const ingredientRows = insertedRows.flatMap((row) => {
      const bundle = plan.recipes.find((r) => r.title === row.title);
      if (!bundle) throw new Error(`inserted recipe "${row.title}" has no bundle`);
      return bundle.ingredients.map((ing) => ({
        recipe_id: row.id,
        name: ing.name,
        amount: ing.amount,
        unit: ing.unit,
      }));
    });
    if (ingredientRows.length > 0) {
      const { error: ingErr } = await admin
        .from("recipe_ingredients")
        .insert(ingredientRows);
      if (ingErr) throw ingErr;
    }

    const saveRows = insertedRows.map((row) => ({
      user_id: userId,
      recipe_id: row.id,
    }));
    if (saveRows.length > 0) {
      const { error: saveErr } = await admin.from("saves").insert(saveRows);
      if (saveErr) throw saveErr;
    }
    log(
      `inserted ${plan.recipes.length} library recipes (+${ingredientRows.length} ingredient rows, +save links)`,
    );
  }

  log("done.");
}

function printPlan(plan: SeedPlan): void {
  log(`PLAN for persona "${plan.persona}" → ${plan.email} (${plan.userId})`);
  log(`  anchor (today) date_key: ${plan.anchorDateKey}`);
  log(
    `  days: ${plan.counts.fullDays} full / ${plan.counts.partialDays} partial / ${plan.counts.emptyDays} empty`,
  );
  log(`  journal entries: ${plan.counts.totalEntries}`);
  log(`  weigh-ins: ${plan.counts.weighIns}`);
  log(`  library recipes: ${plan.counts.recipes}`);
  log(
    `  profile: goal=${plan.profile.goal} activity=${plan.profile.activity_level} target=${plan.profile.target_calories} kcal onboarded=${plan.profile.onboarding_completed}`,
  );
  if (plan.counts.weighIns > 0) {
    const sample = Object.entries(plan.weightByDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(0, 3)
      .map(([k, v]) => `${k}=${v}kg`)
      .join(", ");
    log(`  weight series (first 3): ${sample}${plan.counts.weighIns > 3 ? ", …" : ""}`);
  }
}

async function main(): Promise<void> {
  loadEnvLocal();

  const personaName = arg("--persona");
  const rawEmail = arg("--email");
  const reset = process.argv.includes("--reset");
  const dryRun = process.argv.includes("--dry-run");

  if (!personaName) throw new Error("missing --persona <name>");
  if (!rawEmail) throw new Error("missing --email <test-account>");

  // SAFETY GATE — before anything else, before any client is built.
  const email = assertSeedableEmail(rawEmail);
  const persona = getPersona(personaName);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
    );
  }

  const anchorDateKey = todayDateKey();

  if (dryRun) {
    // Dry-run never resolves a real user id or opens a write path; use a
    // placeholder so the plan still prints in full.
    const plan = buildSeedPlan(persona, email, "<dry-run-user-id>", anchorDateKey);
    log("DRY RUN — no database writes.");
    printPlan(plan);
    return;
  }

  const admin = createClient(url, key, { auth: { persistSession: false } });
  const userId = await resolveUserId(admin, email);
  log(`target ${email} (${userId}), persona=${persona.name}, anchor=${anchorDateKey}`);

  if (reset) {
    await resetAccount(admin, userId);
  }

  const plan = buildSeedPlan(persona, email, userId, anchorDateKey);
  printPlan(plan);
  await applyPlan(admin, plan);
}

main().catch((err) => {
  console.error(`[seed-persona] FAILED: ${err?.message ?? err}`);
  process.exit(1);
});
