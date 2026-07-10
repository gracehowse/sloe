/**
 * Mobile FoodFallbackThumb — tiered honest-imagery contract
 * (ENG-1448 PR 1; web parity: tests/unit/foodFallbackThumbWeb.test.tsx).
 *
 * Two layers:
 *  1. Behaviour of the SHARED resolver through the mobile alias
 *     (`@suppr/shared/imagery/foodFallbackCategory`) — confident hits
 *     only, slot tier, generic tier, never a fabricated category.
 *  2. Source pins on the RN component + rows: the opaque tint underlay
 *     (never-white), the tier gate on sample images (never-fabricated),
 *     and the fnv1a32 / HASH_FALLBACK_POOL ban.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  resolveFoodFallback,
  resolveFoodFallbackSampleCategory,
} from "@suppr/shared/imagery/foodFallbackCategory";

const THUMB = readFileSync(
  resolve(__dirname, "../../components/imagery/FoodFallbackThumb.tsx"),
  "utf8",
);
const ROWS = readFileSync(
  resolve(__dirname, "../../components/today/LogSheetRows.tsx"),
  "utf8",
);

describe("shared tiered resolver via the mobile alias (ENG-1448)", () => {
  it("confident keyword hits resolve the category tier", () => {
    expect(resolveFoodFallback("Tonkotsu ramen bowl")).toMatchObject({
      tier: "category",
      category: "ramen-noodles",
      photoConfident: true,
    });
  });

  it("photo-confidence split: ambiguous keywords keep the category but never license the sample photo", () => {
    // "Zucchini noodles" must render a noodle GLYPH, never the shipped
    // tonkotsu ramen PHOTO — same for shakes/yogurt/bare salads.
    for (const [title, category] of [
      ["Zucchini noodles", "ramen-noodles"],
      ["Protein shake", "smoothie"],
      ["Greek yogurt bowl", "breakfast-bowl"],
      ["Greek salad", "salad"],
    ] as const) {
      expect(resolveFoodFallback(title), title).toMatchObject({
        tier: "category",
        category,
        photoConfident: false,
      });
    }
  });

  it("ambiguous titles resolve slot (when passed) or generic — never a wrong category", () => {
    expect(resolveFoodFallback("Grace's leftovers").tier).toBe("generic");
    expect(resolveFoodFallback("Grace's leftovers", { slot: "Lunch" })).toMatchObject({
      tier: "slot",
      slot: "Lunch",
      glyph: "Sun",
    });
  });

  it("ENG-1478 guard holds: unshipped categories map to null samples", () => {
    expect(resolveFoodFallback("PERSONA: Salmon, potatoes & greens")).toMatchObject({
      tier: "category",
      category: "fish",
    });
    expect(resolveFoodFallbackSampleCategory("fish")).toBeNull();
  });
});

describe("FoodFallbackThumb (mobile) — source pins", () => {
  it("gates sample images on the photo-confident category tier (never-fabricated)", () => {
    expect(THUMB).toMatch(/resolution\.tier === "category" && resolution\.photoConfident/);
    expect(THUMB).toMatch(/resolveFoodFallbackSampleCategory\(resolution\.category\)/);
  });

  it("paints the opaque tint underlay on the wrapper AFTER caller style (never-white)", () => {
    const underlay = THUMB.indexOf("{ backgroundColor: resolution.tint }");
    const callerStyle = THUMB.indexOf("        style,");
    expect(underlay).toBeGreaterThan(-1);
    expect(callerStyle).toBeGreaterThan(-1);
    expect(underlay).toBeGreaterThan(callerStyle);
  });

  it("keeps the hash fabrication path dead", () => {
    expect(THUMB).not.toMatch(/fnv1a32|HASH_FALLBACK_POOL/);
    expect(ROWS).not.toMatch(/fnv1a32|HASH_FALLBACK_POOL/);
  });

  it("rows pass the active slot into the thumb (slot tier wiring)", () => {
    expect(ROWS).toMatch(/slot=\{slotName\}/);
    // Rows must not paint the wrapper back to a surface colour.
    expect(ROWS).not.toMatch(/FoodFallbackThumb[\s\S]{0,200}backgroundColor:/);
  });
});
