/**
 * POST /api/recipe-import/image-hero — generate an on-brand dish hero
 * image for a recipe (fal.ai Nano Banana Pro, Template A) and write it to
 * `recipes.image_url`.
 *
 * Part of the Sloe image system (2026-06-08,
 * `docs/decisions/2026-06-08-recipe-ingredient-image-system.md`).
 *
 * Auth + tier mirror `/api/recipe-import/image`:
 *   - must be signed in (401 otherwise)
 *   - Pro-gated — image GENERATION is a Pro feature (free tier still
 *     gets the on-brand placeholder + any imported/YouTube thumbnail).
 *
 * GRACEFUL DEGRADATION (load-bearing): fal.ai is currently OUT OF
 * BALANCE (account locked). This route NEVER crashes and is safe to
 * fire-and-forget from the create/import flows:
 *   - fal unconfigured / locked / errored → 200 `{ ok:false, skipped:true,
 *     reason }`. Callers ignore it; the recipe already saved with the
 *     placeholder. No 5xx, no thrown error, no blocked save.
 *   - only on a real success does it update `recipes.image_url` and
 *     return `{ ok:true, url }`.
 *
 * Body: `{ recipeId: string, title?: string, ingredients?: string[] }`.
 * Ownership is enforced — the caller may only set the hero on a recipe
 * they authored.
 */

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest, getUserTier } from "@/lib/supabase/serverAnonClient";
import { getSupabaseAdminClient } from "@/lib/supabase/serverAdminClient";
import { importErrorResponse } from "@/lib/recipes/importErrorCopy";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import {
  FAL_IMAGE_MODEL,
  generateDishImage,
  isFalConfigured,
} from "@/lib/server/falImageGenerator";
import { assertOrigin } from "@/lib/api/assertOrigin";

export const runtime = "nodejs";
export const maxDuration = 60;

type Payload = {
  recipeId?: unknown;
  title?: unknown;
  ingredients?: unknown;
};

/** 200 + `skipped` so a fire-and-forget caller treats this as a no-op,
 *  never an error. The recipe keeps its placeholder image. */
function skipped(reason: string) {
  return NextResponse.json({ ok: false, skipped: true, reason }, { status: 200 });
}

export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  // Shared kill switch with the other import paths.
  if (await isServerFeatureEnabled("kill_recipe_import")) {
    return skipped("import_killed");
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    return NextResponse.json(importErrorResponse("unauthorized"), { status: 401 });
  }

  // Pro-gated (parity with the image-extraction route). Free users get
  // the placeholder + any imported thumbnail — never a 5xx here.
  const tier = await getUserTier(userId);
  if (tier === "free") {
    return NextResponse.json(importErrorResponse("pro_required"), { status: 403 });
  }

  // Per-user rate limit — generation is expensive; cap it.
  const limited = await rateLimit({
    keyPrefix: "api:recipe-import-image-hero",
    userId,
    limit: 10,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ...importErrorResponse("rate_limited"), retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  // If fal isn't even configured, no-op cleanly without touching the DB
  // or making a network call.
  if (!isFalConfigured()) {
    return skipped("fal_not_configured");
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json(importErrorResponse("invalid_body"), { status: 400 });
  }

  const recipeId = typeof body.recipeId === "string" ? body.recipeId.trim() : "";
  if (!recipeId) {
    return NextResponse.json(
      { ...importErrorResponse("invalid_body"), message: "recipeId is required." },
      { status: 400 },
    );
  }
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const ingredients = Array.isArray(body.ingredients)
    ? body.ingredients.map((s) => String(s).trim()).filter(Boolean).slice(0, 6)
    : [];

  const admin = getSupabaseAdminClient();
  if (!admin) {
    // Misconfigured server — degrade, don't 5xx the (fire-and-forget) caller.
    return skipped("storage_not_configured");
  }

  // Ownership check + fetch the title we'll generate for (and confirm the
  // recipe still wants a generated hero — only overwrite a null/default).
  const { data: recipeRow, error: fetchError } = await admin
    .from("recipes")
    .select("id, title, author_id, image_url")
    .eq("id", recipeId)
    .maybeSingle();

  if (fetchError) {
    captureRouteError(fetchError, "/api/recipe-import/image-hero", { stage: "fetch" });
    return skipped("fetch_failed");
  }
  if (!recipeRow || (recipeRow as { author_id?: string }).author_id !== userId) {
    // Not the user's recipe (or gone) — refuse without leaking which.
    return NextResponse.json(importErrorResponse("unauthorized"), { status: 403 });
  }

  const effectiveTitle = title || String((recipeRow as { title?: string }).title ?? "");

  let result;
  try {
    result = await generateDishImage(effectiveTitle, ingredients, { userId });
  } catch (err) {
    // Defensive — the generator is built not to throw, but a fire-and-
    // forget caller must never see a 5xx from here regardless.
    captureRouteError(err, "/api/recipe-import/image-hero", { stage: "generate" });
    return skipped("generate_threw");
  }

  if (!result.ok) {
    // fal locked / errored — the documented out-of-balance state. No-op.
    return skipped(result.error);
  }

  const { error: updateError } = await admin
    .from("recipes")
    .update({
      image_url: result.url,
      image_source: "ai_generated",
      image_model: FAL_IMAGE_MODEL,
      image_generated_at: new Date().toISOString(),
    })
    .eq("id", recipeId)
    .eq("author_id", userId);

  if (updateError) {
    captureRouteError(updateError, "/api/recipe-import/image-hero", { stage: "update" });
    return skipped("update_failed");
  }

  return NextResponse.json({ ok: true, url: result.url }, { status: 200 });
}
