/**
 * `slotLineItemLabels` — the per-line overline + title for a slot-aggregate
 * row on the meal-nutrition screen.
 *
 * Regression guard (Grace 2026-06-04): a logged item with NO recorded time
 * used to render the word "Logged" TWICE — the uppercase overline fell back to
 * `"LOGGED"` AND the title fell back to `"Logged item"`, so a timeless row read
 * "LOGGED / Logged item". The Sloe meal row carries exactly ONE quiet logged
 * affordance. These tests pin that the word "Logged" appears at most once
 * across the two labels for any input, and that real data flows through
 * untouched.
 */
import { describe, expect, it } from "vitest";

import { slotLineItemLabels } from "../../lib/mealNutritionLabels";

function loggedCount({ overline, title }: { overline: string; title: string }) {
  const hay = `${overline} ${title}`.toLowerCase();
  return (hay.match(/logged/g) ?? []).length;
}

describe("slotLineItemLabels — single Logged affordance", () => {
  it("a timeless item shows 'Logged' exactly once (the overline), never twice", () => {
    const labels = slotLineItemLabels(undefined, undefined);
    expect(loggedCount(labels)).toBe(1);
    expect(labels.overline).toBe("LOGGED");
    // The title must NOT be the old "Logged item" duplicate.
    expect(labels.title).toBe("Item");
    expect(labels.title.toLowerCase()).not.toContain("logged");
  });

  it("a timeless item with no title still avoids a double 'Logged' (empty string title)", () => {
    const labels = slotLineItemLabels("", "   ");
    expect(loggedCount(labels)).toBe(1);
    expect(labels.title).toBe("Item");
  });

  it("uses the recorded time as the overline (uppercased) when present", () => {
    const labels = slotLineItemLabels("8:30 AM", "Blueberry Baked Oats");
    expect(labels.overline).toBe("8:30 AM");
    expect(labels.title).toBe("Blueberry Baked Oats");
    // No fabricated "Logged" anywhere when both fields are real.
    expect(loggedCount(labels)).toBe(0);
  });

  it("trims whitespace on the title and keeps the real name", () => {
    const labels = slotLineItemLabels("  ", "  Chicken & Avocado Salad  ");
    expect(labels.title).toBe("Chicken & Avocado Salad");
    // Time was blank → single "Logged" overline, still not doubled.
    expect(labels.overline).toBe("LOGGED");
    expect(loggedCount(labels)).toBe(1);
  });
});
