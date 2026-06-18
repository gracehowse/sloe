/**
 * ENG-898 — web /import 3-method source tiles (mobile parity).
 * Pins testIDs + Pro gate on photo tile without rendering the full form.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const UPLOAD = read("src/app/components/RecipeUpload.tsx");

describe("RecipeUpload import method tiles (ENG-898 web parity)", () => {
  it("renders Photo / Paste text / Scan tiles with mobile testIDs", () => {
    expect(UPLOAD).toMatch(/data-testid="import-method-tiles"/);
    expect(UPLOAD).toMatch(/data-testid="import-method-photo"/);
    expect(UPLOAD).toMatch(/data-testid="import-method-paste-text"/);
    expect(UPLOAD).toMatch(/data-testid="import-method-scan"/);
  });

  it("surfaces Pro gate on photo tile before opening the picker", () => {
    expect(UPLOAD).toContain("const onPhotoMethodPress = useCallback");
    expect(UPLOAD).toMatch(/if \(isFreeTier\) \{\s*onUpgrade\?\.\(\)/);
  });

  it("shows an or divider between URL import and method tiles", () => {
    expect(UPLOAD).toMatch(/>\s*or\s*</);
  });
});
