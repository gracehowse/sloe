/**
 * Shared helpers for the Discover-seed lifecycle.
 *
 * `scripts/seed-recipe-urls.txt` is the canonical list of source URLs that
 * `seed-discover-recipes.ts` imports as Discover seed rows and that
 * `delete-seeded-recipes.ts` removes by `source_url`. Both scripts used to
 * carry their own copy of the parser; extracting it here makes the parser
 * unit-testable and prevents the two copies from drifting (e.g. one starts
 * stripping comments, the other doesn't).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/** Filename, relative to the repo root. */
export const SEED_URL_FILE_RELATIVE = "scripts/seed-recipe-urls.txt";

/**
 * Parse the raw text of `seed-recipe-urls.txt` into a clean URL list.
 *
 * - Trims each line.
 * - Drops blank lines.
 * - Drops `#`-prefixed comment lines (full-line comments only — inline
 *   `# trailing` text on a URL line is preserved as part of the URL,
 *   which is fine because real URLs never contain `#` outside the
 *   fragment, and we never seed by fragment).
 */
export function parseSeedRecipeUrls(fileContent: string): string[] {
  return fileContent
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

/**
 * Read `scripts/seed-recipe-urls.txt` from disk and return the cleaned URL
 * list. Returns `[]` if the file is missing — callers treat that as "no
 * URL-keyed deletion / seeding to do".
 */
export function readSeedRecipeUrls(cwd: string = process.cwd()): string[] {
  const file = join(cwd, SEED_URL_FILE_RELATIVE);
  if (!existsSync(file)) return [];
  return parseSeedRecipeUrls(readFileSync(file, "utf8"));
}
