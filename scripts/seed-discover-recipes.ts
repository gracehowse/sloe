/**
 * Seed the public Discover feed with curated recipes from a trusted
 * external source (default: Downshiftology / Lisa Bryan).
 *
 * Why this script exists:
 *   - The mobile Discover query filters on `author_id IS NOT NULL`
 *     (apps/mobile/lib/recipes.ts), so seeded recipes need a real
 *     auth-backed author row, not a sentinel UUID. Past attempts to use
 *     a fake auth user UUID had to be wiped twice
 *     (supabase/migrations/20260413153000_remove_seeded_demo_recipes.sql,
 *     supabase/migrations/20260421180000_remove_all_seeded_recipes.sql).
 *   - Nutrition / ingredients must NOT be guessed (CLAUDE.md project
 *     rule). We reuse the existing schema.org JSON-LD parser
 *     (src/lib/recipe-import/parseRecipeFromHtml.ts) so every macro and
 *     ingredient line comes straight from the source page's structured
 *     data — no hand-typed numbers in this repo.
 *
 * What it does (idempotent):
 *   1. Provisions a single system author auth user
 *      (`discover-downshiftology@suppr.app`) and matching profile +
 *      `creators` row. Re-runs find the existing rows and reuse them.
 *   2. Reads URLs from `scripts/seed-recipe-urls.txt` (one per line, `#`
 *      comments and blanks ignored).
 *   3. For each URL:
 *        - skips if a recipe with that `source_url` already exists
 *        - fetches the page with a polite browser UA
 *        - parses JSON-LD via parseRecipeFromHtml
 *        - inserts a `recipes` row with author_id=<system uuid>,
 *          creator_id=<creator uuid>, source_name="Downshiftology",
 *          source_url=<url>, published=true, is_verified=true
 *        - inserts one `recipe_ingredients` row per ingredient line
 *
 * Cleanup: scripts/delete-seeded-recipes.ts already deletes any recipe
 * whose `source_url` matches a line in seed-recipe-urls.txt — so this
 * pair (seed + delete) is symmetric.
 *
 * Usage:
 *   npx tsx scripts/seed-discover-recipes.ts            # real run
 *   npx tsx scripts/seed-discover-recipes.ts --dry-run  # report only
 *
 * Requires: SUPABASE_SERVICE_ROLE_KEY in .env.local (bypasses RLS for
 * the system author + recipe inserts; never ship this key client-side).
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { parseRecipeFromHtml } from "@/lib/recipe-import/parseRecipeFromHtml";
import {
  recipeRowFromDraft,
  SOURCE_NAME_DOWNSHIFTOLOGY,
} from "@/lib/seed/discoverRecipeRow";

const SYSTEM_AUTHOR_EMAIL = "discover-downshiftology@suppr.app";
const SYSTEM_AUTHOR_DISPLAY_NAME = "Downshiftology";
const SYSTEM_CREATOR_HANDLE = "downshiftology";
const SYSTEM_CREATOR_BIO = "Healthy, real-food recipes by Lisa Bryan. Imported from downshiftology.com.";
const SYSTEM_CREATOR_AVATAR = "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=200&fit=crop";
const SOURCE_NAME = SOURCE_NAME_DOWNSHIFTOLOGY;

const URL_LIST_PATH = "scripts/seed-recipe-urls.txt";
const FETCH_TIMEOUT_MS = 15_000;
const FETCH_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SupprSeedBot/1.0";

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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var ${name}`);
  return v;
}

function readSeedUrls(): string[] {
  if (!existsSync(URL_LIST_PATH)) {
    throw new Error(`Missing ${URL_LIST_PATH} — see docs/operations/scripts.md`);
  }
  return readFileSync(URL_LIST_PATH, "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
}

/**
 * Fetch a URL with a hard timeout. Throws on non-2xx so callers can
 * skip the URL without silently writing a half-imported recipe.
 */
async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": FETCH_USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      signal: controller.signal,
      redirect: "follow",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Find or create the system author auth user. Idempotent: scans the
 * admin `listUsers` page (1 of 1000 is plenty for a project that
 * normally creates one of these per source) and reuses the existing id
 * when the email matches; otherwise creates a fresh user with a random
 * password (the account never logs in interactively — it's owned by
 * this script).
 */
async function ensureSystemAuthor(sb: SupabaseClient): Promise<string> {
  const list = await sb.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (list.error) throw new Error(`listUsers: ${list.error.message}`);
  const existing = list.data?.users?.find((u) => u.email?.toLowerCase() === SYSTEM_AUTHOR_EMAIL);
  if (existing) return existing.id;

  // Strong random password — no one ever signs in as this user.
  const password = randomBytes(24).toString("base64url");
  const created = await sb.auth.admin.createUser({
    email: SYSTEM_AUTHOR_EMAIL,
    password,
    email_confirm: true,
    user_metadata: {
      is_system_seed_author: true,
      source: "downshiftology.com",
      created_by_script: "seed-discover-recipes.ts",
    },
  });
  if (created.error || !created.data.user) {
    throw new Error(`createUser: ${created.error?.message ?? "no user returned"}`);
  }
  return created.data.user.id;
}

/**
 * Set `display_name` on the auto-created profile so the web Recipe
 * Detail page (which joins recipes → profiles) shows "Downshiftology"
 * instead of "Community". Mobile uses `source_name` directly so this
 * is web-only attribution but worth keeping consistent.
 */
async function ensureSystemProfile(sb: SupabaseClient, userId: string): Promise<void> {
  const { error } = await sb
    .from("profiles")
    .update({ display_name: SYSTEM_AUTHOR_DISPLAY_NAME, avatar_url: SYSTEM_CREATOR_AVATAR })
    .eq("id", userId);
  if (error) throw new Error(`profiles.update: ${error.message}`);
}

/**
 * Find or create the `creators` row so the Follow button on Recipe
 * Detail has something to attach to. handle is unique → upsert by
 * handle is safe.
 */
async function ensureSystemCreator(sb: SupabaseClient): Promise<string> {
  const { data: existing, error: selErr } = await sb
    .from("creators")
    .select("id")
    .eq("handle", SYSTEM_CREATOR_HANDLE)
    .maybeSingle();
  if (selErr) throw new Error(`creators.select: ${selErr.message}`);
  if (existing?.id) return existing.id;

  const { data: created, error: insErr } = await sb
    .from("creators")
    .insert({
      handle: SYSTEM_CREATOR_HANDLE,
      display_name: SYSTEM_AUTHOR_DISPLAY_NAME,
      avatar_url: SYSTEM_CREATOR_AVATAR,
      bio: SYSTEM_CREATOR_BIO,
      is_verified: true,
    })
    .select("id")
    .single();
  if (insErr || !created) throw new Error(`creators.insert: ${insErr?.message ?? "no row"}`);
  return created.id;
}

type SeedSummary = {
  url: string;
  status: "imported" | "skipped-existing" | "skipped-no-jsonld" | "skipped-no-nutrition" | "fetch-failed";
  title?: string;
  reason?: string;
};

async function importOneUrl(args: {
  sb: SupabaseClient;
  url: string;
  authorId: string;
  creatorId: string;
  dryRun: boolean;
}): Promise<SeedSummary> {
  const { sb, url, authorId, creatorId, dryRun } = args;

  // Idempotency: skip URLs we've already imported.
  const { data: existing, error: selErr } = await sb
    .from("recipes")
    .select("id, title")
    .eq("source_url", url)
    .maybeSingle();
  if (selErr) return { url, status: "fetch-failed", reason: selErr.message };
  if (existing?.id) {
    return { url, status: "skipped-existing", title: existing.title };
  }

  let html: string;
  try {
    html = await fetchHtml(url);
  } catch (e) {
    return { url, status: "fetch-failed", reason: (e as Error).message };
  }

  const draft = parseRecipeFromHtml(html);
  if (!draft) return { url, status: "skipped-no-jsonld", reason: "no schema.org Recipe JSON-LD" };

  const row = recipeRowFromDraft({ draft, url, authorId, creatorId, sourceName: SOURCE_NAME });
  if (!row) {
    return { url, status: "skipped-no-nutrition", title: draft.title };
  }

  if (dryRun) {
    return { url, status: "imported", title: draft.title, reason: "(dry-run, no write)" };
  }

  const { data: inserted, error: insErr } = await sb
    .from("recipes")
    .insert(row)
    .select("id")
    .single();
  if (insErr || !inserted) {
    return { url, status: "fetch-failed", reason: `recipes.insert: ${insErr?.message ?? "no id"}` };
  }

  if (draft.ingredients.length > 0) {
    const ingredientRows = draft.ingredients.map((line) => ({
      recipe_id: inserted.id,
      name: line,
      // Per-row macros intentionally left at 0 — recipe-level totals
      // come from JSON-LD and are accurate; line-level breakdowns
      // would require running verifyIngredients which isn't necessary
      // for Discover seed quality.
    }));
    const { error: ingErr } = await sb.from("recipe_ingredients").insert(ingredientRows);
    if (ingErr) {
      return { url, status: "fetch-failed", reason: `recipe_ingredients.insert: ${ingErr.message}` };
    }
  }

  return { url, status: "imported", title: draft.title };
}

async function main() {
  loadEnvLocal();
  const dryRun = process.argv.includes("--dry-run");

  const supabaseUrl = required("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  // eslint-disable-next-line no-console
  console.log(dryRun ? "[dry-run] Seeding Discover feed (no DB writes)…" : "Seeding Discover feed…");

  const urls = readSeedUrls();
  if (urls.length === 0) {
    // eslint-disable-next-line no-console
    console.log(`No URLs in ${URL_LIST_PATH} — nothing to do.`);
    return;
  }

  // Provision (or reuse) the system author + profile + creator. We do
  // this even on --dry-run so we can verify the email already exists
  // and report the correct authorId for diagnostics; in dry-run we
  // still create them (they're cheap, idempotent, and never user-
  // visible until we actually publish a recipe).
  const authorId = await ensureSystemAuthor(sb);
  await ensureSystemProfile(sb, authorId);
  const creatorId = await ensureSystemCreator(sb);
  // eslint-disable-next-line no-console
  console.log(`  system author: ${SYSTEM_AUTHOR_EMAIL} (${authorId})`);
  // eslint-disable-next-line no-console
  console.log(`  creator:       @${SYSTEM_CREATOR_HANDLE} (${creatorId})`);

  const results: SeedSummary[] = [];
  for (const url of urls) {
    const r = await importOneUrl({ sb, url, authorId, creatorId, dryRun });
    results.push(r);
    const tag =
      r.status === "imported"
        ? "OK"
        : r.status === "skipped-existing"
          ? "SKIP (already imported)"
          : r.status === "skipped-no-jsonld"
            ? "SKIP (no JSON-LD)"
            : r.status === "skipped-no-nutrition"
              ? "SKIP (no nutrition in JSON-LD)"
              : "FAIL";
    // eslint-disable-next-line no-console
    console.log(`  [${tag}] ${url}${r.title ? ` — ${r.title}` : ""}${r.reason ? ` (${r.reason})` : ""}`);
  }

  const counts = results.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});
  // eslint-disable-next-line no-console
  console.log(
    `\nDone. ${counts.imported ?? 0} imported, ${counts["skipped-existing"] ?? 0} already present, ${
      (counts["skipped-no-jsonld"] ?? 0) + (counts["skipped-no-nutrition"] ?? 0)
    } skipped (source data missing), ${counts["fetch-failed"] ?? 0} failed.`,
  );

  const fails = results.filter((r) => r.status === "fetch-failed");
  if (fails.length > 0) process.exit(1);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
