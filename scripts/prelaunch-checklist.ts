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

console.log("\n=== Migration tree status (polish B) ===\n");
{
  // Polish B (2026-04-25 follow-up): warn if there are uncommitted /
  // untracked .sql files in supabase/migrations/. Catches the
  // "ran `db push --linked` against a file I forgot to commit" foot-gun.
  // Doesn't fail the checklist — informational, like the drift section.
  const status = spawnSync("git", ["status", "--porcelain", "--", "supabase/migrations/"], {
    encoding: "utf8",
  });
  if (status.error || status.status !== 0) {
    line(false, "Migration git-status check skipped", status.error?.message ?? `exit ${status.status}`);
  } else {
    const lines = (status.stdout ?? "").split("\n").filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      line(true, "All migrations committed (no uncommitted / untracked files in supabase/migrations/)");
    } else {
      line(
        false,
        `${lines.length} uncommitted / untracked migration file(s) — commit before \`supabase db push --linked\``,
      );
      for (const l of lines) {
        console.log(`  ${l}`);
      }
    }
  }
}

console.log("\n=== Legal page placeholders (P1-15) ===\n");
{
  // Walk the legal pages and report any PLACEHOLDER strings still
  // committed. The runbook
  // (docs/operations/legal-finalization-runbook.md) lists the workflow
  // that resolves them; this section gives an at-a-glance count so
  // Grace can tell at-a-glance whether the public-launch legal floor
  // has cleared.
  const legalFiles = [
    "app/privacy/page.tsx",
    "app/terms/page.tsx",
    "app/dmca/page.tsx",
    "app/licences/page.tsx",
  ];
  let totalPlaceholders = 0;
  const perFile: { file: string; count: number; lines: number[] }[] = [];
  for (const rel of legalFiles) {
    const abs = path.join(process.cwd(), rel);
    if (!fs.existsSync(abs)) continue;
    const text = fs.readFileSync(abs, "utf8");
    const lines = text.split("\n");
    const matchedLines: number[] = [];
    for (let i = 0; i < lines.length; i += 1) {
      // Match the deliberate `[PLACEHOLDER` token used in the legal
      // pages; tolerate HTML entity inside via `&mdash;` or similar.
      if (/\[PLACEHOLDER\b/.test(lines[i] ?? "")) matchedLines.push(i + 1);
    }
    totalPlaceholders += matchedLines.length;
    perFile.push({ file: rel, count: matchedLines.length, lines: matchedLines });
  }
  if (totalPlaceholders === 0) {
    line(true, "All legal pages clear of [PLACEHOLDER ...] strings");
  } else {
    line(
      false,
      `${totalPlaceholders} unresolved [PLACEHOLDER ...] in legal pages — see docs/operations/legal-finalization-runbook.md`,
    );
    for (const { file, count, lines: hits } of perFile) {
      if (count === 0) continue;
      console.log(`  • ${file} — ${count} placeholder(s) at line${count > 1 ? "s" : ""} ${hits.join(", ")}`);
    }
  }
}

console.log("\n=== RevenueCat webhook idempotency (live replay smoke) ===\n");
{
  // P1-14 (2026-04-25): proves the deployed webhook authenticates +
  // dedups on event_id. Skipped when secrets aren't loaded so the
  // checklist is still useful in CI / first-time setups.
  const haveSecret = Boolean(process.env.REVENUECAT_WEBHOOK_AUTH);
  const haveUrl = Boolean(
    process.env.REVENUECAT_WEBHOOK_URL ?? process.env.NEXT_PUBLIC_APP_URL,
  );
  if (!haveSecret || !haveUrl) {
    line(
      false,
      "RevenueCat replay smoke skipped",
      `${!haveSecret ? "REVENUECAT_WEBHOOK_AUTH unset" : ""}${!haveSecret && !haveUrl ? " + " : ""}${!haveUrl ? "REVENUECAT_WEBHOOK_URL / NEXT_PUBLIC_APP_URL unset" : ""}; load production env and rerun, or run \`npm run smoke:revenuecat\` directly.`,
    );
  } else {
    const replay = spawnSync(
      process.execPath,
      [path.join("scripts", "test-revenuecat-replay.mjs")],
      { encoding: "utf8", env: process.env },
    );
    const passed = !replay.error && replay.status === 0;
    line(
      passed,
      "RevenueCat webhook replay (idempotency + auth)",
      passed
        ? "200 / 200 (skipped_duplicate); event_id dedup confirmed"
        : `exit ${replay.status} — ${replay.stderr?.trim().split("\n").slice(-1)[0] ?? "see output"}`,
    );
    if (!passed && replay.stdout) {
      console.log(replay.stdout.trimEnd().split("\n").map((l) => `  ${l}`).join("\n"));
    }
    if (!passed && replay.stderr) {
      console.log(replay.stderr.trimEnd().split("\n").map((l) => `  ${l}`).join("\n"));
    }
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
