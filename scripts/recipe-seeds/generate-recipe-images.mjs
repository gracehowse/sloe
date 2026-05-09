#!/usr/bin/env node
/**
 * Generate hero images for every Suppr Kitchen recipe.
 *
 * Reads the per-recipe prompt + slug + title from the source SQLite
 * SQL dump (the same file `convert-suppr-kitchen.mjs` consumed), calls
 * OpenAI's gpt-image-1, uploads to the public `recipe-images` Supabase
 * bucket, and stamps `recipes.image_url` for the matching title.
 *
 * Idempotent: skips any recipe whose `image_url` is already non-null.
 * Re-runnable. Failures on individual recipes don't abort the batch.
 *
 * Run:
 *   node scripts/recipe-seeds/generate-recipe-images.mjs \
 *     "/path/to/recipes.sql"
 *
 * Env required:
 *   - OPENAI_API_KEY
 *   - NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL)
 *   - SUPABASE_SERVICE_ROLE_KEY
 *
 * Cost: ~$0.04 per image × 63 = ~$2.50 total. Throttled to 2 calls/sec
 * to keep well under OpenAI's image rate limits.
 */
import fs from "node:fs";
import { Buffer } from "node:buffer";

const SRC_SQL = process.argv[2];
if (!SRC_SQL) {
  console.error("Usage: node generate-recipe-images.mjs <recipes.sql>");
  process.exit(2);
}

// ─── env ──────────────────────────────────────────────────────────────
function loadDotenv(path) {
  if (!fs.existsSync(path)) return;
  const text = fs.readFileSync(path, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = /^([A-Z_][A-Z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    )
      val = val.slice(1, -1);
    if (process.env[m[1]] == null) process.env[m[1]] = val;
  }
}
loadDotenv(".env.local");
loadDotenv(".env");

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!OPENAI_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    "Missing env: OPENAI_API_KEY / SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(2);
}

// ─── parse the source SQL for {slug, title, prompt} per recipe ────────
const SRC = fs.readFileSync(SRC_SQL, "utf8");

// Recipes INSERT shape:
//   INSERT INTO recipes (slug, title, …) VALUES ('slug-x', 'Title X', …);
// We just need slug + title.
const recipeMap = new Map(); // slug -> { slug, title, prompt }
{
  const re =
    /INSERT INTO recipes \(slug, title,[\s\S]+?VALUES\s*\(\s*'([^']+)'\s*,\s*'((?:[^']|'')+)'/g;
  let m;
  while ((m = re.exec(SRC)) !== null) {
    const slug = m[1];
    const title = m[2].replace(/''/g, "'");
    recipeMap.set(slug, { slug, title, prompt: null });
  }
}

// Images INSERT shape:
//   INSERT INTO images (recipe_id, role, file_path, prompt, model, license)
//     VALUES ((SELECT id FROM recipes WHERE slug = 'slug-x'), 'hero', 'images/x.png',
//             'A stack of …', 'gpt-image-1', 'AI-generated; see README');
{
  const re =
    /INSERT INTO images[\s\S]+?WHERE slug\s*=\s*'([^']+)'\s*\)\s*,\s*'hero'\s*,\s*'[^']*'\s*,\s*'((?:[^']|'')+?)'\s*,\s*'gpt-image-1'/g;
  let m;
  while ((m = re.exec(SRC)) !== null) {
    const recipe = recipeMap.get(m[1]);
    if (recipe) recipe.prompt = m[2].replace(/''/g, "'");
  }
}

const recipes = [...recipeMap.values()].filter((r) => r.prompt);
console.error(
  `Parsed ${recipes.length} recipes with hero prompts (of ${recipeMap.size} total)`,
);
if (recipes.length === 0) {
  console.error("No recipes parsed — aborting");
  process.exit(1);
}

// ─── Supabase helpers (service role; no library dependency) ───────────
async function supabaseFetch(path, init = {}) {
  const headers = {
    apikey: SUPABASE_SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    ...(init.headers ?? {}),
  };
  return fetch(`${SUPABASE_URL}${path}`, { ...init, headers });
}

async function getNeedingImages() {
  const url = `/rest/v1/recipes?select=id,title,image_url&source_name=eq.Suppr%20Kitchen`;
  const res = await supabaseFetch(url, {
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(
      `recipes select failed: ${res.status} ${await res.text()}`,
    );
  }
  return await res.json();
}

async function uploadImage(slug, bytes) {
  const objectPath = `${slug}.png`;
  const res = await supabaseFetch(
    `/storage/v1/object/recipe-images/${objectPath}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "image/png",
        "x-upsert": "true",
      },
      body: bytes,
    },
  );
  if (!res.ok) {
    throw new Error(
      `storage upload failed: ${res.status} ${await res.text()}`,
    );
  }
  return `${SUPABASE_URL}/storage/v1/object/public/recipe-images/${objectPath}`;
}

async function setImageUrl(recipeId, imageUrl) {
  const res = await supabaseFetch(
    `/rest/v1/recipes?id=eq.${encodeURIComponent(recipeId)}`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ image_url: imageUrl }),
    },
  );
  if (!res.ok) {
    throw new Error(
      `recipes update failed: ${res.status} ${await res.text()}`,
    );
  }
}

// ─── OpenAI gpt-image-1 ────────────────────────────────────────────────
async function generateImage(prompt) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      n: 1,
      size: "1024x1024",
      // Default quality is "standard" / "auto"; gpt-image-1 returns
      // base64 unless `response_format: "url"` is set, but only DALL-E 3
      // accepts response_format. For gpt-image-1 the response shape is
      // always {data: [{b64_json: …}]}.
    }),
  });
  if (!res.ok) {
    throw new Error(`openai image gen failed: ${res.status} ${await res.text()}`);
  }
  const json = await res.json();
  const b64 = json?.data?.[0]?.b64_json;
  if (!b64) throw new Error("openai response missing b64_json");
  return Buffer.from(b64, "base64");
}

// ─── orchestration ────────────────────────────────────────────────────
function slugFromTitle(title, fallback) {
  // Mirrors the source-SQL slug closely enough — but we resolve via
  // title from the live DB anyway, this is just for the storage object
  // path. Use the source-SQL slug when available (passed in), otherwise
  // derive from the title.
  if (fallback) return fallback;
  return title
    .toLowerCase()
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

async function main() {
  // Build live target list — only recipes that need images.
  const live = await getNeedingImages();
  const liveByTitle = new Map(live.map((r) => [r.title.toLowerCase(), r]));

  const queue = [];
  for (const r of recipes) {
    const liveRow = liveByTitle.get(r.title.toLowerCase());
    if (!liveRow) {
      console.warn(`SKIP "${r.title}" — no matching live recipe row`);
      continue;
    }
    if (liveRow.image_url) {
      console.error(`skip "${r.title}" — already has image_url`);
      continue;
    }
    queue.push({ ...r, recipeId: liveRow.id });
  }
  console.error(`${queue.length} images to generate`);

  let succeeded = 0;
  let failed = 0;
  for (const r of queue) {
    try {
      console.error(`[${succeeded + failed + 1}/${queue.length}] ${r.title}`);
      const bytes = await generateImage(r.prompt);
      const url = await uploadImage(slugFromTitle(r.title, r.slug), bytes);
      await setImageUrl(r.recipeId, url);
      succeeded++;
      // Throttle: 500ms between calls = 2 req/sec, well under
      // OpenAI's images/generations rate limit.
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      failed++;
      console.error(`FAIL "${r.title}":`, err?.message ?? err);
    }
  }
  console.error(`Done — ${succeeded} succeeded, ${failed} failed`);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
