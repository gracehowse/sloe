/**
 * avatarInitials — ENG-1383.
 *
 * The one shared initials derivation for every avatar chip on both
 * platforms. Pins the exact case that shipped broken (the data-rich
 * persona "Data-Rich Tester (persona)" rendering "D(") plus the edge
 * classes the util is designed around: hyphenated, parenthesised,
 * single-word, emoji-containing, empty.
 */
import { describe, expect, it } from "vitest";
import { avatarInitials } from "@/lib/avatarInitials";

describe("avatarInitials", () => {
  it("takes the first letters of the first two alphabetic words", () => {
    expect(avatarInitials("Sam Taylor")).toBe("ST");
    expect(avatarInitials("grace howse")).toBe("GH");
    expect(avatarInitials("Mary Jane Watson")).toBe("MJ");
  });

  it("treats a hyphen as a word boundary", () => {
    expect(avatarInitials("Data-Rich Tester")).toBe("DR");
    expect(avatarInitials("Jean-Luc Picard")).toBe("JL");
  });

  it("never renders punctuation — parenthesised suffixes contribute letters only", () => {
    // The shipped bug: first + LAST chunk made this "D(".
    expect(avatarInitials("Data-Rich Tester (persona)")).toBe("DR");
    expect(avatarInitials("(persona) Tester")).toBe("PT");
  });

  it("takes the first two letters of a single-word name", () => {
    expect(avatarInitials("Alex")).toBe("AL");
    expect(avatarInitials("Mia")).toBe("MI");
    expect(avatarInitials("A")).toBe("A");
  });

  it("ignores emoji and other non-letter glyphs", () => {
    expect(avatarInitials("🌟 Sam Taylor")).toBe("ST");
    expect(avatarInitials("Sam 🌟 Taylor")).toBe("ST");
    expect(avatarInitials("Sam🌟")).toBe("SA");
    expect(avatarInitials("🌟🎉")).toBe("?");
  });

  it("returns the designed ? fallback for empty / whitespace / nullish", () => {
    expect(avatarInitials("")).toBe("?");
    expect(avatarInitials("   ")).toBe("?");
    expect(avatarInitials(null)).toBe("?");
    expect(avatarInitials(undefined)).toBe("?");
  });
});
