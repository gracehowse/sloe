/**
 * ENG-176 — guards the parser used by both seed and purge scripts. Either
 * script reading the wrong URL set means seed-row leakage past the
 * pre-launch purge.
 */
import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  parseSeedRecipeUrls,
  readSeedRecipeUrls,
  SEED_URL_FILE_RELATIVE,
} from "../../scripts/_lib/seedRecipeUrls";

describe("parseSeedRecipeUrls", () => {
  it("returns an empty array for empty content", () => {
    expect(parseSeedRecipeUrls("")).toEqual([]);
  });

  it("returns an empty array when every line is blank or commented", () => {
    expect(
      parseSeedRecipeUrls(["", "  ", "# header", "  # indented comment", ""].join("\n")),
    ).toEqual([]);
  });

  it("keeps URLs and trims surrounding whitespace", () => {
    const raw = ["  https://example.com/a  ", "https://example.com/b"].join("\n");
    expect(parseSeedRecipeUrls(raw)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("drops full-line `#` comments but keeps URLs that follow", () => {
    const raw = [
      "# --- section ---",
      "https://example.com/a",
      "# trailing section",
      "https://example.com/b",
    ].join("\n");
    expect(parseSeedRecipeUrls(raw)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("preserves order so the delete script's `.in()` filter matches the seed script's inserts", () => {
    const raw = ["https://example.com/c", "https://example.com/a", "https://example.com/b"].join(
      "\n",
    );
    expect(parseSeedRecipeUrls(raw)).toEqual([
      "https://example.com/c",
      "https://example.com/a",
      "https://example.com/b",
    ]);
  });

  it("does not deduplicate — duplicates surface as a maintenance signal in the source file", () => {
    const raw = ["https://example.com/a", "https://example.com/a"].join("\n");
    expect(parseSeedRecipeUrls(raw)).toEqual([
      "https://example.com/a",
      "https://example.com/a",
    ]);
  });
});

describe("readSeedRecipeUrls (real seed-recipe-urls.txt)", () => {
  it("returns the committed canonical seed-URL list", () => {
    const file = join(process.cwd(), SEED_URL_FILE_RELATIVE);
    if (!existsSync(file)) {
      // If a worktree has dropped the file the script no-ops cleanly; this
      // test then has nothing useful to assert.
      return;
    }
    const urls = readSeedRecipeUrls();
    expect(urls.length).toBeGreaterThan(0);
    for (const url of urls) {
      expect(url).toMatch(/^https?:\/\//);
    }
    // Reading the file directly should give the same answer as the helper,
    // catching any drift between the on-disk parser and an ad-hoc one.
    const reparsed = parseSeedRecipeUrls(readFileSync(file, "utf8"));
    expect(urls).toEqual(reparsed);
  });
});
