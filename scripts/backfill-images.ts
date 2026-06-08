#!/usr/bin/env tsx
/**
 * Sloe image system backfill — generate on-brand images for existing
 * data (2026-06-08, docs/decisions/2026-06-08-recipe-ingredient-image-system.md).
 *
 * Two independent passes:
 *
 *   (a) HEROES — for every recipe whose `image_url` is NULL or the legacy
 *       default Unsplash cover, generate a Template-A dish hero
 *       (`generateDishImage`) and write it to `recipes.image_url`.
 *
 *   (b) INGREDIENTS — for each DISTINCT canonical ingredient key across
 *       `recipe_ingredients` (keyed by `normalizeIngredientNameKey`),
 *       generate a Template-B single-ingredient image
 *       (`generateIngredientImage`) and upsert a row into
 *       `ingredient_images` (name_key, display_name, image_url, status).
 *
 * ── IMPORTANT: needs fal.ai FUNDED to do anything ──────────────────
 * fal.ai is currently OUT OF BALANCE (account locked). With no funds the
 * generator returns `{ ok:false, error:"fal_http_error", upstreamStatus:403 }`
 * for every call. This script handles that gracefully — it logs the
 * failure per item and moves on, writing `status:'failed'` for ingredient
 * rows so a later re-run retries them — but it will produce ZERO images
 * until the balance is topped up. DO NOT expect output before then.
 * (Tracked: top-up + run = the Linear issue referenced in the decision.)
 * ────────────────────────────────────────────────────────────────────
 *
 * Idempotent + dry-run-by-default:
 *   - DRY RUN is the DEFAULT. Pass `--apply` (or APPLY=1) to actually
 *     generate + write. A dry run prints exactly what WOULD be generated
 *     and makes no fal calls and no DB writes.
 *   - Heroes pass skips recipes that already have a non-default image.
 *   - Ingredients pass skips keys already `ready` in `ingredient_images`;
 *     `pending`/`failed` rows are retried.
 *   - Rate-limited (default 1 req / 1.2 s) to be gentle on fal + storage.
 *   - `--limit N` caps how many items each pass processes (spot-check
 *     before a full run). `--heroes-only` / `--ingredients-only` scope it.
 *
 * Required env (.env.local), only when `--apply`:
 *   FAL_KEY                        (fal.ai — must be FUNDED)
 *   NEXT_PUBLIC_SUPABASE_URL  (or  SUPABASE_URL / SUPABASE_PROJECT_ID)
 *   SUPABASE_SERVICE_ROLE_KEY      (writes bypass RLS)
 *
 * Usage:
 *   npx tsx scripts/backfill-images.ts                 # dry run, both passes
 *   npx tsx scripts/backfill-images.ts --apply --limit 5
 *   npx tsx scripts/backfill-images.ts --apply --ingredients-only
 */

import { createClient } from "@supabase/supabase-js";
import { normalizeIngredientNameKey } from "../src/lib/planning/ingredientNameKey";
import { cleanIngredientDisplayName } from "../src/lib/recipe/cleanIngredientDisplayName";
import {
  generateDishImage,
  generateIngredientImage,
  isFalConfigured,
} from "../src/lib/server/falImageGenerator";

// ── args ──────────────────────────────────────────────────────────────
const argv = new Set(process.argv.slice(2));
const APPLY = argv.has("--apply") || process.env.APPLY === "1";
const HEROES_ONLY = argv.has("--heroes-only");
const INGREDIENTS_ONLY = argv.has("--ingredients-only");
const limitArg = process.argv.find((a) => a.startsWith("--limit"));
const LIMIT = limitArg
  ? Number.parseInt(limitArg.split("=")[1] ?? process.argv[process.argv.indexOf(limitArg) + 1] ?? "0", 10) || null
  : null;
const RATE_MS = 1200;

// The legacy default cover the upload flows write when no image exists.
const DEFAULT_COVER_IMAGE =
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop";

function log(...args: unknown[]) {
  console.log("[backfill-images]", ...args);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isPlaceholderImage(url: string | null | undefined): boolean {
  if (!url || url.trim() === "") return true;
  if (url === DEFAULT_COVER_IMAGE) return true;
  // Any Unsplash stock URL counts as "no real image" for the heroes pass.
  return url.includes("images.unsplash.com");
}

// ── supabase (only needed for --apply) ────────────────────────────────
function getClient() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    (process.env.SUPABASE_PROJECT_ID ? `https://${process.env.SUPABASE_PROJECT_ID}.supabase.co` : "");
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "[backfill-images] --apply requires NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }
  return createClient(url, key);
}

// ── heroes pass ───────────────────────────────────────────────────────
async function runHeroes(sb: ReturnType<typeof createClient> | null) {
  log("── heroes pass ──");
  if (!sb) {
    log("(dry run) would query recipes with null/default image_url and generate a Template-A hero for each.");
    return;
  }

  const { data, error } = await sb
    .from("recipes")
    .select("id, title, image_url")
    .order("created_at", { ascending: true });
  if (error) {
    log("recipes query failed:", error.message);
    return;
  }

  const candidates = (data ?? []).filter((r) =>
    isPlaceholderImage((r as { image_url?: string | null }).image_url),
  );
  const scoped = LIMIT ? candidates.slice(0, LIMIT) : candidates;
  log(`${candidates.length} recipes need a hero; processing ${scoped.length}.`);

  let generated = 0;
  let failed = 0;
  for (const r of scoped) {
    const id = (r as { id: string }).id;
    const title = String((r as { title?: string }).title ?? "");

    // Pull a few key ingredient names for the prompt (best-effort).
    const { data: ingRows } = await sb
      .from("recipe_ingredients")
      .select("name")
      .eq("recipe_id", id)
      .limit(8);
    const keyIngredients = (ingRows ?? [])
      .map((x) => cleanIngredientDisplayName(String((x as { name?: string }).name ?? "")))
      .filter(Boolean)
      .slice(0, 6);

    const result = await generateDishImage(title, keyIngredients);
    if (!result.ok) {
      failed++;
      log(`  ✗ "${title}" (${id}) — ${result.error}${result.upstreamStatus ? ` [${result.upstreamStatus}]` : ""}`);
    } else {
      const { error: upErr } = await sb
        .from("recipes")
        .update({ image_url: result.url })
        .eq("id", id);
      if (upErr) {
        failed++;
        log(`  ✗ "${title}" (${id}) — db update failed: ${upErr.message}`);
      } else {
        generated++;
        log(`  ✓ "${title}" (${id}) → ${result.url}`);
      }
    }
    await sleep(RATE_MS);
  }
  log(`heroes done — generated ${generated}, failed ${failed}.`);
}

// ── ingredients pass ──────────────────────────────────────────────────
async function runIngredients(sb: ReturnType<typeof createClient> | null) {
  log("── ingredients pass ──");
  if (!sb) {
    log("(dry run) would collect distinct canonical keys across recipe_ingredients and generate a Template-B image per key.");
    return;
  }

  // Distinct canonical keys across all recipe ingredient rows.
  const { data, error } = await sb.from("recipe_ingredients").select("name");
  if (error) {
    log("recipe_ingredients query failed:", error.message);
    return;
  }
  const keyToDisplay = new Map<string, string>();
  for (const row of data ?? []) {
    const raw = String((row as { name?: string }).name ?? "");
    const key = normalizeIngredientNameKey(raw);
    if (key && !keyToDisplay.has(key)) {
      keyToDisplay.set(key, cleanIngredientDisplayName(raw) || raw);
    }
  }

  // Which keys already have a ready image? Skip those.
  const { data: existing } = await sb
    .from("ingredient_images")
    .select("name_key, status");
  const readyKeys = new Set(
    (existing ?? [])
      .filter((e) => (e as { status?: string }).status === "ready")
      .map((e) => String((e as { name_key?: string }).name_key ?? "")),
  );

  const pending = Array.from(keyToDisplay.entries()).filter(([k]) => !readyKeys.has(k));
  const scoped = LIMIT ? pending.slice(0, LIMIT) : pending;
  log(
    `${keyToDisplay.size} distinct ingredients (${readyKeys.size} already ready); processing ${scoped.length}.`,
  );

  let generated = 0;
  let failed = 0;
  for (const [key, display] of scoped) {
    // Claim the row as pending first so a crash mid-run is resumable.
    await sb
      .from("ingredient_images")
      .upsert({ name_key: key, display_name: display, status: "pending" }, { onConflict: "name_key" });

    const result = await generateIngredientImage(display);
    if (!result.ok) {
      failed++;
      await sb
        .from("ingredient_images")
        .update({ status: "failed" })
        .eq("name_key", key);
      log(`  ✗ ${display} (${key}) — ${result.error}${result.upstreamStatus ? ` [${result.upstreamStatus}]` : ""}`);
    } else {
      const { error: upErr } = await sb
        .from("ingredient_images")
        .update({ image_url: result.url, status: "ready" })
        .eq("name_key", key);
      if (upErr) {
        failed++;
        log(`  ✗ ${display} (${key}) — db update failed: ${upErr.message}`);
      } else {
        generated++;
        log(`  ✓ ${display} (${key}) → ${result.url}`);
      }
    }
    await sleep(RATE_MS);
  }
  log(`ingredients done — generated ${generated}, failed ${failed}.`);
}

// ── main ──────────────────────────────────────────────────────────────
async function main() {
  log(APPLY ? "APPLY mode — will generate + write." : "DRY RUN — no fal calls, no DB writes. Pass --apply to run for real.");

  if (APPLY && !isFalConfigured()) {
    log("WARNING: FAL_KEY is not set. Every generation will fail (fal_not_configured). Aborting apply.");
    log("Set FAL_KEY (funded) in .env.local, then re-run with --apply.");
    process.exit(1);
  }

  const sb = APPLY ? getClient() : null;

  if (!INGREDIENTS_ONLY) await runHeroes(sb);
  if (!HEROES_ONLY) await runIngredients(sb);

  log("done.");
}

main().catch((err) => {
  console.error("[backfill-images] fatal:", err);
  process.exit(1);
});
