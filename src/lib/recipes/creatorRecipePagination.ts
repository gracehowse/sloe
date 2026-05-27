/**
 * ENG-748 #14 (2026-05-27) — Creator profile recipe pagination helpers.
 *
 * Shared by the web list component
 * (`src/app/components/creator/CreatorRecipeList.tsx`) and the mobile
 * screen (`apps/mobile/app/creator/[id].tsx`) so the offset math, the
 * de-dupe rule, and the "is there more?" rule are identical on both
 * platforms — there's exactly one source of truth for "what does Load
 * more do?".
 *
 * The creator recipe list is fetched newest-first in fixed-size pages.
 * Because new recipes can be published between page fetches (and would
 * shift the newest-first window), the merge step de-dupes by id so a row
 * can never render twice.
 */

/** Recipes are fetched in pages of this size. Keep web + mobile in
 *  lockstep by importing this constant rather than re-declaring it. */
export const CREATOR_RECIPES_PAGE_SIZE = 24;

/** Minimal row shape the pagination helpers need (id is the dedupe key). */
export interface CreatorRecipeIdentifiable {
  id: string;
}

/**
 * The `[from, to]` inclusive range for the NEXT page, given how many rows
 * are already loaded. Matches PostgREST's `.range(from, to)` semantics
 * (both bounds inclusive), so a page of `pageSize` rows spans
 * `[loadedCount, loadedCount + pageSize - 1]`.
 */
export function nextPageRange(
  loadedCount: number,
  pageSize: number = CREATOR_RECIPES_PAGE_SIZE,
): [from: number, to: number] {
  const from = Math.max(0, Math.floor(loadedCount));
  return [from, from + pageSize - 1];
}

/**
 * True when the page just returned was full — i.e. there may be more to
 * load. A short page (fewer than `pageSize` rows) means the
 * back-catalogue is exhausted.
 */
export function pageHasMore(
  pageLength: number,
  pageSize: number = CREATOR_RECIPES_PAGE_SIZE,
): boolean {
  return pageLength >= pageSize;
}

/**
 * Append `page` onto `existing`, dropping any row whose id is already
 * present. Order is preserved (existing first, then new-unique rows in
 * arrival order). Returns a new array — never mutates the input.
 */
export function mergeRecipePage<T extends CreatorRecipeIdentifiable>(
  existing: T[],
  page: T[],
): T[] {
  const seen = new Set(existing.map((r) => r.id));
  const merged = existing.slice();
  for (const row of page) {
    if (!seen.has(row.id)) {
      seen.add(row.id);
      merged.push(row);
    }
  }
  return merged;
}
