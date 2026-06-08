/**
 * fal.ai image generator — server-only. DUAL ENGINE (2026-06-08):
 *
 * Part of the Sloe image system (2026-06-08,
 * `docs/decisions/2026-06-08-recipe-ingredient-image-system.md`).
 *
 * Two entry points, one per imagery class from the LOCKED brand prompt
 * template (`docs/brand/sloe-image-prompt-template.md`):
 *   - `generateDishImage(title, keyIngredients[])`   — Template A, FLUX 2 Pro
 *     (`fal-ai/flux-2-pro`), landscape_4_3, finished plated dish,
 *     editorial-on-wood. Calls the LLM dish-appearance step
 *     (`describeDishAppearance`) first so the prompt describes the COOKED,
 *     plated dish — not a raw ingredient list (which made FLUX render raw
 *     eggs / loose powder on top). UNCHANGED.
 *   - `generateIngredientImage(cleanName)`           — Template B, NANO BANANA
 *     PRO (`fal-ai/nano-banana-pro`, Google Gemini 3 Pro Image), 1:1, 2K,
 *     single ingredient on pure white. Switched from FLUX 2026-06-08: Nano +
 *     a FIXED `system_prompt` + a FIXED seed (424242) produces a CONSISTENT
 *     set (identical lighting/scale/shadow) so a grid of tiles reads as one
 *     library. The per-image prompt is just the ONE representative subject.
 *
 * Both: build the prompt from the locked template, call the engine, download
 * the returned image, upload it to Supabase Storage (service-role), and
 * return `{ ok, url }` or a typed `{ ok: false, error }`.
 *
 * ── GRACEFUL DEGRADATION (load-bearing) ────────────────────────────
 * fal.ai is OUT OF BALANCE at time of writing — the account is locked
 * ("Exhausted balance") and every generate call 403s. This module is
 * built so that NEVER crashes and NEVER blocks a save:
 *   - `FAL_KEY` missing            → `{ ok:false, error:"fal_not_configured" }`
 *   - fal throws / 4xx / 5xx / lock → `{ ok:false, error:"fal_http_error"|… }`
 *   - upload fails                  → `{ ok:false, error:"upload_failed" }`
 * Every caller treats a non-ok result as "no image" and falls back to
 * the on-brand placeholder. There is no `throw` on the happy or sad
 * path — the worst case is a typed error object. The instant the fal
 * balance is topped up, this works unchanged.
 *
 * FLUX 2 Pro has NO `negative_prompt` field, so the §5 "never" list is
 * folded into the POSITIVE prompt as an explicit "Avoid: …" clause
 * (the template's §5 guidance). FLUX-2 follows the positive literally,
 * so this is phrased as constraints, not bare "no X" tokens.
 * ────────────────────────────────────────────────────────────────────
 *
 * NEVER import this file into a client bundle — it reads `FAL_KEY` and
 * the service-role Storage client.
 */

import { createFalClient } from "@fal-ai/client";
import type { NanoBananaProInput } from "@fal-ai/client/endpoints";
import { getSupabaseAdminClient } from "../supabase/serverAdminClient";
import { describeDishAppearance } from "./llmDishAppearance";

/** Template A (dish heroes) — FLUX 2 Pro, unchanged. */
const FAL_MODEL = "fal-ai/flux-2-pro";
/**
 * Template B (single ingredient on white) — Nano Banana Pro (Google Gemini 3
 * Pro Image). Switched 2026-06-08: Nano produces a CONSISTENT set (the brand
 * head-to-head winner + what the top competitor uses), driven by a FIXED
 * `system_prompt` + a FIXED seed so a grid of ingredient tiles reads as one
 * coherent set. The FLUX path stays on Template A (dish heroes) only.
 * See docs/brand/sloe-image-prompt-template.md §2 (Template B, Nano recipe)
 * + the 2026-06-08 decision doc.
 */
const FAL_INGREDIENT_MODEL = "fal-ai/nano-banana-pro";
/**
 * The consistency lever. Pinned, identical on EVERY ingredient call — DO NOT
 * EDIT per call (it is what keeps lighting/scale/shadow identical across the
 * whole library). Verbatim from the locked Template B Nano recipe.
 */
const INGREDIENT_SYSTEM_PROMPT =
  "Studio product photography of a single food ingredient for a premium nutrition app. " +
  "ALWAYS, identically for every ingredient: exactly one subject, centred, on a pure white " +
  "seamless background; soft even natural daylight from the front-left; one soft natural shadow " +
  "directly beneath the subject; sharp focus; true-to-life natural colour; clean and uncluttered; " +
  "NO props, NO bowl, NO plate, NO utensils, NO scenery, NO hands, NO text or labels. Warm, calm, " +
  "editorial, photographic — never illustrated, never 3D-rendered, never glossy CGI. Keep lighting, " +
  "scale, camera angle and shadow identical across every ingredient so a grid of them reads as one " +
  "consistent set.";
/** Fixed seed for the whole ingredient set — reproducible coherent batch. */
const INGREDIENT_SEED = 424242;

const BUCKET = "recipe-images";
const HERO_PREFIX = "heroes";
const INGREDIENT_PREFIX = "ingredients";

/** Storage upload cap for a generated image — generous; FLUX png output
 *  is typically < 2 MB at these sizes. Guards against a runaway fetch. */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export type FalImageOk = { ok: true; url: string; requestId: string | null };
export type FalImageError = {
  ok: false;
  /** Stable, vendor-neutral error code for callers + logs. */
  error:
    | "fal_not_configured"
    | "fal_http_error"
    | "fal_network_error"
    | "fal_no_image"
    | "download_failed"
    | "upload_failed"
    | "storage_not_configured";
  /** Human-readable detail (never surfaced to end users). */
  message: string;
  /** Upstream HTTP status when known (fal lock = 403). */
  upstreamStatus?: number | null;
};
export type FalImageResult = FalImageOk | FalImageError;

function readFalKey(): string | null {
  // Same idiom as aiProvider.readKeys() — trim + empty-as-null.
  return process.env.FAL_KEY?.trim() || null;
}

// ── Prompt assembly (verbatim from the LOCKED template) ──────────────

/** §4 shared style anchor block — appended to every positive prompt. */
const STYLE_ANCHOR =
  "Sloe brand imagery. Warm, calm, editorial, premium, honest. Natural light only. " +
  "Earthy muted palette. Real food, real materials, real kitchen. Considered restraint, " +
  "never busy, never gimmicky. Photographic, not illustrated, not rendered. High detail, " +
  "professional quality.";

/**
 * §5 negative list, folded into a POSITIVE "Avoid" clause because
 * FLUX-2-pro has no negative_prompt field. Phrased as constraints the
 * model can follow literally.
 */
const AVOID_CLAUSE =
  "Avoid: flat stock photography, white-tablecloth overhead commercial style, watercolour, " +
  "painterly or loose illustration, cartoon, anime, clip art, vector or flat design, 3D render, " +
  "CGI, cold glossy chrome, plastic-looking food, glossy product render, oversaturation, neon, " +
  "HDR, harsh studio flash, hard shadows, busy cluttered composition, any text, words, letters, " +
  "typography, logos, watermarks, signatures, brand labels or packaging text, people, hands, " +
  "faces or fingers, deformed or fused ingredients, melted shapes, anything uncanny or " +
  "unappetising, low detail, blurry subject, distorted proportions, duplicated objects, frames, " +
  "borders, collage or split images.";

const PLATING_DEFAULT = "bowl";

/** Pick a plating noun from the dish title (§1 `{PLATING_NOUN}` rules). */
function inferPlatingNoun(title: string): string {
  const t = title.toLowerCase();
  if (/\b(smoothie|shake|juice|latte|drink|cocktail)\b/.test(t)) return "glass";
  if (/\b(bread|loaf|focaccia|bun|roll|bake|tart|sharing)\b/.test(t)) return "wooden board";
  if (/\b(skillet|frittata|traybake|one-pan|one pan)\b/.test(t)) return "skillet";
  if (/\b(steak|roast|fish|salmon|chop|fillet|schnitzel|main)\b/.test(t)) return "plate";
  // stews / grains / salads / pasta / soup / bowl → default bowl
  return PLATING_DEFAULT;
}

/**
 * §1 cooked-state GUARDS, folded into the positive prompt.
 *
 * ── The bug this fixes ────────────────────────────────────────────────
 * The previous Template-A prompt listed raw ingredients ("featuring eggs,
 * protein powder, spinach…"). FLUX-2-pro follows the positive prompt
 * literally and rendered those ingredients RAW, sitting on top of the
 * cooked dish — whole raw eggs on a frittata, loose powder heaped on oats.
 *
 * The fix is two-pronged: (1) `buildDishPrompt` now takes an LLM-written
 * description of the FINISHED, cooked, plated dish instead of a raw
 * ingredient list (see `llmDishAppearance.describeDishAppearance`), and
 * (2) these explicit cooked-state guards are appended so the model is
 * told, in the positive, that nothing raw belongs on the surface. FLUX-2
 * has no negative_prompt, so — like the §5 AVOID_CLAUSE — these are
 * phrased as positive constraints the model can follow.
 */
const COOKED_STATE_GUARDS =
  "The dish is fully cooked and integrated, served exactly as it would be eaten — no raw or " +
  "uncooked ingredients, no whole raw eggs, no runny yolks on top, no loose or dry powder, " +
  "nothing raw piled on the surface. No people, no hands, no fingers. No text, no logo, no watermark.";

/**
 * Template A positive prompt — finished dish (§1).
 *
 * @param title           recipe title (lightly cleaned upstream)
 * @param dishDescription one-to-two sentence description of how the
 *   FINISHED, cooked, plated dish looks when served (from
 *   `describeDishAppearance`). When empty, the prompt still renders a
 *   generic finished dish — but callers should always supply one; passing
 *   a raw ingredient LIST here is exactly the bug `COOKED_STATE_GUARDS`
 *   and the LLM step exist to prevent.
 */
export function buildDishPrompt(title: string, dishDescription: string): string {
  const cleanTitle = title.trim() || "a home-cooked dish";
  const description = dishDescription.trim();
  const descriptionClause = description ? ` ${description}` : "";
  const plating = inferPlatingNoun(cleanTitle);
  return (
    `Hyperreal editorial food photography of ${cleanTitle}.${descriptionClause} ` +
    `The finished dish is served in a matte ceramic ${plating}, styled on a linen napkin over a ` +
    `weathered wooden table, a few natural props nearby. Soft moody natural window light from the ` +
    `side, gentle shadows, slightly under-exposed for an editorial mood. Shallow depth of field, the ` +
    `dish sharp and the background softly blurred. Warm, muted, earthy colour palette — browns, ` +
    `creams, sage greens, ochre. Artful, considered, unhurried composition. Magazine-quality food ` +
    `photography in the style of @thelittleplantation and @_foodstories_. ${COOKED_STATE_GUARDS} ` +
    `${STYLE_ANCHOR} ${AVOID_CLAUSE}`
  );
}

/**
 * Loose, pourable / heap-forming foods that must be shown as "a small neat
 * mound of X" (ONE consistent treatment for all loose items — not a bowl for
 * one and a pile for another). Matched on the cleaned subject (lowercased).
 */
const LOOSE_ITEM_RE =
  /\b(salt|pepper|peppercorns?|oregano|thyme|basil|rosemary|parsley|cilantro|coriander|paprika|cumin|cinnamon|turmeric|chil(?:li|i)\s*(?:flakes|powder)|flour|sugar|oats?|rice|quinoa|couscous|breadcrumbs?|sesame seeds?|flaked almonds?|protein powder|cocoa(?:\s*powder)?|baking powder|baking soda|spice|seasoning)\b/i;

/**
 * Liquids / condiments shown as a simple unlabelled pour or small portion in
 * a plain clear vessel — consistent per class (no branded bottle, no label).
 */
const LIQUID_ITEM_RE =
  /\b(oil|sauce|honey|syrup|vinegar|milk|cream|yog(?:h)?urt|juice|broth|stock|crisp|condiment|dressing|paste|puree|passata|tahini|mustard|ketchup|mayonnaise)\b/i;

/**
 * Build the per-image `prompt` for Nano (Template B). Just the ONE
 * representative subject — never the literal recipe quantity. Loose foods →
 * "a small neat mound of X"; liquids/condiments → "a small unlabelled portion
 * of X"; everything else → "a single X". The consistency comes from the
 * FIXED system prompt + seed, not from this line.
 */
export function buildIngredientPrompt(cleanName: string): string {
  const raw = cleanName.trim().toLowerCase().replace(/\.$/, "");
  const subject = raw || "fresh ingredient";
  if (LOOSE_ITEM_RE.test(subject)) {
    return `A small neat mound of ${subject}.`;
  }
  if (LIQUID_ITEM_RE.test(subject)) {
    return `A small unlabelled portion of ${subject} in a simple clear vessel.`;
  }
  return `A single ${subject}.`;
}

// ── fal call + Storage upload ────────────────────────────────────────

type FluxImage = { url?: string; content_type?: string };
type FluxOutput = { images?: FluxImage[] };

/**
 * Run a single FLUX-2-pro generation. Returns the first image URL (a
 * short-lived fal CDN URL) or a typed error. Never throws.
 */
async function runFlux(
  prompt: string,
  imageSize: "landscape_4_3" | "square_hd",
  callSite: string,
): Promise<{ ok: true; imageUrl: string; requestId: string | null } | FalImageError> {
  const key = readFalKey();
  if (!key) {
    return {
      ok: false,
      error: "fal_not_configured",
      message: "FAL_KEY is not set — image generation is unavailable.",
      upstreamStatus: null,
    };
  }

  const client = createFalClient({ credentials: key });

  let result: { data: unknown; requestId: string };
  try {
    result = await client.subscribe(FAL_MODEL, {
      input: {
        prompt,
        image_size: imageSize,
        // FLUX-2-pro outputs jpeg/png only (no webp at the model). Per
        // template §6 we generate png then store it; a transcode-to-webp
        // pass at the storage layer is a future optimisation, not a
        // launch blocker. `persistToStorage` stamps the right extension
        // from the response content-type.
        output_format: "png",
        // provider defaults for guidance/steps/safety — the prompt
        // carries the style; do not over-tune (template §6).
      },
      logs: false,
    });
  } catch (err) {
    // fal throws an ApiError (with `.status`) on 4xx/5xx, including the
    // 403 "Exhausted balance" account-lock. Classify but never rethrow.
    const status =
      typeof (err as { status?: unknown })?.status === "number"
        ? (err as { status: number }).status
        : null;
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(`[${callSite}] fal generate failed status=${status ?? "?"}: ${detail}`);
    if (status != null) {
      return {
        ok: false,
        error: "fal_http_error",
        message: `fal returned ${status}.`,
        upstreamStatus: status,
      };
    }
    return {
      ok: false,
      error: "fal_network_error",
      message: "Could not reach fal.ai.",
      upstreamStatus: null,
    };
  }

  const out = result.data as FluxOutput | null;
  const imageUrl = out?.images?.[0]?.url;
  if (typeof imageUrl !== "string" || imageUrl.trim() === "") {
    return {
      ok: false,
      error: "fal_no_image",
      message: "fal returned no image URL.",
      upstreamStatus: null,
    };
  }
  return { ok: true, imageUrl, requestId: result.requestId ?? null };
}

type NanoImage = { url?: string; content_type?: string };
type NanoOutput = { images?: NanoImage[] };

/**
 * Run a single Nano Banana Pro ingredient generation (Template B). Uses the
 * FIXED `system_prompt` + FIXED `seed` so the whole library is one coherent
 * set; `aspect_ratio: 1:1`, `resolution: 2K`, `output_format: jpeg` per the
 * locked recipe. Returns the first image URL or a typed error. Never throws.
 *
 * Note: `system_prompt` is passed through `input` even though the generated
 * fal TS type for Nano doesn't enumerate it — fal serializes the whole input
 * object to the model (Gemini 3 Pro Image honours a system instruction). If a
 * future fal release rejects unknown keys, fold the system prompt into the
 * positive `prompt` (it is the consistency lever either way).
 */
async function runNanoIngredient(
  prompt: string,
  callSite: string,
): Promise<{ ok: true; imageUrl: string; requestId: string | null } | FalImageError> {
  const key = readFalKey();
  if (!key) {
    return {
      ok: false,
      error: "fal_not_configured",
      message: "FAL_KEY is not set — image generation is unavailable.",
      upstreamStatus: null,
    };
  }

  const client = createFalClient({ credentials: key });

  let result: { data: unknown; requestId: string };
  try {
    // `system_prompt` is a Gemini-3 passthrough not enumerated on the fal TS
    // type for Nano, so attach it alongside the typed fields. The cast keeps
    // the required `prompt` typed while permitting the extra key.
    const nanoInput: NanoBananaProInput & { system_prompt: string } = {
      prompt,
      system_prompt: INGREDIENT_SYSTEM_PROMPT,
      aspect_ratio: "1:1",
      resolution: "2K",
      output_format: "jpeg",
      seed: INGREDIENT_SEED,
      num_images: 1,
    };
    result = await client.subscribe(FAL_INGREDIENT_MODEL, {
      input: nanoInput,
      logs: false,
    });
  } catch (err) {
    const status =
      typeof (err as { status?: unknown })?.status === "number"
        ? (err as { status: number }).status
        : null;
    const detail = err instanceof Error ? err.message : String(err);
    console.warn(`[${callSite}] nano generate failed status=${status ?? "?"}: ${detail}`);
    if (status != null) {
      return {
        ok: false,
        error: "fal_http_error",
        message: `fal returned ${status}.`,
        upstreamStatus: status,
      };
    }
    return {
      ok: false,
      error: "fal_network_error",
      message: "Could not reach fal.ai.",
      upstreamStatus: null,
    };
  }

  const out = result.data as NanoOutput | null;
  const imageUrl = out?.images?.[0]?.url;
  if (typeof imageUrl !== "string" || imageUrl.trim() === "") {
    return {
      ok: false,
      error: "fal_no_image",
      message: "fal returned no image URL.",
      upstreamStatus: null,
    };
  }
  return { ok: true, imageUrl, requestId: result.requestId ?? null };
}

/**
 * Download the generated image from the fal CDN and upload it to
 * Supabase Storage under `{bucket}/{prefix}/{slug}.webp`. Returns the
 * public URL or a typed error. Never throws.
 */
async function persistToStorage(
  imageUrl: string,
  prefix: string,
  slug: string,
  callSite: string,
): Promise<{ ok: true; publicUrl: string } | FalImageError> {
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return {
      ok: false,
      error: "storage_not_configured",
      message: "SUPABASE_SERVICE_ROLE_KEY is not set — cannot store the generated image.",
      upstreamStatus: null,
    };
  }

  let bytes: Buffer;
  let contentType = "image/webp";
  try {
    const res = await fetch(imageUrl);
    if (!res.ok) {
      console.warn(`[${callSite}] image download failed status=${res.status}`);
      return {
        ok: false,
        error: "download_failed",
        message: `Image download returned ${res.status}.`,
        upstreamStatus: res.status,
      };
    }
    const ct = res.headers.get("content-type");
    if (ct) contentType = ct;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_IMAGE_BYTES) {
      return {
        ok: false,
        error: "download_failed",
        message: "Generated image exceeded the size cap.",
        upstreamStatus: null,
      };
    }
    bytes = buf;
  } catch (err) {
    console.warn(`[${callSite}] image download threw`, err);
    return {
      ok: false,
      error: "download_failed",
      message: "Could not download the generated image.",
      upstreamStatus: null,
    };
  }

  const ext = contentType.includes("png") ? "png" : contentType.includes("jpeg") ? "jpg" : "webp";
  const path = `${prefix}/${slug}-${Date.now()}.${ext}`;
  const { error: uploadError } = await admin.storage.from(BUCKET).upload(path, bytes, {
    cacheControl: "31536000",
    upsert: true,
    contentType,
  });
  if (uploadError) {
    console.warn(`[${callSite}] storage upload failed: ${uploadError.message}`);
    return {
      ok: false,
      error: "upload_failed",
      message: uploadError.message,
      upstreamStatus: null,
    };
  }
  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  return { ok: true, publicUrl: data.publicUrl };
}

/** Lowercase-slug a label for a deterministic-ish storage filename. */
function slugify(input: string, fallback: string): string {
  const s = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return s || fallback;
}

/**
 * Generate a finished-dish hero image (Template A). Returns the stored
 * public URL or a typed error. Never throws, never blocks.
 *
 * Pipeline:
 *   1. Ask the LLM for a one-to-two sentence description of how the
 *      FINISHED, cooked, plated dish looks (`describeDishAppearance`).
 *      This replaces the old raw "featuring {ingredients}" clause that
 *      made FLUX render whole raw eggs / loose powder on top of the dish.
 *      The call never throws and falls back to a generic cooked clause.
 *   2. Build the Template-A prompt from that description + cooked-state
 *      guards, generate with FLUX-2-pro, and persist to Storage.
 *
 * @param title          dish title (lightly cleaned upstream)
 * @param keyIngredients 3–6 visually-defining ingredients (optional) —
 *   used ONLY to inform the LLM dish description, never listed verbatim
 *   in the FLUX prompt.
 * @param opts.userId    optional Supabase user id, for AI attribution on
 *   the dish-description LLM call.
 */
export async function generateDishImage(
  title: string,
  keyIngredients: string[] = [],
  opts: { userId?: string | null } = {},
): Promise<FalImageResult> {
  const callSite = "fal/dish";
  const dishDescription = await describeDishAppearance(title, keyIngredients, {
    userId: opts.userId ?? null,
  });
  const prompt = buildDishPrompt(title, dishDescription);
  const flux = await runFlux(prompt, "landscape_4_3", callSite);
  if (!flux.ok) return flux;
  const stored = await persistToStorage(
    flux.imageUrl,
    HERO_PREFIX,
    slugify(title, "recipe-hero"),
    callSite,
  );
  if (!stored.ok) return stored;
  return { ok: true, url: stored.publicUrl, requestId: flux.requestId };
}

/**
 * Generate a single-ingredient image (Template B, Nano Banana Pro). Returns
 * the stored public URL or a typed error. Never throws, never blocks.
 *
 * Uses Nano (not FLUX) with the FIXED system prompt + seed so the whole
 * ingredient library reads as one consistent set (the FLUX dish/hero path is
 * untouched). The per-image prompt is just the ONE representative subject
 * ("A single whole head of garlic." etc.) — never the literal recipe quantity.
 *
 * @param cleanName a tidy single-ingredient label
 *   (e.g. from `cleanIngredientDisplayName`)
 */
export async function generateIngredientImage(cleanName: string): Promise<FalImageResult> {
  const callSite = "fal/ingredient";
  const prompt = buildIngredientPrompt(cleanName);
  const nano = await runNanoIngredient(prompt, callSite);
  if (!nano.ok) return nano;
  const stored = await persistToStorage(
    nano.imageUrl,
    INGREDIENT_PREFIX,
    slugify(cleanName, "ingredient"),
    callSite,
  );
  if (!stored.ok) return stored;
  return { ok: true, url: stored.publicUrl, requestId: nano.requestId };
}

/** True when `FAL_KEY` is configured. Callers use this to skip the
 *  network round-trip entirely when generation is known-unavailable. */
export function isFalConfigured(): boolean {
  return readFalKey() !== null;
}
