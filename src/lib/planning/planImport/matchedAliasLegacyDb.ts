/**
 * ENG-1276 — legacy-DB tolerance for the staged `matched_alias_key` column
 * on the plan-import persist paths (`persistImportRecipe.ts` +
 * `commitPlanImport.ts`). Same viral-wedge posture as the ENG-1299
 * `nutrition_micros` tolerance in `persistImportedRecipe.ts`: if the staged
 * migration (20260702130200) has not been applied yet, degrade to "no alias
 * key" and retry the insert without the column rather than fail the import.
 *
 * Shared so the detect + strip rule lives in exactly one place across both
 * plan-import persist pipelines. Pure + sync + dependency-light.
 */

/** True when a Postgres/PostgREST error means the `matched_alias_key` column
 *  is missing (migration 20260702130200 not applied). */
export function isMatchedAliasColumnMissing(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const code = (err as { code?: string }).code;
  const msg = String((err as { message?: string }).message ?? "");
  return (code === "42703" || code === "PGRST204") && msg.includes("matched_alias_key");
}

/** Strip the ENG-1276 alias column from row payloads for the legacy-DB retry. */
export function withoutMatchedAliasColumn<T extends { matched_alias_key?: unknown }>(
  rows: T[],
): Omit<T, "matched_alias_key">[] {
  return rows.map((r) => {
    const { matched_alias_key: _dropped, ...rest } = r;
    return rest;
  });
}
