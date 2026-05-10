/**
 * F-144 (2026-05-10): persistence-error mapper unit tests.
 *
 * Pins the contract that the recipe-cascade FK violation (PG 23503)
 * surfaces as actionable copy, not the raw constraint error testers
 * reported in the 2026-05-10 ASC pull.
 */

import { describe, it, expect } from "vitest";
import {
  mapPersistenceError,
  isRecipeForeignKeyViolation,
} from "@/lib/nutrition/persistenceErrors";

describe("mapPersistenceError", () => {
  it("translates 23503 (FK violation) into actionable copy for recipe-attached writes", () => {
    const pgErr = {
      code: "23503",
      message:
        'insert or update on table "user_recipe_notes" violates foreign key constraint "user_recipe_notes_recipe_id_fkey"',
      details: "Key (recipe_id)=(00000000-0000-0000-0000-000000000000) is not present in table \"recipes\".",
    };
    const out = mapPersistenceError(pgErr);
    expect(out.message).toContain("recipe is no longer in your library");
    expect((out as Error & { code?: string }).code).toBe("23503");
    expect((out as Error & { cause?: unknown }).cause).toBe(pgErr);
  });

  it("translates 23503 differently for non-recipe contexts", () => {
    const pgErr = { code: "23503", message: "something" };
    const out = mapPersistenceError(pgErr, "user_attached");
    expect(out.message).toContain("linked to something that no longer exists");
  });

  it("translates 22P02 (uuid parse) into a 'save first' hint", () => {
    const pgErr = {
      code: "22P02",
      message: 'invalid input syntax for type uuid: "not-a-uuid"',
    };
    const out = mapPersistenceError(pgErr);
    expect(out.message).toContain("Save this recipe to your library first");
  });

  it("translates 42501 (RLS deny) into a sign-in hint", () => {
    const pgErr = { code: "42501", message: "permission denied" };
    const out = mapPersistenceError(pgErr);
    expect(out.message).toContain("not signed in");
  });

  it("preserves the original message for unknown PG codes (no swallowing)", () => {
    const pgErr = { code: "23505", message: "duplicate key value" };
    const out = mapPersistenceError(pgErr);
    expect(out.message).toBe("duplicate key value");
    expect((out as Error & { code?: string }).code).toBe("23505");
  });

  it("handles non-Error inputs safely", () => {
    expect(mapPersistenceError(null).message).toBe("Persistence failed");
    expect(mapPersistenceError(undefined).message).toBe("Persistence failed");
    expect(mapPersistenceError("just a string").message).toBe("just a string");
  });

  it("passes through a plain Error untouched", () => {
    const e = new Error("not a pg error");
    expect(mapPersistenceError(e)).toBe(e);
  });
});

describe("isRecipeForeignKeyViolation", () => {
  it("returns true for 23503", () => {
    expect(isRecipeForeignKeyViolation({ code: "23503", message: "x" })).toBe(true);
  });

  it("returns false for other codes", () => {
    expect(isRecipeForeignKeyViolation({ code: "23505", message: "x" })).toBe(false);
    expect(isRecipeForeignKeyViolation(new Error("x"))).toBe(false);
    expect(isRecipeForeignKeyViolation(null)).toBe(false);
  });
});
