/**
 * ENG-5 — referralLib pure logic tests.
 *
 * We can't easily unit-test the database-calling functions without a
 * real Supabase instance, so this file focuses on the pure helpers:
 * generateCode() and the type/constant exports.
 */

import { describe, it, expect } from "vitest";
import {
  generateCode,
  REFERRAL_CODE_LENGTH,
  REFERRAL_DAYS_NEW,
  REFERRAL_DAYS_ALREADY_PAID,
  REFERRAL_MAX_REWARD_DAYS,
} from "@/lib/referral/referralLib";

describe("generateCode", () => {
  it("returns a string of the configured length", () => {
    const code = generateCode();
    expect(typeof code).toBe("string");
    expect(code.length).toBe(REFERRAL_CODE_LENGTH);
  });

  it("only uses the unambiguous alphabet (no 0, O, 1, I, l)", () => {
    // Run 1000 times to increase confidence the forbidden chars never appear.
    for (let i = 0; i < 1000; i++) {
      const code = generateCode();
      expect(code).not.toMatch(/[0O1Il]/);
    }
  });

  it("produces different codes on successive calls", () => {
    const codes = new Set(Array.from({ length: 20 }, () => generateCode()));
    // Even with birthday-paradox odds, 20 codes from 55^8 ≈ 1.7T possibilities
    // colliding is astronomically unlikely.
    expect(codes.size).toBe(20);
  });
});

describe("constants", () => {
  it("REFERRAL_CODE_LENGTH is 8", () => {
    expect(REFERRAL_CODE_LENGTH).toBe(8);
  });

  it("REFERRAL_DAYS_NEW is 30", () => {
    expect(REFERRAL_DAYS_NEW).toBe(30);
  });

  it("REFERRAL_DAYS_ALREADY_PAID is greater than REFERRAL_DAYS_NEW", () => {
    expect(REFERRAL_DAYS_ALREADY_PAID).toBeGreaterThan(REFERRAL_DAYS_NEW);
  });

  it("REFERRAL_MAX_REWARD_DAYS is at least 12 months (365)", () => {
    expect(REFERRAL_MAX_REWARD_DAYS).toBeGreaterThanOrEqual(365);
  });
});
