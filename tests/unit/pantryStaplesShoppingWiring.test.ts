/**
 * ENG-1051 — per-row pantry staple affordance on shopping lists (web + mobile).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(process.cwd());

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("ENG-1051 — shopping list pantry staple wiring", () => {
  const web = read("src/app/components/ShoppingList.tsx");
  const mobile = read("apps/mobile/app/shopping.tsx");

  it("web shopping rows expose mark-as-staple using shared pantry helpers", () => {
    expect(web).toContain("appendPantryStaple");
    expect(web).toContain("savePantryStaples");
    expect(web).toContain("markGroupAsStaple");
    expect(web).toContain('data-testid={`shopping-row-staple-${group.key}`}');
  });

  it("mobile shopping rows expose swipe + long-press staple actions", () => {
    expect(mobile).toContain("appendPantryStaple");
    expect(mobile).toContain("markGroupAsStaple");
    expect(mobile).toContain('testID={`shopping-swipe-staple-${group.key}`}');
    expect(mobile).toContain("Always on hand");
  });
});
