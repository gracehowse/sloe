/**
 * POST /api/ingredient-image — lazy generate-on-miss for ingredient tile
 * images (Sloe image system §4, 2026-06-08
 * `docs/decisions/2026-06-08-recipe-ingredient-image-system.md`).
 *
 * The recipe-detail ingredient grid renders the calm cream placeholder for
 * any ingredient whose `canonicalImageKey` has no `ready` row, AND fires this
 * endpoint with the ingredient names. For each MISSING canonical key this
 * route idempotently generates a Template-B image (Nano Banana Pro, fixed
 * system prompt + seed), caches it to `ingredient_images`, and the library
 * grows itself — every future use of that ingredient reuses the tile.
 *
 * Invariants (the whole point):
 *   - NEVER blocks render. The client fire-and-forgets and re-hydrates the
 *     map on its next load; this route just fills the cache in the background.
 *   - IDEMPOTENT + deduped by key. A key already `ready` is skipped. A key is
 *     claimed `pending` via an atomic `insert … on conflict do nothing`; only
 *     the request that WON the claim generates, so two devices (or two rows
 *     for the same ingredient) never double-spend fal.
 *   - NEVER regenerates an existing key (the backfill re-shoot uses a separate
 *     `--regenerate-ingredients` flag; runtime never overwrites a `ready` row).
 *   - GRACEFUL: fal unconfigured / locked / errored → 200 `{ ok:false,
 *     skipped }`. No 5xx ever; the placeholder is always an acceptable state.
 *
 * Body: `{ names: string[] }` (raw `recipe_ingredients.name` values).
 * Not Pro-gated: ingredient tiles are global + shared (the whole point is the
 * library is reused by everyone), and the image is decorative, not a paid
 * feature — but it IS per-user rate-limited so it can't be abused.
 */

import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/server/rateLimit";
import { getUserIdFromRequest } from "@/lib/supabase/serverAnonClient";
import { getSupabaseAdminClient } from "@/lib/supabase/serverAdminClient";
import { isServerFeatureEnabled } from "@/lib/server/featureFlags";
import { captureRouteError } from "@/lib/observability/captureRouteError";
import { canonicalImageKey } from "@/lib/recipe/canonicalImageKey";
import { cleanIngredientDisplayName } from "@/lib/recipe/cleanIngredientDisplayName";
import {
  selectIngredientImageCandidates,
  type IngredientImageStatus,
} from "@/lib/recipe/ingredientImageQueue";
import { generateIngredientImage, isFalConfigured } from "@/lib/server/falImageGenerator";
import { assertOrigin } from "@/lib/api/assertOrigin";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Cap the number of keys generated per request — bounds latency + fal spend
 *  for a single recipe screen (a long ingredient list still pre-seeds a few
 *  per visit; the rest fill in on the next visit). */
const MAX_KEYS_PER_REQUEST = 6;

type Payload = { names?: unknown; aliases?: unknown };

/** ENG-1276 — one alias pairing the client already knows: the ingredient's
 *  raw name (keyed here the same way tiles are) + its persisted trusted
 *  `matched_alias_key`. Recorded so a differently-spelled future ingredient
 *  that matched the same food reuses this tile. */
type AliasInput = { name: string; aliasKey: string };

/** Parse the optional `aliases` payload into `{ name, aliasKey }` pairs.
 *  Skips anything malformed — an alias is purely additive metadata. */
function parseAliases(raw: unknown): AliasInput[] {
  if (!Array.isArray(raw)) return [];
  const out: AliasInput[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const name = String((item as { name?: unknown }).name ?? "").trim();
    const aliasKey = String((item as { aliasKey?: unknown }).aliasKey ?? "").trim();
    if (name && aliasKey) out.push({ name, aliasKey });
  }
  return out;
}

/** 200 + `skipped` so the fire-and-forget caller treats this as a no-op. */
function skipped(reason: string, extra: Record<string, unknown> = {}) {
  return NextResponse.json({ ok: false, skipped: true, reason, ...extra }, { status: 200 });
}

/**
 * ENG-1276 — record `(alias_key, name_key)` into `ingredient_image_aliases`
 * for every ready tile key that carries a trusted alias. Idempotent
 * (`on conflict (alias_key) do update set name_key = excluded.name_key`), so
 * a re-key or repeat call is a no-op. Best-effort + never throws: the alias
 * is decorative metadata, and the table may not be migrated yet — a failure
 * here must never fail the image response. `readyKeys` are canonical tile
 * keys known to be `ready` (already-ready or freshly generated).
 */
async function recordReadyAliases(
  admin: NonNullable<ReturnType<typeof getSupabaseAdminClient>>,
  readyKeys: Iterable<string>,
  aliasKeyByCanonicalKey: ReadonlyMap<string, string>,
): Promise<void> {
  if (aliasKeyByCanonicalKey.size === 0) return;
  const rows: Array<{ alias_key: string; name_key: string }> = [];
  const seen = new Set<string>();
  for (const nameKey of readyKeys) {
    const aliasKey = aliasKeyByCanonicalKey.get(nameKey);
    if (aliasKey && !seen.has(aliasKey)) {
      seen.add(aliasKey);
      rows.push({ alias_key: aliasKey, name_key: nameKey });
    }
  }
  if (rows.length === 0) return;
  try {
    const { error } = await admin
      .from("ingredient_image_aliases")
      .upsert(rows, { onConflict: "alias_key" });
    if (error) {
      // Table not migrated yet / RLS / transient — decorative, swallow.
      captureRouteError(error, "/api/ingredient-image", { stage: "alias_upsert" });
    }
  } catch (err) {
    captureRouteError(err, "/api/ingredient-image", { stage: "alias_upsert" });
  }
}

export async function POST(req: Request) {
  const originErr = assertOrigin(req);
  if (originErr) return originErr;

  // Shared kill switch with the recipe-import image paths.
  if (await isServerFeatureEnabled("kill_recipe_import")) {
    return skipped("import_killed");
  }

  const userId = await getUserIdFromRequest(req);
  if (!userId) {
    // Decorative cache fill — an unauthenticated caller is just a no-op,
    // not an error worth surfacing.
    return skipped("unauthorized");
  }

  // Per-user rate limit — generation is expensive; cap it.
  const limited = await rateLimit({
    keyPrefix: "api:ingredient-image",
    userId,
    limit: 20,
    windowMs: 60_000,
  });
  if (!limited.ok) {
    return NextResponse.json(
      { ok: false, skipped: true, reason: "rate_limited", retryAfterSec: limited.retryAfterSec },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSec) } },
    );
  }

  if (!isFalConfigured()) {
    return skipped("fal_not_configured");
  }

  let body: Payload;
  try {
    body = (await req.json()) as Payload;
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_body" }, { status: 400 });
  }

  const names = Array.isArray(body.names)
    ? body.names.map((s) => String(s)).filter((s) => s.trim().length > 0)
    : [];
  if (names.length === 0) {
    return NextResponse.json({ ok: false, error: "no_names" }, { status: 400 });
  }

  // Distinct canonical keys, with a representative display name per key (the
  // first raw name that maps to it — cleaned for the generation prompt).
  const keyToDisplay = new Map<string, string>();
  for (const raw of names) {
    const key = canonicalImageKey(raw);
    if (key && !keyToDisplay.has(key)) {
      keyToDisplay.set(key, cleanIngredientDisplayName(raw) || raw);
    }
  }
  if (keyToDisplay.size === 0) {
    return NextResponse.json({ ok: false, error: "no_keys" }, { status: 400 });
  }

  // ENG-1276 — canonical tile key → trusted matched-food alias key. Keyed the
  // same way tiles are (`canonicalImageKey`) so we know which tile each alias
  // points at once it's ready. Only the first alias seen per canonical key is
  // kept (they should agree — a trusted match resolves to one food identity).
  const aliasKeyByCanonicalKey = new Map<string, string>();
  for (const { name, aliasKey } of parseAliases(body.aliases)) {
    const key = canonicalImageKey(name);
    if (key && !aliasKeyByCanonicalKey.has(key)) {
      aliasKeyByCanonicalKey.set(key, aliasKey);
    }
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return skipped("storage_not_configured");
  }

  const allKeys = Array.from(keyToDisplay.keys());

  // Which keys already have a row (ready/pending/failed)? Skip ready +
  // pending (someone is on it / it's done). Failed rows are eligible to retry.
  const { data: existing, error: existingErr } = await admin
    .from("ingredient_images")
    .select("name_key, status")
    .in("name_key", allKeys);
  if (existingErr) {
    captureRouteError(existingErr, "/api/ingredient-image", { stage: "existing" });
    return skipped("lookup_failed");
  }
  const statusByKey = new Map<string, IngredientImageStatus | string>();
  for (const row of existing ?? []) {
    const k = String((row as { name_key?: string }).name_key ?? "");
    const s = String((row as { status?: string }).status ?? "");
    if (k) statusByKey.set(k, s);
  }

  // Pure, unit-tested decision: which keys to claim + generate (no row or a
  // `failed` row to retry; never `ready`/`pending`), capped per request.
  const { candidates, alreadyReady } = selectIngredientImageCandidates(
    allKeys,
    statusByKey,
    MAX_KEYS_PER_REQUEST,
  );
  if (candidates.length === 0) {
    // ENG-1276 — even when nothing needs generating, record aliases for the
    // already-ready tiles so a trusted match's identity is captured on the
    // first visit that carries it.
    await recordReadyAliases(admin, alreadyReady, aliasKeyByCanonicalKey);
    return NextResponse.json(
      { ok: true, generated: [], alreadyReady, claimed: 0 },
      { status: 200 },
    );
  }

  const generated: string[] = [];
  const failed: string[] = [];

  for (const key of candidates) {
    const display = keyToDisplay.get(key) ?? key;
    const hadFailedRow = statusByKey.get(key) === "failed";

    // ── Atomic claim. For a brand-new key, insert with `ignoreDuplicates`
    //    and `.select()` — only the request that actually inserted the row
    //    gets it back, so a concurrent request that lost the race generates
    //    nothing. For an existing `failed` row, flip it to `pending` (the
    //    retry path; low contention). ──
    if (hadFailedRow) {
      await admin
        .from("ingredient_images")
        .update({ status: "pending", display_name: display })
        .eq("name_key", key)
        .eq("status", "failed");
    } else {
      const { data: claimedRows, error: claimErr } = await admin
        .from("ingredient_images")
        .upsert(
          { name_key: key, display_name: display, status: "pending" },
          { onConflict: "name_key", ignoreDuplicates: true },
        )
        .select("name_key");
      if (claimErr) {
        captureRouteError(claimErr, "/api/ingredient-image", { stage: "claim", key });
        continue;
      }
      // Lost the race (row already existed) → another request owns it. Skip.
      if (!Array.isArray(claimedRows) || claimedRows.length === 0) {
        continue;
      }
    }

    let result;
    try {
      result = await generateIngredientImage(display);
    } catch (err) {
      captureRouteError(err, "/api/ingredient-image", { stage: "generate", key });
      await admin.from("ingredient_images").update({ status: "failed" }).eq("name_key", key);
      failed.push(key);
      continue;
    }

    if (!result.ok) {
      await admin.from("ingredient_images").update({ status: "failed" }).eq("name_key", key);
      failed.push(key);
      // fal locked / errored — stop early; the rest stay claim-free for a
      // later visit (don't burn the rate-limit budget on a dead engine).
      if (result.error === "fal_http_error" || result.error === "fal_not_configured") {
        break;
      }
      continue;
    }

    const { error: upErr } = await admin
      .from("ingredient_images")
      .update({ image_url: result.url, status: "ready" })
      .eq("name_key", key);
    if (upErr) {
      captureRouteError(upErr, "/api/ingredient-image", { stage: "update", key });
      failed.push(key);
      continue;
    }
    generated.push(key);
  }

  // ENG-1276 — record aliases for every tile now ready (already-ready +
  // freshly generated) so the alias library grows itself alongside the image
  // library. Best-effort; never affects the response.
  await recordReadyAliases(
    admin,
    [...alreadyReady, ...generated],
    aliasKeyByCanonicalKey,
  );

  return NextResponse.json(
    { ok: true, generated, failed, alreadyReady, claimed: candidates.length },
    { status: 200 },
  );
}
