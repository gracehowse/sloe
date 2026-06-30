/**
 * Create (or reset) the dedicated Playwright visual-golden Supabase account.
 * Writes E2E_VISUAL_* to `.env.local` when missing.
 *
 * Run: npm run setup:e2e:visual-golden
 * Requires: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in `.env.local`
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { PERSONA_FORBIDDEN_EMAILS } from "./_lib/personaSeed.ts";
import { WebSocket as WsWebSocket } from "ws";

// Node 20 (the CI runner for update-visual-baselines.yml) has no global
// WebSocket. @supabase/supabase-js constructs a realtime client that probes
// for one at createClient() time — even though this seed only performs admin
// REST writes — and throws "Node.js 20 detected without native WebSocket
// support". Polyfill it so the seed step runs. (ENG-1265)
(globalThis as { WebSocket?: unknown }).WebSocket ??= WsWebSocket;

const DEFAULT_EMAIL = "gracehowse+visualgolden@outlook.com";

/** Stable profile for pixel goldens — do not edit this account manually. */
const VISUAL_GOLDEN_PROFILE = {
  display_name: "Alex Golden",
  user_tier: "free" as const,
  sex: "female" as const,
  age: 32,
  height_cm: 168,
  weight_kg: 65,
  activity_level: "moderate" as const,
  goal: "maintain" as const,
  target_calories: 2100,
  target_protein: 105,
  target_carbs: 236,
  target_fat: 70,
  target_fiber_g: 25,
  target_water_ml: 2500,
  onboarding_completed: true,
  measurement_system: "metric" as const,
  plan_pace: "steady",
  nutrition_strategy: "balanced",
  calorie_schedule: "even",
  fasting_enabled: false,
  weight_kg_by_day: {},
  steps_by_day: {},
  daily_steps_goal: 10000,
};

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email = process.env.E2E_VISUAL_EMAIL?.trim() ?? DEFAULT_EMAIL;

if (!url || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

function assertVisualGoldenEmailSafe(target: string) {
  const lower = target.toLowerCase();
  if (PERSONA_FORBIDDEN_EMAILS.some((forbidden) => forbidden.toLowerCase() === lower)) {
    throw new Error(`Refusing visual golden account on real daily-driver email ${target}`);
  }
  if (process.env.E2E_EMAIL?.trim() && process.env.E2E_EMAIL.trim().toLowerCase() === lower) {
    throw new Error(
      `Refusing visual golden account: must not equal E2E_EMAIL (${target}). Use a plus-address test inbox.`,
    );
  }
}

assertVisualGoldenEmailSafe(email);

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function findUserByEmail(target: string) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === target.toLowerCase());
    if (hit) return hit;
    if (data.users.length < 200) break;
  }
  return null;
}

function upsertEnvLocal(nextEmail: string, password: string) {
  const envPath = ".env.local";
  const content = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";
  const lines = content
    .split("\n")
    .filter((l) => !l.startsWith("E2E_VISUAL_EMAIL=") && !l.startsWith("E2E_VISUAL_PASSWORD="));
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  lines.push(
    "",
    "# Playwright visual golden account (scripts/setup-e2e-visual-golden-user.mts) — do not use for daily E2E",
    `E2E_VISUAL_EMAIL=${nextEmail}`,
    `E2E_VISUAL_PASSWORD=${password}`,
  );
  writeFileSync(envPath, `${lines.join("\n")}\n`);
}

async function resetVisualJournal(userId: string) {
  const { error } = await admin.from("nutrition_entries").delete().eq("user_id", userId);
  if (error) throw error;
}

async function upsertVisualProfile(userId: string) {
  const { error } = await admin.from("profiles").upsert(
    {
      id: userId,
      ...VISUAL_GOLDEN_PROFILE,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}

const existing = await findUserByEmail(email);
let password = process.env.E2E_VISUAL_PASSWORD?.trim();
let userId: string;

if (!existing) {
  password = password ?? randomBytes(18).toString("base64url");
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) {
    console.error("createUser failed:", error.message);
    process.exit(1);
  }
  userId = data.user!.id;
  console.log(`Created visual golden user ${email} (${userId})`);
} else {
  userId = existing.id;
  if (!password) {
    password = randomBytes(18).toString("base64url");
    const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
    if (error) {
      console.error("updateUserById failed:", error.message);
      process.exit(1);
    }
    console.log(`Reset password for existing visual golden user ${email}`);
  } else {
    console.log(`Visual golden user ${email} already exists; keeping password from env`);
  }
}

await upsertVisualProfile(userId);
await resetVisualJournal(userId);

if (!process.env.E2E_VISUAL_PASSWORD?.trim()) {
  upsertEnvLocal(email, password!);
  console.log("Wrote E2E_VISUAL_EMAIL + E2E_VISUAL_PASSWORD to .env.local");
}

console.log("Visual golden profile:");
console.log(`  display_name=${VISUAL_GOLDEN_PROFILE.display_name}`);
console.log(`  tier=${VISUAL_GOLDEN_PROFILE.user_tier} onboarding_completed=true`);
console.log("Next: npm run test:e2e:visual:authed -- --project=chromium-visual");
