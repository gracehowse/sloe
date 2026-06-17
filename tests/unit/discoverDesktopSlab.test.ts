/**
 * ENG-896 — Discover desktop seamless slab cards (web parity).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(resolve(__dirname, "../../src/app/components/DiscoverFeed.tsx"), "utf8");

describe("Discover desktop grid — seamless slab cards (ENG-896)", () => {
  it("uses SupprCard slabs in discover-desktop-grid (not photo-overlay buttons)", () => {
    expect(SRC).toMatch(/data-testid="discover-desktop-grid"/);
    expect(SRC).toMatch(/discover-recipe-slab-\$\{recipe\.id\}/);
    expect(SRC).toMatch(/elevation="card"/);
    expect(SRC).toMatch(/font-\[family-name:var\(--font-headline\)\]/);
  });
});
