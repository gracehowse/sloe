import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const LIBRARY_SRC = readFileSync(
  resolve(__dirname, "../../app/(tabs)/library.tsx"),
  "utf8",
);
const SKELETON_SRC = readFileSync(
  resolve(__dirname, "../../components/library/LibraryLoadingSkeleton.tsx"),
  "utf8",
);

describe("Library L2 loading — Figma 324:2 (ENG-896)", () => {
  it("uses LibraryLoadingSkeleton instead of a centred ActivityIndicator on cold load", () => {
    expect(LIBRARY_SRC).toContain("LibraryLoadingSkeleton");
    expect(LIBRARY_SRC).toContain('testID="library-loading-skeleton"');
    expect(LIBRARY_SRC).not.toMatch(
      /isLoading && savedRecipes\.length === 0[\s\S]{0,200}ActivityIndicator/,
    );
  });

  it("renders a 2-column grid silhouette matching the library card grid", () => {
    expect(SKELETON_SRC).toContain("library-loading-skeleton");
    expect(SKELETON_SRC).toMatch(/flexDirection: "row"/);
    expect(SKELETON_SRC).toMatch(/SkeletonCard/);
    expect(SKELETON_SRC).toMatch(/CARD_RADIUS/);
  });
});
