/**
 * ENG-1045 — middleware skips getUser on public routes; API routes excluded
 * from the matcher.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(join(__dirname, "../../middleware.ts"), "utf8");

describe("middleware public fast-path (ENG-1045)", () => {
  it("checks isPublic before creating the Supabase client / getUser", () => {
    const publicCheck = SRC.indexOf("if (isPublic(pathname))");
    const getUser = SRC.indexOf("supabase.auth.getUser()");
    expect(publicCheck).toBeGreaterThan(-1);
    expect(getUser).toBeGreaterThan(publicCheck);
  });

  it("matcher excludes /api/*", () => {
    expect(SRC).toMatch(/\(\?!api\/\|/);
  });
});
