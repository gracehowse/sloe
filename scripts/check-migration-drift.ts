/**
 * Check that local migration files match `supabase_migrations.schema_migrations` on the linked Supabase project.
 *
 * Why this exists
 * ---------------
 * The Supabase MCP `apply_migration` tool and the Dashboard SQL editor's "Save as migration" path both
 * call the Management API without a `version` parameter, so the API stamps `schema_migrations.version`
 * with wall-clock NOW(). When the same name lives in `supabase/migrations/` with a different (often
 * deliberately future-dated) timestamp, the row drifts. The canonical apply path is
 * `supabase db push --linked`, which preserves the file timestamp.
 *
 * What this script does
 * ---------------------
 * 1. Reads `*.sql` files in `supabase/migrations/` and parses `<timestamp>_<name>.sql`.
 * 2. Queries `supabase_migrations.schema_migrations` for `(version, name)` rows via
 *    `supabase db query --linked` (uses your existing Supabase CLI link — no new deps).
 * 3. Joins by `name` and reports four buckets:
 *      - Matched cleanly       (version === fileVersion)
 *      - Drifted               (name matches, version differs)
 *      - Local only            (file exists, no remote row — likely never applied)
 *      - Remote only           (remote row exists, no local file — applied without committing
 *                                 the SQL, or local file renamed)
 *
 * Drift is informational only; the 12 currently-drifted rows on this project are intentionally
 * left as-is (every drifted migration is idempotent so future `db push` calls skip by name).
 * See docs/planning/supabase-migration-drift-inventory.md for context.
 *
 * Exit codes
 * ----------
 * - 0 by default
 * - 1 only when `--strict` is passed AND there are local-only files (signal to prelaunch checklist
 *   that migrations are committed but not yet shipped).
 *
 * Usage:
 *   npm run check:migrations            # informational
 *   npm run check:migrations -- --strict # fail on local-only
 *   tsx scripts/check-migration-drift.ts [--strict] [--json]
 */
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

type LocalMigration = { fileVersion: string; name: string; filePath: string };
type RemoteMigration = { version: string; name: string };

type DriftReport = {
  matched: Array<{ name: string; version: string }>;
  drifted: Array<{ name: string; localVersion: string; remoteVersion: string; filePath: string }>;
  localOnly: LocalMigration[];
  remoteOnly: RemoteMigration[];
};

function loadEnvLocal(): void {
  const p = path.join(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function readLocalMigrations(dir: string): LocalMigration[] {
  if (!existsSync(dir)) {
    throw new Error(`Migrations directory not found: ${dir}`);
  }
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const out: LocalMigration[] = [];
  for (const f of files) {
    // Filename: <14-digit timestamp>_<name>.sql
    const m = f.match(/^(\d{14})_(.+)\.sql$/);
    if (!m) {
      console.warn(`[warn] Skipping non-conforming filename: ${f}`);
      continue;
    }
    out.push({ fileVersion: m[1], name: m[2], filePath: path.join(dir, f) });
  }
  return out;
}

/**
 * Calls `supabase db query --linked` to retrieve `(version, name)` from `supabase_migrations.schema_migrations`.
 * Uses the existing Supabase CLI link — does NOT require service role or DB URL in env, just CLI auth.
 */
function fetchRemoteMigrations(): RemoteMigration[] {
  const sql =
    "select version, name from supabase_migrations.schema_migrations order by version";
  const proc = spawnSync("supabase", ["db", "query", "--linked", sql], {
    encoding: "utf8",
    // Inherit env so SUPABASE_AUTH_EXTERNAL_APPLE_SECRET warnings don't bubble as errors.
    env: process.env,
  });
  if (proc.error) {
    throw new Error(
      `Failed to invoke 'supabase db query': ${proc.error.message}. Is the Supabase CLI installed and the project linked?`,
    );
  }
  if (proc.status !== 0) {
    throw new Error(
      `'supabase db query' exited ${proc.status}. stderr:\n${proc.stderr}\nstdout:\n${proc.stdout}`,
    );
  }
  // CLI emits a JSON object with a `rows` array. Tolerate the leading WARN/Connecting noise on stderr.
  const stdout = proc.stdout.trim();
  // Find the first '{' to skip any preamble.
  const firstBrace = stdout.indexOf("{");
  if (firstBrace === -1) {
    throw new Error(`Unexpected output from 'supabase db query':\n${stdout}`);
  }
  const json = JSON.parse(stdout.slice(firstBrace));
  if (!Array.isArray(json.rows)) {
    throw new Error(`Unexpected JSON shape from 'supabase db query': missing 'rows' array.`);
  }
  return json.rows.map((r: { version: string; name: string }) => ({
    version: String(r.version),
    name: String(r.name),
  }));
}

function buildReport(local: LocalMigration[], remote: RemoteMigration[]): DriftReport {
  const localByName = new Map<string, LocalMigration>();
  for (const m of local) {
    if (localByName.has(m.name)) {
      console.warn(
        `[warn] Duplicate local migration name '${m.name}' (kept ${localByName.get(m.name)!.fileVersion}, ignoring ${m.fileVersion})`,
      );
      continue;
    }
    localByName.set(m.name, m);
  }
  const remoteByName = new Map<string, RemoteMigration>();
  for (const r of remote) {
    if (remoteByName.has(r.name)) {
      console.warn(
        `[warn] Duplicate remote migration name '${r.name}' in schema_migrations (kept ${remoteByName.get(r.name)!.version}, ignoring ${r.version})`,
      );
      continue;
    }
    remoteByName.set(r.name, r);
  }

  const matched: DriftReport["matched"] = [];
  const drifted: DriftReport["drifted"] = [];
  const localOnly: LocalMigration[] = [];
  const remoteOnly: RemoteMigration[] = [];

  for (const [name, l] of localByName) {
    const r = remoteByName.get(name);
    if (!r) {
      localOnly.push(l);
      continue;
    }
    if (r.version === l.fileVersion) {
      matched.push({ name, version: l.fileVersion });
    } else {
      drifted.push({
        name,
        localVersion: l.fileVersion,
        remoteVersion: r.version,
        filePath: l.filePath,
      });
    }
  }
  for (const [name, r] of remoteByName) {
    if (!localByName.has(name)) remoteOnly.push(r);
  }

  // Stable ordering for human-readable output.
  matched.sort((a, b) => a.version.localeCompare(b.version));
  drifted.sort((a, b) => a.localVersion.localeCompare(b.localVersion));
  localOnly.sort((a, b) => a.fileVersion.localeCompare(b.fileVersion));
  remoteOnly.sort((a, b) => a.version.localeCompare(b.version));

  return { matched, drifted, localOnly, remoteOnly };
}

function printReport(r: DriftReport, opts: { json: boolean }): void {
  if (opts.json) {
    console.log(JSON.stringify(r, null, 2));
    return;
  }
  console.log("=== Supabase migration drift check ===\n");
  console.log(`Matched cleanly: ${r.matched.length} row(s)`);

  console.log(`\nDrifted (name matches, version differs): ${r.drifted.length} row(s)`);
  if (r.drifted.length > 0) {
    console.log(
      "  These are typically MCP `apply_migration` or Dashboard 'Save as migration' applies; the",
    );
    console.log(
      "  Management API rewrites schema_migrations.version to NOW(). They are usually safe to leave",
    );
    console.log(
      "  as-is when the underlying migration is idempotent — see docs/planning/supabase-migration-drift-inventory.md.\n",
    );
    for (const d of r.drifted) {
      console.log(`  • ${d.name}`);
      console.log(`      local:  ${d.localVersion}  (${path.relative(process.cwd(), d.filePath)})`);
      console.log(`      remote: ${d.remoteVersion}`);
    }
  }

  console.log(`\nLocal only (file exists, no remote row — likely unshipped): ${r.localOnly.length} row(s)`);
  if (r.localOnly.length > 0) {
    for (const l of r.localOnly) {
      console.log(`  • ${l.fileVersion}  ${l.name}`);
      console.log(`      ${path.relative(process.cwd(), l.filePath)}`);
    }
    console.log(`\n  Run \`supabase db push --linked\` to apply.`);
  }

  console.log(`\nRemote only (no matching local file — applied without commit, or file renamed): ${r.remoteOnly.length} row(s)`);
  if (r.remoteOnly.length > 0) {
    for (const m of r.remoteOnly) {
      console.log(`  • ${m.version}  ${m.name}`);
    }
  }

  console.log("");
}

function main(): void {
  loadEnvLocal();
  const args = new Set(process.argv.slice(2));
  const strict = args.has("--strict");
  const json = args.has("--json");

  const migrationsDir = path.join(process.cwd(), "supabase", "migrations");
  const local = readLocalMigrations(migrationsDir);
  const remote = fetchRemoteMigrations();
  const report = buildReport(local, remote);
  printReport(report, { json });

  if (strict && report.localOnly.length > 0) {
    console.error(
      `[strict] ${report.localOnly.length} local-only migration(s) — run \`supabase db push --linked\` before shipping.`,
    );
    process.exit(1);
  }
  process.exit(0);
}

main();
