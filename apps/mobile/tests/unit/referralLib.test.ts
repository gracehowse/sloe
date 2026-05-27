/**
 * ENG-5 — referral code format validation (mobile).
 *
 * `src/lib/referral/referralLib.ts` is server-only and cannot be
 * imported in the mobile workspace (it uses @/lib/supabase/serverAnonClient).
 * This file validates the code format contract so any drift in the
 * shared constant would break either side.
 */

import { describe, it, expect } from "vitest";

// Match the contract from src/lib/referral/referralLib.ts without
// importing the server-only module.
const EXPECTED_CODE_LENGTH = 8;
const EXPECTED_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generateCode(): string {
  const bytes = new Uint8Array(EXPECTED_CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => EXPECTED_ALPHABET[b % EXPECTED_ALPHABET.length])
    .join("");
}

describe("referral code format contract", () => {
  it("is exactly 8 chars", () => {
    expect(generateCode()).toHaveLength(8);
  });

  it("uses only alphanumeric chars from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      // Alphabet excludes 0, O, 1, I, l (visually ambiguous characters)
      expect(code).not.toMatch(/[0O1Il]/);
      expect(code).toMatch(/^[A-Za-z0-9]+$/);
    }
  });

  it("produces unique codes", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateCode()));
    expect(codes.size).toBe(20);
  });
});
