/**
 * Seeds deterministic Today states for premium sprint captures (ENG-575).
 *
 * Uses date offsets from local today so Playwright can navigate via
 * prev/next day controls. All rows are prefixed `E2E-CAP:` and scoped
 * to E2E_EMAIL only (same guard as e2e-seed-today-snacks.ts).
 *
 *   offset -14 → empty day (all entries on that date purged)
 *   offset  -2 → one meal (~10am breakfast, cold-open bar)
 *   offset -7  → over-budget day (high kcal sum)
 *   offset -6  → partial day (deficit / remaining > 0)
 *   offset -1  → prior lunch (feeds eat-again on today when today is full)
 *
 * Also sets an active fast on the profile for fasting capture on today.
 *
 * Usage: npx tsx scripts/e2e-seed-today-premium-matrix.ts [--clean]
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

const PREFIX = "E2E-CAP:";
const ALLOWED_EMAIL_DOMAINS = ["hotmail.co.uk", "outlook.com", "test.suppr.club"];

/** Exported for Playwright — must stay in sync with seed offsets. */
export const CAPTURE_DATE_OFFSETS = {
  /** Past day with no entries — Next-day is disabled on today in the UI. */
  empty: -14,
  oneMeal: -2,
  overBudget: -7,
  deficit: -6,
  eatAgainToday: 0,
  eatAgainPrior: -1,
} as const;

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

function dateKeyFromDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

function offsetKey(days: number): string {
  return dateKeyFromDate(addDays(new Date(), days));
}

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const email = process.env.E2E_EMAIL;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!email) throw new Error("Missing E2E_EMAIL");

  const domain = email.split("@")[1] ?? "";
  if (!ALLOWED_EMAIL_DOMAINS.some((d) => domain.endsWith(d))) {
    throw new Error(`E2E_EMAIL domain not allowed: ${email}`);
  }

  const clean = process.argv.includes("--clean");
  const admin = createClient(url, key, { auth: { persistSession: false } });

  const { data: usersResp, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw listErr;
  const user = usersResp.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new Error(`No auth user for ${email}`);

  const keys = Object.values(CAPTURE_DATE_OFFSETS);
  const uniqueKeys = [...new Set(keys)];

  console.log("[premium-matrix] user", email, "dates", uniqueKeys);

  const { error: delErr } = await admin
    .from("nutrition_entries")
    .delete()
    .eq("user_id", user.id)
    .like("recipe_title", `${PREFIX}%`);
  if (delErr) throw delErr;

  if (clean) {
    await admin
      .from("profiles")
      .update({ fasting_sessions: [] })
      .eq("id", user.id);
    console.log("[premium-matrix] --clean done");
    return;
  }

  const kEmpty = offsetKey(CAPTURE_DATE_OFFSETS.empty);
  const { error: emptyPurgeErr } = await admin
    .from("nutrition_entries")
    .delete()
    .eq("user_id", user.id)
    .eq("date_key", kEmpty);
  if (emptyPurgeErr) throw emptyPurgeErr;

  const kOne = offsetKey(CAPTURE_DATE_OFFSETS.oneMeal);
  const kToday = offsetKey(CAPTURE_DATE_OFFSETS.eatAgainToday);
  const kOver = offsetKey(CAPTURE_DATE_OFFSETS.overBudget);
  const kDeficit = offsetKey(CAPTURE_DATE_OFFSETS.deficit);
  const kPrior = offsetKey(CAPTURE_DATE_OFFSETS.eatAgainPrior);

  const rows: Array<Record<string, unknown>> = [
    {
      user_id: user.id,
      date_key: kOne,
      name: "Breakfast",
      recipe_title: `${PREFIX} Greek yogurt and berries`,
      time_label: "10:15",
      calories: 420,
      protein: 28,
      carbs: 42,
      fat: 12,
      fiber_g: 4,
      portion_multiplier: 1,
      source: "manual",
    },
    {
      user_id: user.id,
      date_key: kOver,
      name: "Lunch",
      recipe_title: `${PREFIX} Large pasta bowl`,
      time_label: "13:00",
      calories: 2100,
      protein: 55,
      carbs: 240,
      fat: 72,
      fiber_g: 8,
      portion_multiplier: 1,
      source: "manual",
    },
    {
      user_id: user.id,
      date_key: kOver,
      name: "Dinner",
      recipe_title: `${PREFIX} Burger and fries`,
      time_label: "19:30",
      calories: 1650,
      protein: 48,
      carbs: 120,
      fat: 95,
      fiber_g: 6,
      portion_multiplier: 1,
      source: "manual",
    },
    {
      user_id: user.id,
      date_key: kDeficit,
      name: "Lunch",
      recipe_title: `${PREFIX} Light salad bowl`,
      time_label: "12:30",
      calories: 520,
      protein: 22,
      carbs: 48,
      fat: 18,
      fiber_g: 9,
      portion_multiplier: 1,
      source: "manual",
    },
    {
      user_id: user.id,
      date_key: kPrior,
      name: "Lunch",
      recipe_title: `${PREFIX} Chicken rice bowl`,
      time_label: "12:45",
      calories: 680,
      protein: 42,
      carbs: 72,
      fat: 18,
      fiber_g: 4,
      portion_multiplier: 1,
      source: "manual",
    },
    {
      user_id: user.id,
      date_key: kToday,
      name: "Lunch",
      recipe_title: `${PREFIX} Chicken rice bowl`,
      time_label: "12:50",
      calories: 980,
      protein: 52,
      carbs: 92,
      fat: 28,
      fiber_g: 4,
      portion_multiplier: 1,
      source: "manual",
    },
    {
      user_id: user.id,
      date_key: kToday,
      name: "Dinner",
      recipe_title: `${PREFIX} Salmon plate`,
      time_label: "19:00",
      calories: 1120,
      protein: 58,
      carbs: 48,
      fat: 42,
      fiber_g: 5,
      portion_multiplier: 1,
      source: "manual",
    },
  ];

  const { error: insErr } = await admin.from("nutrition_entries").insert(rows);
  if (insErr) throw insErr;

  const { error: profileErr } = await admin
    .from("profiles")
    .update({
      last_weekly_checkin_shown_at: new Date().toISOString(),
      ...(process.argv.includes("--activate-fast")
        ? {
            fasting_sessions: [
              { start: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(), end: null },
            ],
          }
        : { fasting_sessions: [] }),
    })
    .eq("id", user.id);
  if (profileErr) throw profileErr;

  console.log("[premium-matrix] seeded:");
  console.log("  empty", kEmpty, "(no rows)");
  console.log("  one-meal", kOne, "(single breakfast)");
  console.log("  eat-again today", kToday, "(lunch+dinner on today + prior lunch on", kPrior + ")");
  console.log("  over-budget", kOver);
  console.log("  deficit", kDeficit);
  console.log("  eat-again prior", kPrior);
  if (process.argv.includes("--activate-fast")) {
    console.log("  active fast ON profile (use for active-fast captures only)");
  }
  console.log("[premium-matrix] done");
}

main().catch((err) => {
  console.error("[premium-matrix] FAILED:", err.message ?? err);
  process.exit(1);
});
