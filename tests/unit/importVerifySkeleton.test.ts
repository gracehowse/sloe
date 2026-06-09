/**
 * ENG-606 — import / verify loading must use skeleton silhouettes,
 * not a bare centred large spinner on the import critical path.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("ENG-606 import verify skeleton", () => {
  it("mobile import-shared does not show a large centred import spinner", () => {
    const src = read("apps/mobile/app/import-shared.tsx");
    expect(src).not.toMatch(/ActivityIndicator\s+size=\{?"large"/);
    expect(src).toContain("ImportLoadingSkeleton");
  });

  it("mobile verify screen keeps VerifyLoadingSkeleton", () => {
    const src = read("apps/mobile/app/recipe/verify.tsx");
    expect(src).toContain("VerifyLoadingSkeleton");
    expect(src).not.toMatch(/if\s*\(\s*loading\s*\)\s*\{[^}]*ActivityIndicator\s+size=\{?"large"/s);
  });

  it("web RecipeUpload uses ImportLoadingSkeleton during URL import", () => {
    const src = read("src/app/components/RecipeUpload.tsx");
    expect(src).toContain("ImportLoadingSkeleton");
    // importBusy guard may include a feature-flag condition (e.g. !importProgressV2)
    // before the ternary — assert the skeleton is conditionally rendered on importBusy.
    expect(src).toMatch(/importBusy[^?]*\?\s*[\n\r\s]*\(?\s*<ImportLoadingSkeleton/);
  });
});
