/**
 * fal.ai FLUX-2-pro image generator — server-only.
 *
 * Part of the Sloe image system (2026-06-08,
 * `docs/decisions/2026-06-08-recipe-ingredient-image-system.md`).
 *
 * Two entry points, one per imagery class from the LOCKED brand prompt
 * template (`docs/brand/sloe-image-prompt-template.md`):
 *   - `generateDishImage(title, keyIngredients[])`   — Template A,
 *     landscape_4_3, finished plated dish, editorial-on-wood. Calls the
 *     LLM dish-appearance step (`describeDishAppearance`) first so the
 *     prompt describes the COOKED, plated dish — not a raw ingredient
 *     list (which made FLUX render raw eggs / loose powder on top).
 *   - `generateIngredientImage(cleanName)`           — Template B,
 *     square_hd, single ingredient on pure white.
 *
 * Both: build the prompt verbatim from the template, call
 * `fal-ai/flux-2-pro`, download the returned image, upload it to
 * Supabase Storage (service-role), and return `{ ok, url }` or a typed
 * `{ ok: false, error }`.
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
import { getSupabaseAdminClient } from "../supabase/serverAdminClient";
import { describeDishAppearance } from "./llmDishAppearance";

const FAL_MODEL = "fal-ai/flux-2-pro";
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

/** Template B positive prompt — single ingredient on pure white (§2). */
export function buildIngredientPrompt(cleanName: string): string {
  const subject = cleanName.trim() || "a single fresh ingredient";
  return (
    `Stylised-photoreal product photograph of ${subject}, a single subject isolated on a pure white ` +
    `seamless background. Soft natural daylight, gentle soft shadow directly beneath the subject. ` +
    `Sharp focus, high detail, true-to-life colour, clean and uncluttered. Hyperreal photographic ` +
    `style with light studio-product lighting. No surface texture, no props, no background scenery. ` +
    `${STYLE_ANCHOR} ${AVOID_CLAUSE}`
  );
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
 * Generate a single-ingredient image (Template B). Returns the stored
 * public URL or a typed error. Never throws, never blocks.
 *
 * @param cleanName a tidy single-ingredient label
 *   (e.g. from `cleanIngredientDisplayName`)
 */
export async function generateIngredientImage(cleanName: string): Promise<FalImageResult> {
  const callSite = "fal/ingredient";
  const prompt = buildIngredientPrompt(cleanName);
  const flux = await runFlux(prompt, "square_hd", callSite);
  if (!flux.ok) return flux;
  const stored = await persistToStorage(
    flux.imageUrl,
    INGREDIENT_PREFIX,
    slugify(cleanName, "ingredient"),
    callSite,
  );
  if (!stored.ok) return stored;
  return { ok: true, url: stored.publicUrl, requestId: flux.requestId };
}

/** True when `FAL_KEY` is configured. Callers use this to skip the
 *  network round-trip entirely when generation is known-unavailable. */
export function isFalConfigured(): boolean {
  return readFalKey() !== null;
}
