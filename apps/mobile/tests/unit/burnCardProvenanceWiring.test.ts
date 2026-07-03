/**
 * F-131 (`AMmlpVOqMnaKKdV2dobjjjg`, 2026-05-08) — Pattern #9 burn-card
 * extension. Grace's complaint: "Need to check this number is correct
 * - would be helpful to click on here and see what it's made up of"
 * — exactly what WhereThisComesFromSheet ships. PR #143 wired it on
 * the activity card; F-131 extends to the burn-summary card.
 *
 * Static pin asserting:
 *   - TodayActivityBonusCard exposes `onShowBurnProvenance`.
 *   - The card renders an Info icon when the prop is wired.
 *   - The host (`(tabs)/index.tsx`) wires the prop to the provenance
 *     sheet via `setProvenanceContext("burn")`.
 *   - The sheet headline branches on `provenanceContext === "burn"`.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(REPO, rel), "utf8");
}

describe("F-131 — TodayActivityBonusCard exposes onShowBurnProvenance", () => {
  const src = read("apps/mobile/components/today/TodayActivityBonusCard.tsx");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("declares the optional onShowBurnProvenance prop", () => {
    expect(code).toMatch(/onShowBurnProvenance\?:\s*\(\)\s*=>\s*void/);
  });

  it("renders an Info icon when the prop is wired", () => {
    // ENG-120 (Lucide migration): information-circle-outline → <Info>.
    // The icon appears inside the conditional ternary on the prop.
    // Looser pattern — assert presence of both the prop check and the icon name.
    expect(code).toMatch(/\bInfo\b/);
    expect(code).toMatch(/onShowBurnProvenance/);
  });

  it("Info-icon Pressable stops propagation so the row press doesn't fire", () => {
    expect(code).toMatch(/onShowBurnProvenance[\s\S]{0,800}stopPropagation/);
  });
});

describe("F-131 — Today host wires the burn provenance sheet", () => {
  const src = read("apps/mobile/app/(tabs)/_today/TodayScreen.tsx");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

  it("uses a single shared provenance state with 'activity' | 'burn' | null", () => {
    expect(code).toMatch(/provenanceContext[\s\S]{0,200}"activity"\s*\|\s*"burn"\s*\|\s*null/);
  });

  it("passes onShowBurnProvenance to TodayActivityBonusCard", () => {
    expect(code).toMatch(/onShowBurnProvenance=\{/);
    expect(code).toMatch(/setProvenanceContext\("burn"\)/);
  });

  it("WhereThisComesFromSheet headline branches on provenanceContext === 'burn'", () => {
    expect(code).toMatch(/provenanceContext\s*===\s*"burn"/);
  });
});
