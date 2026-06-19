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
 *       `recipe_ingredients` (keyed by `canonicalImageKey` — the SAME key
 *       the display readers use, so write-key == read-key), generate a
 *       Template-B single-ingredient image (`generateIngredientImage`, Nano
 *       Banana Pro studio-on-white) and upsert a row into `ingredient_images`
 *       (name_key, display_name, image_url, status).
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
 *   - `--regenerate-heroes` FORCE-overwrites the existing AI-generated
 *     heroes (recipes whose `image_url` points at the generated
 *     `recipe-images/heroes/` storage path). Use this to re-run the dish
 *     hero generation after the prompt changes (e.g. the cooked-state
 *     fix). It still NEVER touches real imported/external images (e.g.
 *     Instagram CDN covers) — those are not under the `heroes/` path.
 *   - Ingredients pass skips keys already `ready` in `ingredient_images`;
 *     `pending`/`failed` rows are retried.
 *   - `--regenerate-ingredients` FORCE-regenerates EVERY canonical key
 *     (overwrites existing `ready` tiles). Used for the 2026-06-08 re-key +
 *     Nano Banana Pro re-shoot of the whole ingredient library.
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
 *   # regenerate ONLY the existing AI heroes with the new prompt:
 *   npx tsx scripts/backfill-images.ts --apply --heroes-only --regenerate-heroes
 *   # re-key + regenerate the WHOLE ingredient library on Nano Banana Pro:
 *   npx tsx scripts/backfill-images.ts --apply --ingredients-only --regenerate-ingredients
 */

import { createClient } from "@supabase/supabase-js";
import { canonicalImageKey } from "../src/lib/recipe/canonicalImageKey";
import { cleanIngredientDisplayName } from "../src/lib/recipe/cleanIngredientDisplayName";
import {
  FAL_IMAGE_MODEL,
  generateDishImage,
  generateIngredientImage,
  isFalConfigured,
} from "../src/lib/server/falImageGenerator";

// ── args ──────────────────────────────────────────────────────────────
const argv = new Set(process.argv.slice(2));
const APPLY = argv.has("--apply") || process.env.APPLY === "1";
const HEROES_ONLY = argv.has("--heroes-only");
const INGREDIENTS_ONLY = argv.has("--ingredients-only");
/** Force-overwrite the existing AI-generated heroes (those under the
 *  `recipe-images/heroes/` storage path). Real imported/external images
 *  are never touched (they're not under that path). */
const REGENERATE_HEROES = argv.has("--regenerate-heroes");
/** Force-regenerate EVERY ingredient tile — re-runs generation for all
 *  canonical keys even those already `ready`. Used for the 2026-06-08 re-key
 *  + Nano Banana Pro re-shoot (overwrite the old inconsistent FLUX tiles).
 *  Without this, `ready` rows are skipped (normal idempotent behaviour). */
const REGENERATE_INGREDIENTS = argv.has("--regenerate-ingredients");
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

/** A previously AI-generated dish hero. These live in the `recipe-images`
 *  Storage bucket under the `heroes/` prefix (see `falImageGenerator`
 *  HERO_PREFIX). This is the precise signal that distinguishes the
 *  generated heroes from real imported/external covers (Instagram CDN,
 *  user uploads) — only generated heroes carry this path, so
 *  `--regenerate-heroes` can force-overwrite them and nothing else. */
function isGeneratedHero(url: string | null | undefined): boolean {
  return !!url && url.includes("/recipe-images/heroes/");
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
  if (REGENERATE_HEROES) {
    log("--regenerate-heroes ON: will FORCE-overwrite existing AI-generated heroes (recipe-images/heroes/), in addition to null/placeholder images. Real imported/external covers are left untouched.");
  }
  if (!sb) {
    log(
      REGENERATE_HEROES
        ? "(dry run) would query recipes with null/default image_url OR an existing generated hero and generate a fresh Template-A hero for each."
        : "(dry run) would query recipes with null/default image_url and generate a Template-A hero for each.",
    );
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

  const candidates = (data ?? []).filter((r) => {
    const url = (r as { image_url?: string | null }).image_url;
    // Always re-process recipes with no real image. With --regenerate-heroes,
    // ALSO re-process recipes whose current image is a generated hero
    // (overwrite). Never matches real imported/external covers.
    return isPlaceholderImage(url) || (REGENERATE_HEROES && isGeneratedHero(url));
  });
  const scoped = LIMIT ? candidates.slice(0, LIMIT) : candidates;
  log(`${candidates.length} recipes to (re)generate a hero for; processing ${scoped.length}.`);

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
        .update({
          image_url: result.url,
          image_source: "ai_generated",
          image_model: FAL_IMAGE_MODEL,
          image_generated_at: new Date().toISOString(),
        })
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
  // Canonical key per distinct ingredient — the SAME key the display
  // readers use (`canonicalImageKey`), so write-key == read-key. The first
  // raw name that maps to a key wins as the display/prompt subject (cleaned).
  const keyToDisplay = new Map<string, string>();
  for (const row of data ?? []) {
    const raw = String((row as { name?: string }).name ?? "");
    const key = canonicalImageKey(raw);
    if (key && !keyToDisplay.has(key)) {
      keyToDisplay.set(key, cleanIngredientDisplayName(raw) || raw);
    }
  }

  // Which keys already have a ready image? Skip those — UNLESS
  // --regenerate-ingredients is set (then re-generate every key to overwrite
  // the old inconsistent FLUX tiles with the new Nano Banana Pro set).
  const { data: existing } = await sb
    .from("ingredient_images")
    .select("name_key, status");
  const readyKeys = new Set(
    (existing ?? [])
      .filter((e) => (e as { status?: string }).status === "ready")
      .map((e) => String((e as { name_key?: string }).name_key ?? "")),
  );

  if (REGENERATE_INGREDIENTS) {
    log(
      "--regenerate-ingredients ON: will FORCE-regenerate EVERY canonical ingredient key (overwrite existing ready tiles) with the new Nano Banana Pro recipe.",
    );
  }

  const pending = Array.from(keyToDisplay.entries()).filter(
    ([k]) => REGENERATE_INGREDIENTS || !readyKeys.has(k),
  );
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
