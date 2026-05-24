/**
 * ENG-604 — Discover editorial loading uses skeleton silhouettes.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("ENG-604 discover editorial loading", () => {
  it("mobile discover cold load uses DiscoverLoadingSkeleton, not a large spinner", () => {
    const src = read("apps/mobile/app/(tabs)/discover.tsx");
    expect(src).toContain("DiscoverLoadingSkeleton");
    expect(src).not.toMatch(/ActivityIndicator\s+size=\{?"large"/);
  });

  it("mobile discover section headings use headline treatment for editorial sections", () => {
    const src = read("apps/mobile/app/(tabs)/discover.tsx");
    expect(src).toMatch(/Type\.headline/);
    expect(src).toMatch(/Matches your day/);
  });

  it("web discover mobile-web sections use editorial overline headings", () => {
    const src = read("src/app/components/DiscoverFeed.tsx");
    expect(src).toMatch(/uppercase tracking-\[0\.0[46]em\]/);
    expect(src).toMatch(/Matches your day/);
  });
});
