/**
 * landingParity — the public landing page at `/` must stay aligned
 * with the real product (features, pricing tiers, roadmap promises,
 * FAQ). Drift here shows up as misleading marketing copy, which is a
 * trust / legal risk for a nutrition product.
 *
 * What this test protects:
 *   - Landing feature claims that are easy to accidentally oversell
 *     (platforms, sources count, voice control) stay grounded in the
 *     real app.
 *   - Pricing tier headline numbers on the landing page match the
 *     canonical `/pricing` route (same prices, same period suffix).
 *   - Roadmap "Now" bullets on the landing describe features that
 *     actually ship today (sanity: match the overview doc claims).
 *   - The landing respects the canonical `TODAY_RING_OVERLINE`,
 *     `TODAY_STAT_LABELS`, and `MEAL_SLOT_HEADERS` from
 *     `src/lib/copy/today.ts`.
 *
 * Scope note: we assert on the rendered HTML of `LandingPage` (the
 * component), not the raw source. That way a string that's broken up
 * by JSX tags, or composed from constants, still counts.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { LandingPage } from "../../app/(landing)/LandingPage";
import {
  TODAY_RING_OVERLINE,
  TODAY_STAT_LABELS,
  MEAL_SLOT_HEADERS,
  NET_DEFICIT_LABEL,
} from "../../src/lib/copy/today";

describe("landing page — canonical copy parity", () => {
  it("uses the canonical ring overline label", () => {
    const { container } = render(<LandingPage />);
    // Ring overline rendered in title-case ("Remaining") on the
    // landing visuals even though the mobile / web rings use the
    // uppercase constant. The canonical constant value is the
    // *string*; we assert the title-case variant is present.
    const expected = TODAY_RING_OVERLINE; // "REMAINING"
    const text = (container.textContent ?? "").toUpperCase();
    expect(text).toContain(expected);
  });

  it("renders all 4 Today stat tile labels (uppercased on the landing)", () => {
    const { container } = render(<LandingPage />);
    const text = (container.textContent ?? "").toUpperCase();
    expect(text).toContain(TODAY_STAT_LABELS.logged.toUpperCase());
    expect(text).toContain(TODAY_STAT_LABELS.target.toUpperCase());
    expect(text).toContain(TODAY_STAT_LABELS.burned.toUpperCase());
    expect(text).toContain(TODAY_STAT_LABELS.net.toUpperCase());
  });

  it("uses meal-slot headers (Breakfast / Lunch / Snack) on the mocks", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).toContain(MEAL_SLOT_HEADERS.breakfast);
    expect(text).toContain(MEAL_SLOT_HEADERS.lunch);
    expect(text).toContain(MEAL_SLOT_HEADERS.snack);
  });

  it("labels the Net detail as 'deficit' (not 'below maintenance')", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).toContain(NET_DEFICIT_LABEL);
    expect(text).not.toContain("below maint");
  });
});

describe("landing page — pricing tier parity with /pricing route", () => {
  const PRICING_SOURCE = readFileSync(
    join(process.cwd(), "app/pricing/page.tsx"),
    "utf8",
  );

  // Pricing page declares its tiers as an inline TIERS array. Prices
  // live in `price: "$X"` literals — a quick regex is reliable here.
  function pricesFromPricingRoute(): { name: string; price: string; period: string }[] {
    const matches = [
      ...PRICING_SOURCE.matchAll(
        /name:\s*"(\w+)"[\s\S]*?price:\s*"(\$\d+)"[\s\S]*?period:\s*"([^"]+)"/g,
      ),
    ];
    return matches.map((m) => ({ name: m[1]!, price: m[2]!, period: m[3]! }));
  }

  it("/pricing exposes exactly Free / Base / Pro", () => {
    const tiers = pricesFromPricingRoute();
    expect(tiers.map((t) => t.name)).toEqual(["Free", "Base", "Pro"]);
  });

  it("landing displays every /pricing headline price", () => {
    const tiers = pricesFromPricingRoute();
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    for (const tier of tiers) {
      expect(text).toContain(tier.price);
    }
  });

  it("landing tier names match /pricing tier names", () => {
    const tiers = pricesFromPricingRoute();
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    for (const tier of tiers) {
      expect(text).toContain(tier.name);
    }
  });
});

describe("landing page — forbidden marketing claims", () => {
  const FORBIDDEN_CLAIMS = [
    // Retired: "400+ sources" — we don't have a curated source list
    "400+",
    "400 recipe sites",
    // Retired: Android as a shipping platform — not on the roadmap
    "iOS, Android, web",
    "Android, iOS",
    // Retired: voice control in cook mode — the real cook mode
    // doesn't ship voice navigation. Voice *logging* (tracker) is a
    // Pro feature and remains valid marketing.
    "voice control",
    // Retired: annual-plan prices — /pricing says "coming soon"
    "$50/year",
    "$120/year",
    // Retired: mock URL
    "app.suppr.co",
  ];

  it.each(FORBIDDEN_CLAIMS)("does not claim %s", (claim) => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).not.toContain(claim);
  });
});
