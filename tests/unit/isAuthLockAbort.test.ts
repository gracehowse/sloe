/**
 * `isAuthLockAbort` is the helper we use to silently skip benign
 * Supabase auth-lock collisions in callsites that race during page
 * focus / refresh cycles (Today, Discover, etc.). Test the matcher
 * shape so we never accidentally swallow a real query failure.
 */

import { describe, it, expect } from "vitest";

import { isAuthLockAbort } from "../../src/lib/supabase/isAuthLockAbort";

describe("isAuthLockAbort", () => {
  it("matches the canonical 'Lock was stolen' message", () => {
    expect(isAuthLockAbort({ message: "Lock was stolen by another request" })).toBe(true);
  });

  it("matches a generic AbortError by name", () => {
    expect(isAuthLockAbort({ name: "AbortError", message: "Aborted" })).toBe(true);
  });

  it("matches re-formatted lock-aborted variants", () => {
    expect(
      isAuthLockAbort({ message: "Auth lock acquisition aborted" }),
    ).toBe(true);
  });

  it("does NOT match unrelated PostgrestError shapes", () => {
    expect(
      isAuthLockAbort({ message: "duplicate key value violates unique constraint", code: "23505" }),
    ).toBe(false);
    expect(isAuthLockAbort({ message: "JWT expired" })).toBe(false);
    expect(isAuthLockAbort({ message: "permission denied for table" })).toBe(false);
  });

  it("does NOT match unrelated 'lock' messages (account lockout etc.)", () => {
    expect(isAuthLockAbort({ message: "Account locked due to failed login attempts" })).toBe(false);
    expect(isAuthLockAbort({ message: "Could not acquire file lock" })).toBe(false);
  });

  it("safely returns false for non-error inputs", () => {
    expect(isAuthLockAbort(null)).toBe(false);
    expect(isAuthLockAbort(undefined)).toBe(false);
    expect(isAuthLockAbort("just a string")).toBe(false);
    expect(isAuthLockAbort(42)).toBe(false);
    expect(isAuthLockAbort({})).toBe(false);
  });
});
