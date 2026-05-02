import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * TodayQuickLogStrip web/mobile sizing parity (ui-critic finding #1, P0).
 *
 * The mobile component lifted from a 28pt tinted-square + 10pt label
 * to a 56pt tile + 36pt tinted square (`IconBox size="md"` mirror) +
 * 12pt `Type.caption` label. This test pins the equivalent classes on
 * the web component:
 *   - `min-h-14` on every chip (= 56px tile minimum)
 *   - `IconBox size="md"` (= 36px tinted square + 16px lucide glyph)
 *   - `text-xs` label (= 12px, mirrors `Type.caption`)
 *   - No outer `border` class on the chip — the tinted icon container
 *     is the colour-identity carrier
 *
 * If a contributor removes the lift on either side, this test fails
 * and points at the parity contract.
 */

const REPO_ROOT = resolve(__dirname, "../..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("TodayQuickLogStrip — web/mobile sizing parity (ui-critic #1)", () => {
  const WEB = read("src/app/components/suppr/today-quick-log-strip.tsx");

  it("each web chip has min-h-14 (56px tile minimum)", () => {
    const minHeightCount = (WEB.match(/min-h-14/g) ?? []).length;
    expect(minHeightCount).toBeGreaterThanOrEqual(4);
  });

  it("each web chip uses IconBox size=\"md\" (36px tinted square)", () => {
    const mdCount = (WEB.match(/<IconBox\s+size="md"/g) ?? []).length;
    expect(mdCount).toBe(4);
    // Legacy size="sm" must be gone — the audit was about reading as
    // primary, not a footer afterthought.
    expect(WEB).not.toMatch(/<IconBox\s+size="sm"/);
  });

  it("each web chip label uses text-xs (12px) — not the legacy text-[10px]", () => {
    const xsCount = (WEB.match(/text-xs/g) ?? []).length;
    expect(xsCount).toBeGreaterThanOrEqual(4);
    expect(WEB).not.toMatch(/text-\[10px\]/);
  });

  it("the redundant outer `border` class is gone — the IconBox tone carries colour identity", () => {
    expect(WEB).not.toMatch(/className="[^"]*\bborder\s+border-border\b/);
  });
});
