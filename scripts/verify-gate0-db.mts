/**
 * Live verification for Gate-0 DB migrations (ENG-1035/1036/1043).
 * Run: node --import tsx scripts/verify-gate0-db.mts
 *
 * Uses .env.local (+ optional .env.persona for a throwaway test user).
 * NEVER uses E2E_EMAIL — that is Grace's real hotmail daily-driver.
 * Set GATE0_VERIFY_EMAIL / GATE0_VERIFY_PASSWORD, or defaults to
 * gracehowse+gate0verify@outlook.com.
 */
import { readFileSync, existsSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { PERSONA_FORBIDDEN_EMAILS } from "./_lib/personaSeed.ts";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env.persona");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ??
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();
const email =
  process.env.GATE0_VERIFY_EMAIL?.trim() ?? "gracehowse+gate0verify@outlook.com";
const password = process.env.GATE0_VERIFY_PASSWORD?.trim();

function assertGate0VerifyAccountSafe(targetEmail: string) {
  const lower = targetEmail.toLowerCase();
  if (PERSONA_FORBIDDEN_EMAILS.some((forbidden) => forbidden.toLowerCase() === lower)) {
    throw new Error(
      `Refusing Gate-0 live verify against real account ${targetEmail}. ` +
        "Set GATE0_VERIFY_EMAIL to a plus-address throwaway (e.g. gracehowse+gate0verify@outlook.com).",
    );
  }
  if (
    process.env.E2E_EMAIL?.trim() &&
    process.env.E2E_EMAIL.trim().toLowerCase() === lower
  ) {
    throw new Error(
      `Refusing Gate-0 live verify: GATE0_VERIFY_EMAIL must not equal E2E_EMAIL (${targetEmail}).`,
    );
  }
}

assertGate0VerifyAccountSafe(email);

type Check = { name: string; pass: boolean; detail: string };

const checks: Check[] = [];

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  const tag = pass ? "PASS" : "FAIL";
  console.log(`[${tag}] ${name} — ${detail}`);
}

async function verifyViewLocked() {
  if (!url || !anonKey) {
    record("ENG-1036 anon view", false, "missing NEXT_PUBLIC_SUPABASE_URL or ANON_KEY");
    return;
  }
  const res = await fetch(
    `${url}/rest/v1/recipes_implausible_macros?select=id&limit=1`,
    {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
    },
  );
  const body = await res.text();
  const ok = res.status !== 200 || body.trim() === "[]";
  record(
    "ENG-1036 anon view",
    ok,
    `HTTP ${res.status}${body.length < 120 ? ` body=${body.trim() || "(empty)"}` : ` body_len=${body.length}`} (expect non-200 or empty)`,
  );
}

async function verifyTierEscalationBlocked() {
  if (!url || !anonKey) {
    record("ENG-1035 tier INSERT guard", false, "missing Supabase env");
    return;
  }
  if (!password) {
    record(
      "ENG-1035 tier INSERT guard",
      false,
      "no test password (set GATE0_VERIFY_PASSWORD in .env.local for the throwaway account)",
    );
    return;
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: signIn, error: signInErr } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !signIn.session) {
    record(
      "ENG-1035 tier INSERT guard",
      false,
      `could not sign in as ${email}: ${signInErr?.message ?? "no session"}`,
    );
    return;
  }

  const uid = signIn.user.id;
  const authed = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
  });

  // Ensure a profile row exists — only touch `id` so UPDATE lockdown is not tripped.
  const { data: existing } = await authed.from("profiles").select("id").eq("id", uid).maybeSingle();
  if (!existing) {
    const { error: seedErr } = await authed.from("profiles").insert({ id: uid });
    if (seedErr) {
      record(
        "ENG-1035 tier INSERT guard",
        false,
        `profile seed failed: ${seedErr.message}`,
      );
      return;
    }
  }

  // Exploit path: delete own row, re-insert as pro.
  await authed.from("profiles").delete().eq("id", uid);

  const { error: escalateErr } = await authed.from("profiles").insert({
    id: uid,
    user_tier: "pro",
  });

  const blocked =
    !!escalateErr &&
    (escalateErr.code === "42501" ||
      escalateErr.message.includes("ENG-1035") ||
      escalateErr.message.includes("user_tier"));

  record(
    "ENG-1035 tier INSERT guard",
    blocked,
    blocked
      ? `escalation rejected (${escalateErr!.code ?? "err"}: ${escalateErr!.message.slice(0, 120)})`
      : `escalation NOT blocked: ${escalateErr?.message ?? "insert succeeded"}`,
  );

  const { error: stripeErr } = await authed.from("profiles").insert({
    id: uid,
    stripe_customer_id: "cus_gate0_verify_attacker",
  });
  const stripeBlocked =
    !!stripeErr &&
    (stripeErr.code === "42501" ||
      stripeErr.message.includes("stripe_customer_id") ||
      stripeErr.message.includes("ENG-1035"));
  record(
    "ENG-1035 stripe_customer_id guard",
    stripeBlocked,
    stripeBlocked
      ? `pre-association rejected (${stripeErr!.code ?? "err"})`
      : `NOT blocked: ${stripeErr?.message ?? "insert succeeded"}`,
  );

  // Default signup should still work.
  await authed.from("profiles").delete().eq("id", uid);
  const { error: defaultErr } = await authed.from("profiles").insert({ id: uid });
  record(
    "ENG-1035 default signup",
    !defaultErr,
    defaultErr ? `default insert failed: ${defaultErr.message}` : "insert { id } succeeded",
  );
}

async function verifyPromoPath() {
  if (!url || !anonKey || !password) {
    record("ENG-1043 promo RPC", false, "skipped — missing env or password");
    record("ENG-1103 SUPPR_TEST_PREMIUM deactivated", false, "skipped — missing env or password");
    record("ENG-1103 promo rate limit", false, "skipped — missing env or password");
    return;
  }

  const client = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: signIn, error: signInErr } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (signInErr || !signIn.session) {
    record("ENG-1043 promo RPC", false, `sign-in failed: ${signInErr?.message ?? "no session"}`);
    record("ENG-1103 SUPPR_TEST_PREMIUM deactivated", false, "sign-in failed");
    record("ENG-1103 promo rate limit", false, "sign-in failed");
    return;
  }

  const authed = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
  });

  // Use a code that may not exist — we're checking the RPC is callable without 42501.
  const { data, error } = await authed.rpc("redeem_promo_code", { p_code: "GATE0_VERIFY_NONEXISTENT" });
  const callable = !error || !error.message.includes("42501");
  const detail = error
    ? `rpc error (expected for bad code): ${error.code ?? ""} ${error.message.slice(0, 100)}`
    : `rpc returned: ${JSON.stringify(data).slice(0, 120)}`;
  record(
    "ENG-1043 promo RPC callable",
    callable,
    callable ? detail : `lockdown blocked RPC: ${error!.message}`,
  );

  const { data: testPromo, error: testPromoErr } = await authed.rpc("redeem_promo_code", {
    p_code: "SUPPR_TEST_PREMIUM",
  });
  const testPromoBlocked =
    !testPromoErr &&
    testPromo &&
    typeof testPromo === "object" &&
    (testPromo as { ok?: boolean }).ok === false &&
    (testPromo as { error?: string }).error === "invalid_or_expired";
  record(
    "ENG-1103 SUPPR_TEST_PREMIUM deactivated",
    testPromoBlocked,
    testPromoBlocked
      ? "redeem returned invalid_or_expired (promo inactive)"
      : `expected invalid_or_expired, got ${JSON.stringify(testPromo ?? testPromoErr?.message).slice(0, 120)}`,
  );

  let sawRateLimited = false;
  for (let i = 0; i < 11; i++) {
    const { data: attempt } = await authed.rpc("redeem_promo_code", {
      p_code: `GATE0_VERIFY_THROTTLE_${i}`,
    });
    if (
      attempt &&
      typeof attempt === "object" &&
      (attempt as { error?: string }).error === "rate_limited"
    ) {
      sawRateLimited = true;
      break;
    }
  }
  record(
    "ENG-1103 promo rate limit",
    sawRateLimited,
    sawRateLimited
      ? "rate_limited after repeated failed attempts"
      : "did not hit rate_limited within 11 invalid attempts",
  );
}

console.log("Gate-0 live DB verification\n");
await verifyViewLocked();
await verifyTierEscalationBlocked();
await verifyPromoPath();

const failed = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - failed.length}/${checks.length} checks passed`);
process.exit(failed.length > 0 ? 1 : 0);
