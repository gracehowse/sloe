/**
 * Live verification for ENG-1244.
 *
 * Run after Grace applies the migration with:
 *   node --env-file=.env.local --import tsx scripts/verify-eng1244-live-rls.mts
 *
 * Requires a throwaway auth user:
 *   ENG1244_VERIFY_EMAIL=gracehowse+eng1244verify@outlook.com
 *   ENG1244_VERIFY_PASSWORD=...
 */
import { existsSync, readFileSync } from "node:fs";
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
  process.env.ENG1244_VERIFY_EMAIL?.trim() ?? "gracehowse+eng1244verify@outlook.com";
const password = process.env.ENG1244_VERIFY_PASSWORD?.trim();

type Check = { name: string; pass: boolean; detail: string };
const checks: Check[] = [];

function assertSafeVerifyAccount(targetEmail: string) {
  const lower = targetEmail.toLowerCase();
  if (PERSONA_FORBIDDEN_EMAILS.some((forbidden) => forbidden.toLowerCase() === lower)) {
    throw new Error(`Refusing ENG-1244 live verify against real account ${targetEmail}.`);
  }
  if (process.env.E2E_EMAIL?.trim()?.toLowerCase() === lower) {
    throw new Error(`ENG1244_VERIFY_EMAIL must not equal E2E_EMAIL (${targetEmail}).`);
  }
}

function record(name: string, pass: boolean, detail: string) {
  checks.push({ name, pass, detail });
  console.log(`[${pass ? "PASS" : "FAIL"}] ${name} — ${detail}`);
}

async function verifyAnonClaimEvidenceDenied() {
  if (!url || !anonKey) {
    record("anon claim_verification SELECT", false, "missing Supabase URL/key");
    return;
  }

  const res = await fetch(`${url}/rest/v1/recipes?select=id,claim_verification&limit=1`, {
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
    },
  });
  const body = await res.text();
  record(
    "anon claim_verification SELECT",
    res.status !== 200,
    `HTTP ${res.status} ${body.slice(0, 160) || "(empty)"}`,
  );
}

async function verifyAuthedTrustWriteDenied() {
  if (!url || !anonKey || !password) {
    record("authenticated recipes.is_verified UPDATE", false, "missing Supabase env or ENG1244_VERIFY_PASSWORD");
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
      "authenticated recipes.is_verified UPDATE",
      false,
      `could not sign in as ${email}: ${signInErr?.message ?? "no session"}`,
    );
    return;
  }

  const authed = createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${signIn.session.access_token}` } },
  });

  const { data: recipe, error: insertErr } = await authed
    .from("recipes")
    .insert({
      author_id: signIn.user.id,
      title: "ENG-1244 live verify throwaway",
      instructions: "Delete me after verification.",
      servings: 1,
      published: false,
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
    })
    .select("id")
    .single();

  if (insertErr || !recipe) {
    record(
      "authenticated recipes.is_verified UPDATE",
      false,
      `setup insert failed: ${insertErr?.message ?? "no row"}`,
    );
    return;
  }

  const recipeId = String((recipe as { id: string }).id);
  try {
    const { data: updateData, error: updateErr } = await authed
      .from("recipes")
      .update({ is_verified: true })
      .eq("id", recipeId)
      .select("id,is_verified")
      .maybeSingle();

    const blocked =
      !!updateErr &&
      (updateErr.code === "42501" ||
        updateErr.message.includes("server-owned") ||
        updateErr.message.includes("ENG-1244"));

    record(
      "authenticated recipes.is_verified UPDATE",
      blocked,
      blocked
        ? `rejected (${updateErr!.code ?? "err"}: ${updateErr!.message.slice(0, 140)})`
        : `NOT blocked: ${JSON.stringify(updateData)}`,
    );
  } finally {
    await authed.from("recipes").delete().eq("id", recipeId);
  }
}

async function main() {
  assertSafeVerifyAccount(email);
  await verifyAnonClaimEvidenceDenied();
  await verifyAuthedTrustWriteDenied();

  const failed = checks.filter((check) => !check.pass);
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

await main();
