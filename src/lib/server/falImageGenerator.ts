/**
 * fal.ai image generator — server-only. UNIFIED ON NANO BANANA PRO (2026-06-08):
 *
 * Part of the Sloe image system (2026-06-08,
 * `docs/decisions/2026-06-08-recipe-ingredient-image-system.md`).
 *
 * Two entry points, one per imagery class from the LOCKED brand prompt
 * template (`docs/brand/sloe-image-prompt-template.md`) — BOTH now on Nano
 * Banana Pro (Google Gemini 3 Pro Image, `fal-ai/nano-banana-pro`):
 *   - `generateDishImage(title, keyIngredients[])`   — Template A, NANO BANANA
 *     PRO, 4:3 landscape hero, 2K, finished plated dish, editorial-on-wood.
 *     Migrated FLUX 2 Pro → Nano 2026-06-08 for hyper-realism (the meatballs
 *     A/B head-to-head proved Nano markedly more photoreal for dish heroes;
 *     also unifies the app on ONE model now ingredients are on Nano). Still
 *     calls the LLM dish-appearance step (`describeDishAppearance`) first so
 *     the per-dish prompt describes the COOKED, plated dish — not a raw
 *     ingredient list (which rendered raw eggs / loose powder on top). The
 *     editorial house style + cooked-state guards now live in a FIXED
 *     `system_prompt` (the consistency lever, mirroring the ingredient path),
 *     so every hero reads as one editorial set. NO fixed seed — each dish is
 *     unique, variety is fine; cache stays per-recipe (recipe_id).
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
 * Nano Banana Pro (Gemini 3 Pro Image) has NO `negative_prompt` field.
 * Both classes therefore carry their style + exclusions in a FIXED
 * `system_prompt` (a true Gemini-3 system instruction — stronger than a
 * positive avoid-clause), with the per-image `prompt` reduced to the one
 * subject (the dish title + LLM cooked-dish description for heroes; the
 * single representative ingredient for tiles).
 * ────────────────────────────────────────────────────────────────────
 *
 * NEVER import this file into a client bundle — it reads `FAL_KEY` and
 * the service-role Storage client.
 */

import { createFalClient } from "@fal-ai/client";
import type { NanoBananaProInput } from "@fal-ai/client/endpoints";
import { getSupabaseAdminClient } from "../supabase/serverAdminClient";
import { describeDishAppearance } from "./llmDishAppearance";

/**
 * BOTH classes now run on Nano Banana Pro (Google Gemini 3 Pro Image).
 * Template A (dish heroes) migrated FLUX 2 Pro → Nano 2026-06-08 for
 * hyper-realism (the meatballs A/B head-to-head proved Nano markedly more
 * photoreal for dish heroes), which also unifies the app on ONE model. The
 * prompt templates are model-swappable; the per-image prompt does not change
 * when the model does. See docs/brand/sloe-image-prompt-template.md §6 +
 * the 2026-06-08 decision doc.
 */
// Model is env-swappable. FLUX dev is the cheap bulk run NOW (~$0.02/image,
// luxury-grade editorial food photography — verified 2026-06-08); Nano Banana
// Pro returns for the launch hero set. Override with FAL_IMAGE_MODEL.
export const FAL_IMAGE_MODEL = process.env.FAL_IMAGE_MODEL?.trim() || "fal-ai/flux/dev";
const FAL_MODEL = FAL_IMAGE_MODEL;
const IS_FLUX = /flux/i.test(FAL_MODEL);

/** Map the brand template's aspect_ratio to a FLUX `image_size` enum.
 *  (FLUX has no aspect_ratio field; it takes a named image_size.) */
function aspectToImageSize(ar: string): string {
  switch (ar) {
    case "1:1": return "square_hd";
    case "4:3": return "landscape_4_3";
    case "3:2": return "landscape_4_3";
    case "16:9": return "landscape_16_9";
    case "3:4": return "portrait_4_3";
    case "9:16": return "portrait_16_9";
    default: return "square_hd";
  }
}
/**
 * Template A (dish heroes) — the editorial house style + cooked-state guards,
 * pinned identically on EVERY hero call (the consistency lever, mirroring the
 * ingredient approach). Carries everything the FLUX positive prompt used to
 * fold in — editorial register, soft moody window light, shallow DoF, warm
 * earthy palette, the no-people/no-text guards, AND the cooked-state guards
 * that keep raw ingredients off the surface. Nano honours a separate
 * `system_prompt` (a true Gemini-3 system instruction, stronger than a
 * positive avoid-clause), so the consistency + the "nothing raw on top" rule
 * live here, NOT in the per-dish line. DO NOT EDIT per call. Verbatim from the
 * locked Template A Nano recipe (docs/brand/sloe-image-prompt-template.md §1).
 *
 * Exported so the guard test can assert the cooked-state guards survive — they
 * are the load-bearing raw-eggs protection now they live here, not in the
 * per-dish prompt.
 */
export const DISH_SYSTEM_PROMPT =
  "Warm editorial food photography for a premium recipe app. Soft moody natural window light from " +
  "the side, slightly under-exposed editorial mood, shallow depth of field — the dish sharp, the " +
  "background softly blurred. Warm, muted, earthy palette: browns, creams, sage greens, ochre. " +
  "Styled on a linen napkin over a weathered wooden table, matte ceramic dishware. Magazine-quality, " +
  "in the register of @thelittleplantation and @_foodstories_. Ultra-realistic photograph, fine " +
  "natural detail and texture, real food. Never illustrated, never 3D-rendered, never glossy CGI. " +
  "No people, no hands, no fingers, no text, no logo, no watermark. The dish is fully cooked and " +
  "integrated, served exactly as it would be eaten — no raw or uncooked ingredients, no whole raw " +
  "eggs, no loose powder, nothing raw piled on top.";
/**
 * Template B (single ingredient on white) — the consistency lever. Pinned,
 * identical on EVERY ingredient call — DO NOT EDIT per call (it is what keeps
 * lighting/scale/shadow identical across the whole library). Verbatim from the
 * locked Template B Nano recipe.
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

/** Storage upload cap for a generated image — generous; a Nano 2K jpeg is
 *  typically < 3 MB. Guards against a runaway fetch. */
const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

/** Function-level timeout for a single Nano generation. fal's own client-side
 *  `timeout` is documented as not enforced, so we bound it ourselves. A 2K Nano
 *  gen normally lands in ~40s; this is generous headroom for queue load while
 *  still guaranteeing the call never hangs a backfill / server request forever
 *  (the module's never-hang contract). On timeout, callers get a typed
 *  `fal_network_error` and fall back to the placeholder. */
const NANO_TIMEOUT_MS = 180_000;

/** Marker error so `runNano` can distinguish our own timeout from a fal/network
 *  throw and map it to a typed `fal_network_error`. */
class FalTimeoutError extends Error {}

/** Resolve `p`, or reject with `FalTimeoutError` after `ms`. The timer is always
 *  cleared so it can't keep the event loop alive after settle. The underlying
 *  fal request is abandoned (fal may still finish it server-side — harmless;
 *  the per-recipe cache means a later run reuses it). */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new FalTimeoutError(`timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => clearTimeout(timer));
}

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

/**
 * Template A per-dish `prompt` — just the ONE subject (the dish title + the
 * LLM cooked-dish description), mirroring the ingredient approach. The whole
 * editorial house style (light, surface, palette, register) AND the
 * cooked-state guards now live in the FIXED `DISH_SYSTEM_PROMPT` (a true
 * Gemini-3 system instruction on Nano), NOT here — so every hero reads as one
 * consistent editorial set even though the per-dish line is short.
 *
 * ── The cooked-dish-description rule (the raw-eggs bug fix — KEPT) ─────
 * `dishDescription` is the one-to-two sentence description of how the
 * FINISHED, cooked, plated dish looks when served, from
 * `describeDishAppearance`. Never pass a raw ingredient LIST here — that is
 * exactly the bug the LLM step + the system-prompt cooked-state guards exist
 * to prevent (FLUX rendered "featuring eggs, protein powder" as whole raw eggs
 * / loose powder on top; the cooked-dish description + guards fixed it, and
 * that fix is preserved on Nano).
 *
 * @param title           recipe title (lightly cleaned upstream)
 * @param dishDescription one-to-two sentence cooked-dish description (from
 *   `describeDishAppearance`). When empty, the prompt still renders a generic
 *   finished dish steered by the system prompt — but callers should always
 *   supply one.
 */
export function buildDishPrompt(title: string, dishDescription: string): string {
  const cleanTitle = title.trim() || "a home-cooked dish";
  const description = dishDescription.trim();
  const descriptionClause = description ? ` ${description}` : "";
  return `Hyperreal editorial food photography of ${cleanTitle}.${descriptionClause}`.trimEnd();
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

type NanoImage = { url?: string; content_type?: string };
type NanoOutput = { images?: NanoImage[] };

/**
 * Run a single Nano Banana Pro (Gemini 3 Pro Image) generation. ONE runner for
 * BOTH classes now they share the model (dish heroes Template A + ingredient
 * tiles Template B). The per-class shape is passed in:
 *   - dish heroes:   `aspect_ratio: "4:3"`, NO seed (variety per dish),
 *                    `DISH_SYSTEM_PROMPT`.
 *   - ingredients:   `aspect_ratio: "1:1"`, FIXED `seed: 424242`,
 *                    `INGREDIENT_SYSTEM_PROMPT`.
 * Both use `resolution: "2K"`, `output_format: "jpeg"`. Returns the first
 * image URL (a short-lived fal CDN URL) or a typed error. Never throws.
 *
 * Note: `system_prompt` is passed through `input` even though the generated
 * fal TS type for Nano doesn't enumerate it — fal serializes the whole input
 * object to the model (Gemini 3 Pro Image honours a system instruction, which
 * is what makes the house style + cooked-state guards the consistency lever).
 * If a future fal release rejects unknown keys, fold the system prompt into
 * the positive `prompt` (it is the consistency lever either way).
 *
 * Reliability: we pin `mode: "polling"` with an explicit `pollInterval` + an
 * `onQueueUpdate` callback. Without an active queue-update subscription the fal
 * client's `subscribe` polls Nano very slowly and can appear to hang on the 2K
 * Gemini-3 endpoint (verified 2026-06-08: an identical call WITHOUT
 * `onQueueUpdate` stalled >60s with no result, WITH it resolved in ~40s). We do
 * not need the log stream, but `logs: true` is the proven-reliable shape that
 * keeps the poll active; the streamed status is tiny and discarded.
 */
async function runNano(
  prompt: string,
  opts: {
    systemPrompt: string;
    aspectRatio: NonNullable<NanoBananaProInput["aspect_ratio"]>;
    seed?: number;
  },
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
    // FLUX takes a named `image_size` and has NO `system_prompt` field, so the
    // house-style system instruction folds into the positive prompt (the
    // consistency lever either way — see the note above). Nano keeps the typed
    // shape. 28 steps / guidance 3.5 = FLUX dev's quality sweet spot.
    const falInput = IS_FLUX
      ? {
          prompt: [opts.systemPrompt, prompt].filter(Boolean).join("\n\n"),
          image_size: aspectToImageSize(opts.aspectRatio),
          num_inference_steps: 28,
          guidance_scale: 3.5,
          num_images: 1,
          enable_safety_checker: true,
          ...(opts.seed != null ? { seed: opts.seed } : {}),
        }
      : ({
          prompt,
          system_prompt: opts.systemPrompt,
          aspect_ratio: opts.aspectRatio,
          resolution: "2K",
          output_format: "jpeg",
          num_images: 1,
          // Dish heroes omit the seed (variety per dish); ingredient tiles pin
          // one seed so the whole set is reproducibly coherent.
          ...(opts.seed != null ? { seed: opts.seed } : {}),
        } as NanoBananaProInput & { system_prompt: string });
    // Bounded with our own timeout race: fal's client-side `timeout` field is
    // documented as "currently not enforced", so we guard the function-level
    // hang ourselves. A 2K Nano gen normally lands in ~40s; under heavy queue
    // load it can be slower. NANO_TIMEOUT_MS is generous, but bounded so a
    // stuck call returns a typed `fal_network_error` instead of blocking a
    // backfill or a server request forever (the module's never-hang contract).
    result = await withTimeout(
      client.subscribe(FAL_MODEL, {
        input: falInput,
        // Active polling — the proven-reliable shape for the 2K Nano endpoint
        // (see the reliability note above). The status callback is a no-op; its
        // presence is what keeps the queue poll running.
        mode: "polling",
        pollInterval: 1000,
        logs: true,
        onQueueUpdate: () => {},
      }),
      NANO_TIMEOUT_MS,
    );
  } catch (err) {
    if (err instanceof FalTimeoutError) {
      console.warn(`[${callSite}] nano generate timed out after ${NANO_TIMEOUT_MS}ms`);
      return {
        ok: false,
        error: "fal_network_error",
        message: `Nano generation exceeded ${Math.round(NANO_TIMEOUT_MS / 1000)}s.`,
        upstreamStatus: null,
      };
    }
    // fal throws an ApiError (with `.status`) on 4xx/5xx, including the
    // 403 "Exhausted balance" account-lock. Classify but never rethrow.
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
 * Generate a finished-dish hero image (Template A, Nano Banana Pro). Returns
 * the stored public URL or a typed error. Never throws, never blocks.
 *
 * Pipeline:
 *   1. Ask the LLM for a one-to-two sentence description of how the
 *      FINISHED, cooked, plated dish looks (`describeDishAppearance`).
 *      This KEPT step replaces the old raw "featuring {ingredients}" clause
 *      that rendered whole raw eggs / loose powder on top of the dish. The
 *      call never throws and falls back to a generic cooked clause.
 *   2. Build the short per-dish prompt (title + that description) and
 *      generate with Nano (`fal-ai/nano-banana-pro`) at `aspect_ratio: "4:3"`,
 *      `resolution: "2K"`, `output_format: "jpeg"`, NO seed (variety per
 *      dish). The editorial house style + cooked-state guards ride on the
 *      FIXED `DISH_SYSTEM_PROMPT` (the consistency lever), then persist to
 *      Storage. Cache stays per-recipe (the caller keys by recipe_id).
 *
 * @param title          dish title (lightly cleaned upstream)
 * @param keyIngredients 3–6 visually-defining ingredients (optional) —
 *   used ONLY to inform the LLM dish description, never listed verbatim
 *   in the image prompt.
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
  // 4:3 landscape hero, no seed — each dish is unique, variety is fine. The
  // house style + cooked-state guards live in DISH_SYSTEM_PROMPT.
  const nano = await runNano(
    prompt,
    { systemPrompt: DISH_SYSTEM_PROMPT, aspectRatio: "4:3" },
    callSite,
  );
  if (!nano.ok) return nano;
  const stored = await persistToStorage(
    nano.imageUrl,
    HERO_PREFIX,
    slugify(title, "recipe-hero"),
    callSite,
  );
  if (!stored.ok) return stored;
  return { ok: true, url: stored.publicUrl, requestId: nano.requestId };
}

/**
 * Generate a single-ingredient image (Template B, Nano Banana Pro). Returns
 * the stored public URL or a typed error. Never throws, never blocks.
 *
 * Uses the FIXED `INGREDIENT_SYSTEM_PROMPT` + FIXED seed so the whole
 * ingredient library reads as one consistent set. The per-image prompt is just
 * the ONE representative subject ("A single whole head of garlic." etc.) —
 * never the literal recipe quantity.
 *
 * @param cleanName a tidy single-ingredient label
 *   (e.g. from `cleanIngredientDisplayName`)
 */
export async function generateIngredientImage(cleanName: string): Promise<FalImageResult> {
  const callSite = "fal/ingredient";
  const prompt = buildIngredientPrompt(cleanName);
  const nano = await runNano(
    prompt,
    { systemPrompt: INGREDIENT_SYSTEM_PROMPT, aspectRatio: "1:1", seed: INGREDIENT_SEED },
    callSite,
  );
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
