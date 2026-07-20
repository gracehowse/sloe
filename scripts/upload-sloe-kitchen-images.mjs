#!/usr/bin/env node

/**
 * Publish founder-approved Sloe Kitchen seed heroes to the public
 * `recipe-images` bucket. Upload paths are deterministic and upserts make the
 * operation safe to repeat.
 *
 * Usage:
 *   node scripts/upload-sloe-kitchen-images.mjs --dry
 *   node scripts/upload-sloe-kitchen-images.mjs
 */

import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import WebSocket from "ws";

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_DIR = resolve(REPO_ROOT, "content/sloe-kitchen/v1");
const BUCKET = "recipe-images";
const STORAGE_PREFIX = "sloe-kitchen/v1";
const DRY = process.argv.includes("--dry");

loadDotEnv(resolve(REPO_ROOT, ".env.local"));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const recipes = JSON.parse(
  readFileSync(resolve(CONTENT_DIR, "recipes.json"), "utf8"),
).recipes;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
  realtime: { transport: WebSocket },
});
const hostedImages = [];

for (const recipe of recipes) {
  const localPath = resolve(CONTENT_DIR, recipe.image);
  const storagePath = `${STORAGE_PREFIX}/${recipe.slug}.jpg`;
  if (!existsSync(localPath)) throw new Error(`Missing image for ${recipe.slug}: ${localPath}`);

  if (!DRY) {
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(storagePath, readFileSync(localPath), {
        cacheControl: "31536000",
        contentType: "image/jpeg",
        upsert: true,
      });
    if (error) throw new Error(`Upload failed for ${recipe.slug}: ${error.message}`);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(storagePath);
  hostedImages.push({
    slug: recipe.slug,
    bucket: BUCKET,
    path: storagePath,
    url: data.publicUrl,
  });
  console.log(`${DRY ? "DRY " : "UPLOADED "}${recipe.slug}`);
}

if (!DRY) {
  const outputPath = resolve(CONTENT_DIR, "hosted-images.json");
  writeFileSync(
    outputPath,
    `${JSON.stringify(
      {
        version: 1,
        storage: "Supabase Storage public recipe-images bucket",
        images: hostedImages,
      },
      null,
      2,
    )}\n`,
  );
  console.log(`Wrote ${outputPath}`);
}

function loadDotEnv(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}
