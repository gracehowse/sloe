/**
 * libraryEntryKind — pure predicate that classifies a Library row as
 * "saved" / "created" / "imported".
 *
 * Shared between mobile (`apps/mobile/app/(tabs)/library.tsx`) and
 * web (`src/app/components/Library.tsx`) so the two platforms can't
 * silently disagree on what bucket a recipe lives in.
 *
 * GW-01 fix (audit 2026-04-28, `data-integrity` agent diagnosis):
 * the `Saved` predicate must win over `authorId === userId`. Pre-fix
 * a recipe that was authored by the user AND in the saves set was
 * mis-classified as "imported" / "created" because the author check
 * fired first. The original seed of this bug was
 * `scripts/seed-discover-recipes.ts` writing the user's UUID as
 * `author_id` on platform-curated rows; once the user bookmarked
 * those, every save fell into the imported/created buckets and the
 * Saved tab read empty.
 *
 * Even after the seeder fix lands, the predicate ordering matters
 * for the legitimate case: a user who imported a recipe via the
 * share extension AND bookmarked it should see it under Saved while
 * the bookmark is active. The bookmark IS the user's intent — that
 * intent ranks above authorship.
 */

export type LibraryEntryKindShape = "saved" | "created" | "imported";

export interface LibraryEntryKindInput {
  /** Whether the recipe is currently in the user's saves table. */
  isSaved: boolean;
  /** The recipe's author_id (or null when platform-curated). */
  authorId: string | null | undefined;
  /** The recipe's source_url (set on imports, null on created). */
  sourceUrl: string | null | undefined;
}

/**
 * Classify a Library card. Ordering, top to bottom:
 *
 *   1. `isSaved` is true → "saved" (the bookmark is explicit user
 *      intent; ranks above authorship).
 *   2. `authorId === userId` → either "imported" (when sourceUrl
 *      is set) or "created" (when not).
 *   3. Fallback → "saved" (foreign-author rows the user can only
 *      ever have arrived at via a save).
 */
export function classifyLibraryEntry(
  input: LibraryEntryKindInput,
  userId: string | null,
): LibraryEntryKindShape {
  if (input.isSaved) return "saved";
  if (
    userId &&
    input.authorId &&
    input.authorId === userId
  ) {
    return input.sourceUrl ? "imported" : "created";
  }
  return "saved";
}
