#!/usr/bin/env node
// F-64 (2026-04-22): one-shot backfill that re-fetches each seeded
// recipe's source_url HTML, extracts og:image (falling back to
// twitter:image, then leaving the existing URL alone), and updates
// `recipes.image_url` in prod Supabase. Fixes TestFlight
// build-28 `APpAKhhR` ("Images are here but they are terrible") —
// the seeded rows were pointing at 200-225px JSON-LD thumbnails
// while the canonical full-size originals live in og:image.
//
// Safe to re-run — idempotent, skips rows whose current image_url
// already matches what we'd pull. Run with --dry to preview.
//
// Env:
//   SUPABASE_SERVICE_ROLE_KEY  required — service role key
//   NEXT_PUBLIC_SUPABASE_URL   required
//
// Usage:
//   node scripts/reseed-recipe-images.mjs              # apply
//   node scripts/reseed-recipe-images.mjs --dry        # preview
//   node scripts/reseed-recipe-images.mjs --limit 5    # small batch

import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
loadDotEnv(resolve(REPO_ROOT, ".env.local"));

const DRY = process.argv.includes("--dry");
const LIMIT_ARG = process.argv.findIndex((a) => a === "--limit");
const LIMIT = LIMIT_ARG > 0 ? Number(process.argv[LIMIT_ARG + 1]) : 500;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data, error } = await sb
    .from("recipes")
    .select("id, title, source_url, image_url")
    .not("author_id", "is", null)
    .eq("published", true)
    .order("created_at", { ascending: false })
    .limit(LIMIT);
  if (error) {
    console.error("Supabase select failed:", error.message);
    process.exit(1);
  }
  console.log(`${DRY ? "[DRY] " : ""}Scanning ${data.length} published seeded rows...\n`);

  let updated = 0;
  let unchanged = 0;
  let skipped = 0;
  for (const row of data) {
    if (!row.source_url) {
      skipped++;
      continue;
    }
    try {
      const html = await fetchHtml(row.source_url);
      if (!html) {
        skipped++;
        console.log(`  ✗ ${row.title} — fetch failed`);
        continue;
      }
      const og = extractOgImage(html);
      const next = og ? upscaleImageUrl(og) : null;
      if (!next) {
        skipped++;
        console.log(`  · ${row.title} — no og:image`);
        continue;
      }
      if (next === row.image_url) {
        unchanged++;
        continue;
      }
      console.log(`  ✓ ${row.title}`);
      console.log(`    was: ${row.image_url}`);
      console.log(`    now: ${next}`);
      if (!DRY) {
        const { error: upErr } = await sb
          .from("recipes")
          .update({ image_url: next })
          .eq("id", row.id);
        if (upErr) {
          console.error(`    ! update failed: ${upErr.message}`);
          continue;
        }
      }
      updated++;
    } catch (err) {
      skipped++;
      console.log(`  ! ${row.title} — ${err instanceof Error ? err.message : err}`);
    }
  }
  console.log(
    `\nDone. ${updated} ${DRY ? "would be updated" : "updated"}, ${unchanged} already correct, ${skipped} skipped.`,
  );
}

async function fetchHtml(url) {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36",
      },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

function extractOgImage(html) {
  const og =
    html.match(
      /<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]*content=["']([^"']+)["']/i,
    ) ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image(?::secure_url)?["']/i,
    );
  if (og?.[1]) return og[1].trim();
  const tw =
    html.match(
      /<meta[^>]+name=["']twitter:image(?::src)?["'][^>]*content=["']([^"']+)["']/i,
    ) ??
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]*name=["']twitter:image(?::src)?["']/i,
    );
  return tw?.[1]?.trim() ?? null;
}

function upscaleImageUrl(url) {
  try {
    const parsed = new URL(url);
    for (const k of ["fit", "resize", "w", "h", "width", "height"]) parsed.searchParams.delete(k);
    parsed.pathname = parsed.pathname.replace(/-(\d{2,4})x(\d{2,4})(\.[a-zA-Z0-9]+)$/, "$3");
    return parsed.toString();
  } catch {
    return url;
  }
}

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    const [, k, rawV] = m;
    if (process.env[k]) continue;
    process.env[k] = rawV.replace(/^['"]|['"]$/g, "");
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
