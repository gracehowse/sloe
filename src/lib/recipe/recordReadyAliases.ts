/**
 * ENG-1276 — record `(alias_key, name_key)` into `ingredient_image_aliases`
 * for every ready tile key that carries a trusted alias. Idempotent
 * (`on conflict (alias_key) do update set name_key = excluded.name_key`), so a
 * re-key or repeat call is a no-op. Best-effort + never throws: the alias is
 * decorative metadata, and the table may not be migrated yet — a failure here
 * must never fail the image response. `readyKeys` are canonical tile keys known
 * to be `ready` (already-ready or freshly generated).
 *
 * SECURITY: the `(name, aliasKey)` pairs originate from the client, and
 * `ingredient_image_aliases` is a shared, public-read, service-role-write cache
 * — so an authed caller could otherwise poison it globally (bind an arbitrary
 * food id to an unrelated ingredient's tile → wrong photo for everyone,
 * last-writer-wins). We therefore CORROBORATE every pair against
 * `recipe_ingredients` server-side: an alias is recorded only if some real row
 * (persisted from a trusted ≥0.85 match, `matched_alias_key`) already
 * establishes that same `matched_alias_key → canonicalImageKey(name)` mapping.
 * A pair the matcher never produced won't corroborate. Fails CLOSED — any
 * corroboration-query error (e.g. a pre-migration DB) records nothing.
 *
 * Extracted from the route (app/api/ingredient-image/route.ts) so it's unit-
 * testable without standing up the whole POST handler, and so the route file
 * exports only Next route fields.
 */
import { canonicalImageKey } from "@/lib/recipe/canonicalImageKey";
import { captureRouteError } from "@/lib/observability/captureRouteError";

/** Minimal structural shape of the Supabase admin client this needs — kept
 *  loose (like `loadRecipeIngredientRows`) so the real service-role client and
 *  a test double both satisfy it without importing server-only types. */
export interface AliasWriteClient {
  from: (table: string) => {
    select: (cols: string) => {
      in: (
        col: string,
        vals: string[],
      ) => Promise<{ data: unknown[] | null; error: unknown }>;
    };
    upsert: (
      rows: Array<{ alias_key: string; name_key: string }>,
      opts: { onConflict: string },
    ) => Promise<{ error: unknown }>;
  };
}

export async function recordReadyAliases(
  adminClient: unknown,
  readyKeys: Iterable<string>,
  aliasKeyByCanonicalKey: ReadonlyMap<string, string>,
): Promise<void> {
  if (aliasKeyByCanonicalKey.size === 0) return;
  const admin = adminClient as AliasWriteClient;
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
    // Corroborate the client-supplied pairs against trusted persisted matches:
    // keep only (alias_key → name_key) mappings that a real recipe_ingredients
    // row already establishes. Fabricated pairs are dropped; fails closed.
    const { data: corroborating, error: corroborateErr } = await admin
      .from("recipe_ingredients")
      .select("name, matched_alias_key")
      .in(
        "matched_alias_key",
        rows.map((r) => r.alias_key),
      );
    if (corroborateErr) {
      captureRouteError(corroborateErr, "/api/ingredient-image", { stage: "alias_corroborate" });
      return;
    }
    const trusted = new Set<string>();
    for (const row of corroborating ?? []) {
      const ak = String((row as { matched_alias_key?: unknown }).matched_alias_key ?? "");
      const nk = canonicalImageKey(String((row as { name?: unknown }).name ?? ""));
      if (ak && nk) trusted.add(`${ak} ${nk}`);
    }
    const verifiedRows = rows.filter((r) => trusted.has(`${r.alias_key} ${r.name_key}`));
    if (verifiedRows.length === 0) return;
    const { error } = await admin
      .from("ingredient_image_aliases")
      .upsert(verifiedRows, { onConflict: "alias_key" });
    if (error) {
      // Table not migrated yet / RLS / transient — decorative, swallow.
      captureRouteError(error, "/api/ingredient-image", { stage: "alias_upsert" });
    }
  } catch (err) {
    captureRouteError(err, "/api/ingredient-image", { stage: "alias_upsert" });
  }
}
