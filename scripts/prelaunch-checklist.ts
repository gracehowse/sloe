/**
 * Prints pre-launch items: what is satisfied in-repo vs what needs dashboards / DNS / Supabase cloud.
 *
 * Usage: npm run prelaunch:checklist
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
const expectedMigrations = [
  "20260419100000_recipes_rls_published_only.sql",
  "20260419100001_profiles_delete_own.sql",
  "20260419100002_nutrition_entries_user_date_index.sql",
];

function line(ok: boolean, label: string, detail?: string) {
  const tag = ok ? "[OK]" : "[!!]";
  console.log(`${tag} ${label}${detail ? ` — ${detail}` : ""}`);
}

console.log("=== Repository (migrations on disk) ===\n");
let allMigrationsOk = true;
for (const f of expectedMigrations) {
  const p = path.join(migrationsDir, f);
  const ok = fs.existsSync(p);
  if (!ok) allMigrationsOk = false;
  line(ok, f, ok ? "ready to push to Supabase" : "file missing from repo");
}

const privacyDefault = "privacy@suppr-club.com";
const privacyEnv = process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim();
console.log("\n=== Privacy contact (build-time) ===\n");
line(
  true,
  "Privacy page reads NEXT_PUBLIC_PRIVACY_EMAIL",
  privacyEnv ? `set in env → ${privacyEnv}` : `unset → default ${privacyDefault} (set on Vercel to override)`,
);

console.log("\n=== Migration drift (linked Supabase project) ===\n");
{
  // Default behaviour: warn but never fail the prelaunch checklist on drift.
  // Run `npm run check:migrations -- --strict` separately to fail on local-only migrations.
  const drift = spawnSync(
    process.execPath,
    ["--import", "tsx", path.join("scripts", "check-migration-drift.ts")],
    { encoding: "utf8", env: process.env },
  );
  if (drift.error || drift.status !== 0) {
    line(
      false,
      "Drift check skipped",
      drift.error?.message ?? `exit ${drift.status} — see \`npm run check:migrations\` for detail`,
    );
    if (drift.stderr) console.log(drift.stderr.trimEnd());
  } else {
    // Surface only the summary lines (counts) to keep prelaunch output compact.
    const summaryLines = drift.stdout
      .split("\n")
      .filter((l) =>
        /^Matched cleanly:|^Drifted \(|^Local only \(|^Remote only \(/.test(l.trim()),
      );
    for (const s of summaryLines) console.log(`  ${s.trim()}`);
    console.log(
      "  (run `npm run check:migrations` for full detail; add --strict to fail on local-only)",
    );
  }
}

console.log("\n=== Outstanding (your accounts / hosting) ===\n");
const outstanding = [
  "Mailbox or forwarder for the privacy address (or set NEXT_PUBLIC_PRIVACY_EMAIL on Vercel to the address you operate)",
  "Vercel Production: SUPABASE_SERVICE_ROLE_KEY (required for DELETE /api/account/delete and other privileged APIs)",
  "RevenueCat dashboard: offerings, entitlements, keys; EXPO_PUBLIC_REVENUECAT_* on EAS/Vercel for production mobile builds",
  "Stripe Live: STRIPE_PRICE_BASE_MONTHLY + STRIPE_PRICE_PRO_MONTHLY + webhook secret; npm run verify:production-env with prod env",
  "DNS: suppr-club.com → production deployment (HTTPS)",
  "Supabase production: run pending migrations (e.g. supabase link + supabase db push, or run SQL from supabase/migrations/)",
];
for (const s of outstanding) {
  console.log(`  • ${s}`);
}

console.log("\n=== Suggested next command (with production env loaded) ===\n");
console.log("  npm run verify:production-env\n");

if (!allMigrationsOk) {
  process.exit(1);
}
