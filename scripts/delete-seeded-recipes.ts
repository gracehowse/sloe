/**
 * Remove seeded recipe rows from Supabase:
 * - Fixed demo UUIDs (historical supabase/seed.sql)
 * - Legacy SQL batch: description + seed author
 * - Optional URL list: if scripts/seed-recipe-urls.txt exists, delete any recipe whose source_url matches a line
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY (deletes bypass RLS). Loads `.env.local` from the project root.
 *
 * Usage: npx tsx scripts/delete-seeded-recipes.ts [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";

const DEMO_RECIPE_IDS = [
  "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
  "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb",
  "cccccccc-cccc-cccc-cccc-cccccccccccc",
  "dddddddd-dddd-dddd-dddd-dddddddddddd",
] as const;

const LEGACY_SEED_DESCRIPTION = "Community seed recipe for Discover.";
/** Historical seed author — see docs/operations/scripts.md (Key User IDs) */
const SEED_AUTHOR_ID = "e9f85055-876b-4bde-9267-476567b16884";

const DEMO_CREATOR_IDS = [
  "11111111-1111-1111-1111-111111111111",
  "22222222-2222-2222-2222-222222222222",
  "33333333-3333-3333-3333-333333333333",
  "44444444-4444-4444-4444-444444444444",
] as const;

function loadEnvLocal(): void {
  const p = ".env.local";
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

function readSeedUrls(): string[] {
  const file = `${process.cwd()}/scripts/seed-recipe-urls.txt`;
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");
  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  const seedUrls = readSeedUrls();
  // eslint-disable-next-line no-console
  console.log(
    dryRun ? "[dry-run] Would delete seeded recipes (no DB writes)." : "Deleting seeded recipes…",
  );

  const logSelect = async (label: string, query: ReturnType<typeof sb.from>) => {
    const { data, error } = await query;
    if (error) throw new Error(`${label}: ${error.message}`);
    const n = data?.length ?? 0;
    // eslint-disable-next-line no-console
    console.log(`  ${label}: ${n} row(s)`);
    return data ?? [];
  };

  if (dryRun) {
    await logSelect(
      "demo UUIDs",
      sb.from("recipes").select("id,title").in("id", [...DEMO_RECIPE_IDS]),
    );
    await logSelect(
      "legacy community batch",
      sb
        .from("recipes")
        .select("id,title")
        .eq("description", LEGACY_SEED_DESCRIPTION)
        .eq("author_id", SEED_AUTHOR_ID),
    );
    if (seedUrls.length) {
      await logSelect(
        "discover URL list",
        sb.from("recipes").select("id,title,source_url").in("source_url", seedUrls),
      );
    }
    // eslint-disable-next-line no-console
    console.log("[dry-run] Done.");
    return;
  }

  const { error: e1 } = await sb.from("recipes").delete().in("id", [...DEMO_RECIPE_IDS]);
  if (e1) throw new Error(`delete demo UUIDs: ${e1.message}`);
  // eslint-disable-next-line no-console
  console.log("  deleted demo UUID recipes (if any)");

  const { error: e2 } = await sb
    .from("recipes")
    .delete()
    .eq("description", LEGACY_SEED_DESCRIPTION)
    .eq("author_id", SEED_AUTHOR_ID);
  if (e2) throw new Error(`delete legacy batch: ${e2.message}`);
  // eslint-disable-next-line no-console
  console.log("  deleted legacy community batch (if any)");

  if (seedUrls.length > 0) {
    const { error: e3 } = await sb.from("recipes").delete().in("source_url", seedUrls);
    if (e3) throw new Error(`delete discover URL seeds: ${e3.message}`);
    // eslint-disable-next-line no-console
    console.log(`  deleted recipes matching ${seedUrls.length} URL(s) from seed-recipe-urls.txt`);
  } else {
    // eslint-disable-next-line no-console
    console.log("  (no seed-recipe-urls.txt entries — skipped URL-based delete)");
  }

  const { error: e4 } = await sb.from("creators").delete().in("id", [...DEMO_CREATOR_IDS]);
  if (e4) throw new Error(`delete demo creators: ${e4.message}`);
  // eslint-disable-next-line no-console
  console.log("  deleted demo creators (if any)");

  // eslint-disable-next-line no-console
  console.log("Done.");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
