/**
 * One-time setup for Gate-0 live verify (`scripts/verify-gate0-db.mts`).
 * Creates (or password-resets) a throwaway plus-address user and writes
 * GATE0_VERIFY_* vars to `.env.local` when missing.
 *
 * Run: node --env-file=.env.local --import tsx scripts/setup-gate0-verify-user.mts
 */
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const email =
  process.env.GATE0_VERIFY_EMAIL?.trim() ?? "gracehowse+gate0verify@outlook.com";

if (!url || !serviceKey) {
  console.error("Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

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
    .filter((l) => !l.startsWith("GATE0_VERIFY_EMAIL=") && !l.startsWith("GATE0_VERIFY_PASSWORD="));
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  lines.push(
    "",
    "# Gate-0 live DB verify (scripts/verify-gate0-db.mts) — throwaway plus-address, NOT a daily driver",
    `GATE0_VERIFY_EMAIL=${nextEmail}`,
    `GATE0_VERIFY_PASSWORD=${password}`,
  );
  writeFileSync(envPath, `${lines.join("\n")}\n`);
}

const existing = await findUserByEmail(email);
let password = process.env.GATE0_VERIFY_PASSWORD?.trim();

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
  console.log(`Created Gate-0 verify user ${email} (${data.user?.id})`);
} else if (!password) {
  password = randomBytes(18).toString("base64url");
  const { error } = await admin.auth.admin.updateUserById(existing.id, { password });
  if (error) {
    console.error("updateUserById failed:", error.message);
    process.exit(1);
  }
  console.log(`Reset password for existing Gate-0 verify user ${email}`);
} else {
  console.log(`Gate-0 verify user ${email} already exists; keeping GATE0_VERIFY_PASSWORD from env`);
}

if (!process.env.GATE0_VERIFY_PASSWORD?.trim()) {
  upsertEnvLocal(email, password!);
  console.log("Wrote GATE0_VERIFY_EMAIL + GATE0_VERIFY_PASSWORD to .env.local");
}

console.log("Next: npm run verify:gate0:live");
