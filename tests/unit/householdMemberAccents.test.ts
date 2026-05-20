/**
 * householdMemberAccents — 2026-04-20 prototype port.
 *
 * Pins the index→colour palette verbatim so a silent web/mobile drift
 * is impossible. The prototype persona data hardcodes four colours for
 * Alex / Sam / Mia / Leo at indices 0..3; we match those and extend
 * with a documented overflow palette for 4..7.
 */
import { describe, expect, it } from "vitest";
import {
  householdMemberAccent,
  householdMemberFirstName,
  householdMemberInitials,
  __test__,
} from "@/lib/household/memberAccents";

describe("householdMemberAccent", () => {
  it("returns the prototype palette for indices 0..3 verbatim", () => {
    expect(householdMemberAccent(0)).toBe("#5e574e");
    expect(householdMemberAccent(1)).toBe("#4cd080");
    expect(householdMemberAccent(2)).toBe("#ffc04c");
    expect(householdMemberAccent(3)).toBe("#ff7eb3");
  });

  it("uses the documented extended palette for indices 4..7", () => {
    expect(householdMemberAccent(4)).toBe(__test__.EXTENDED_PALETTE[0]);
    expect(householdMemberAccent(5)).toBe(__test__.EXTENDED_PALETTE[1]);
    expect(householdMemberAccent(6)).toBe(__test__.EXTENDED_PALETTE[2]);
    expect(householdMemberAccent(7)).toBe(__test__.EXTENDED_PALETTE[3]);
  });

  it("never returns undefined — wraps for >=8 and returns stone for negative / NaN", () => {
    expect(householdMemberAccent(8)).toBe("#5e574e"); // wraps to index 0 of primary
    expect(householdMemberAccent(-1)).toBe("#5e574e");
    expect(householdMemberAccent(Number.NaN)).toBe("#5e574e");
  });
});

describe("householdMemberInitials", () => {
  it("takes the first letter of first + last for multi-word names", () => {
    expect(householdMemberInitials("Sam Taylor")).toBe("ST");
    expect(householdMemberInitials("grace howse")).toBe("GH");
    expect(householdMemberInitials("Mary Jane Watson")).toBe("MW");
  });

  it("takes the first two letters for single-word names", () => {
    expect(householdMemberInitials("Alex")).toBe("AL");
    expect(householdMemberInitials("Mia")).toBe("MI");
  });

  it("returns ? for empty / whitespace / nullish", () => {
    expect(householdMemberInitials("")).toBe("?");
    expect(householdMemberInitials("   ")).toBe("?");
    expect(householdMemberInitials(null)).toBe("?");
    expect(householdMemberInitials(undefined)).toBe("?");
  });
});

describe("householdMemberFirstName", () => {
  it("extracts the first token, trims whitespace", () => {
    expect(householdMemberFirstName("Sam Taylor")).toBe("Sam");
    expect(householdMemberFirstName(" Mia ")).toBe("Mia");
    expect(householdMemberFirstName("Alex")).toBe("Alex");
  });

  it("falls back to Member when empty", () => {
    expect(householdMemberFirstName("")).toBe("Member");
    expect(householdMemberFirstName(null)).toBe("Member");
  });
});
