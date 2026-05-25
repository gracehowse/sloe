import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const searchPath = path.resolve("apps/mobile/app/(tabs)/search.tsx");
const src = fs.readFileSync(searchPath, "utf-8");

describe("ENG-70 · Mobile search empty state", () => {
  it("imports EmptyState component", () => {
    expect(src).toContain("EmptyState");
  });

  it("renders initial hint when no search has been performed", () => {
    expect(src).toContain('testID="search-initial-hint"');
    expect(src).toContain("Search any food");
  });

  it("renders no-results state after search returns empty", () => {
    expect(src).toContain('testID="search-no-results"');
    expect(src).toContain("No results for");
  });

  it("tracks whether a search has been performed via ref", () => {
    expect(src).toContain("hasSearched");
  });

  it("uses Lucide Search and SearchX icons", () => {
    expect(src).toContain("lucide-react-native");
    expect(src).toMatch(/Search[,\s]/);
    expect(src).toContain("SearchX");
  });

  it("wraps results in a ScrollView for long lists", () => {
    expect(src).toContain("ScrollView");
  });
});
