#!/usr/bin/env node
/**
 * Sync selected env vars from `.env.local` → Vercel (non-interactive).
 * Never prints secret values. Idempotent: skips keys already present on target envs.
 *
 * Usage: node scripts/sync-vercel-env-from-local.mjs [--apply]
 * Default is dry-run (lists planned adds only).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const APPLY = process.argv.includes("--apply");
const ROOT = resolve(process.cwd());
const ENV_LOCAL = resolve(ROOT, ".env.local");

/** @type {Record<string, string>} */
function loadEnvLocal() {
  if (!existsSync(ENV_LOCAL)) return {};
  /** @type {Record<string, string>} */
  const out = {};
  for (const line of readFileSync(ENV_LOCAL, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function listVercelEnv() {
  const raw = execFileSync("vercel", ["env", "ls"], { encoding: "utf8", cwd: ROOT });
  /** @type {Map<string, Set<string>>} */
  const map = new Map();
  for (const line of raw.split("\n")) {
    const m = line.match(/^\s+([A-Z0-9_]+)\s+.+\s+(Production(?:,\s*Preview(?:,\s*Development)?)?|Preview(?:,\s*Development)?|Development|Production)\s+/);
    if (!m) continue;
    const name = m[1];
    const envs = m[2]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!map.has(name)) map.set(name, new Set());
    for (const e of envs) map.get(name).add(e);
  }
  return map;
}

function addVercelEnv(name, value, environment) {
  /** @type {string[]} */
  const args = ["env", "add", name, environment.toLowerCase()];
  // Vercel CLI v50.x bug: preview needs `""` as branch arg for all preview branches (ENG-1115 sync).
  if (environment.toLowerCase() === "preview") args.push("");
  args.push("--value", value, "--yes");
  if (environment.toLowerCase() !== "development") args.push("--sensitive");

  if (APPLY) {
    const r = spawnSync("vercel", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (r.status !== 0) {
      const err = `${r.stderr ?? ""}${r.stdout ?? ""}`;
      if (/already exists|Environment Variable .* already/i.test(err)) {
        console.log(`  skip ${name} (${environment}) — already exists`);
        return;
      }
      throw new Error(`vercel env add ${name} ${environment} failed: ${err.slice(0, 300)}`);
    }
    console.log(`  added ${name} → ${environment}`);
  } else {
    console.log(`  would add ${name} → ${environment}`);
  }
}

const local = loadEnvLocal();
const remote = listVercelEnv();

/** @type {Array<{ name: string; envs: string[] }>} */
const plan = [];

function need(name, envs) {
  const val = local[name]?.trim();
  if (!val) {
    console.log(`skip ${name} — not in .env.local`);
    return;
  }
  const have = remote.get(name) ?? new Set();
  const missing = envs.filter((e) => !have.has(e));
  if (missing.length === 0) {
    console.log(`ok ${name} — already on ${envs.join(", ")}`);
    return;
  }
  plan.push({ name, envs: missing, value: val });
}

console.log(APPLY ? "Applying Vercel env sync…" : "Dry run — pass --apply to write");

need("SUPADATA_KEY", ["production", "preview", "development"]);
need("SUPPR_CRON_SECRET", ["production"]);
need("AI_BUDGET_ENFORCEMENT_ENABLED", ["preview"]);

if (plan.length === 0) {
  console.log("Nothing to add.");
  process.exit(0);
}

for (const item of plan) {
  console.log(`${item.name}: ${item.envs.join(", ")}`);
  if (APPLY) {
    for (const env of item.envs) addVercelEnv(item.name, item.value, env);
  }
}

if (!APPLY) {
  console.log("\nRe-run with --apply to push. Then redeploy prod + preview so lambdas pick up new vars.");
}
