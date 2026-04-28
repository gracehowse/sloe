/**
 * libraryEntryKind — pin the cross-platform Library predicate.
 *
 * GW-01 fix (audit 2026-04-28). Pre-fix, a saved recipe whose
 * `author_id` matched the reader's UUID was mis-classified as
 * "imported" or "created" — the seed-discover-recipes script wrote
 * Grace's UUID as the author of every URL-seeded row, so every
 * bookmark fell into the wrong bucket and the Saved tab read empty.
 *
 * The fix moved the predicate to a shared module so web + mobile
 * use the same rule, and re-ordered it so `isSaved` wins over
 * authorship.
 */
import { describe, it, expect } from "vitest";
import {
  classifyLibraryEntry,
  type LibraryEntryKindInput,
} from "../../src/lib/recipes/libraryEntryKind";

const USER = "user-1";
const OTHER = "user-2";

const card = (
  overrides: Partial<LibraryEntryKindInput> = {},
): LibraryEntryKindInput => ({
  isSaved: false,
  authorId: OTHER,
  sourceUrl: null,
  ...overrides,
});

describe("classifyLibraryEntry — Saves win over authorship (GW-01)", () => {
  it("classifies a saved recipe as 'saved' even when authorId === userId", () => {
    // Regression for the seed-poisoned case. Pre-fix, this returned
    // "imported" because the predicate checked author_id first.
    expect(
      classifyLibraryEntry(
        card({ authorId: USER, sourceUrl: "https://example.com", isSaved: true }),
        USER,
      ),
    ).toBe("saved");
  });

  it("classifies a saved recipe as 'saved' regardless of source_url", () => {
    expect(
      classifyLibraryEntry(
        card({ authorId: USER, sourceUrl: null, isSaved: true }),
        USER,
      ),
    ).toBe("saved");
  });

  it("classifies a saved foreign-author recipe as 'saved'", () => {
    expect(
      classifyLibraryEntry(
        card({ authorId: OTHER, sourceUrl: "https://example.com", isSaved: true }),
        USER,
      ),
    ).toBe("saved");
  });
});

describe("classifyLibraryEntry — author-owned (unsaved)", () => {
  it("classifies an unsaved authored row with source_url as 'imported'", () => {
    expect(
      classifyLibraryEntry(
        card({ authorId: USER, sourceUrl: "https://example.com", isSaved: false }),
        USER,
      ),
    ).toBe("imported");
  });

  it("classifies an unsaved authored row without source_url as 'created'", () => {
    expect(
      classifyLibraryEntry(
        card({ authorId: USER, sourceUrl: null, isSaved: false }),
        USER,
      ),
    ).toBe("created");
  });
});

describe("classifyLibraryEntry — foreign authorship", () => {
  it("classifies an unsaved foreign-author recipe as 'saved' (defensive default)", () => {
    // Foreign-author rows can only ever have arrived in Library via
    // a save; the unsaved branch is a defensive default for legacy
    // data shapes.
    expect(
      classifyLibraryEntry(
        card({ authorId: OTHER, sourceUrl: "https://example.com", isSaved: false }),
        USER,
      ),
    ).toBe("saved");
  });

  it("classifies a row with NULL author (platform-curated) as 'saved'", () => {
    // GW-03/GW-04 fix path: post-2026-04-28 the seeder writes
    // author_id = NULL. A signed-out viewer or a mismatched user
    // should treat the row as "saved" — it's a Discover row they
    // bookmarked.
    expect(
      classifyLibraryEntry(
        card({ authorId: null, sourceUrl: "https://example.com", isSaved: true }),
        USER,
      ),
    ).toBe("saved");
  });

  it("classifies a row when userId is null as 'saved' fallback", () => {
    expect(
      classifyLibraryEntry(card({ authorId: USER, sourceUrl: null, isSaved: false }), null),
    ).toBe("saved");
  });
});
