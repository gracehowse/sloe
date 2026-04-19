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
 *     actually ship today — tied to the RoadmapStatus tag, not
 *     hand-written copy.
 *   - The landing respects the canonical `TODAY_RING_OVERLINE`,
 *     `TODAY_STAT_LABELS`, and `MEAL_SLOT_HEADERS` from
 *     `src/lib/copy/today.ts`.
 *   - TDEE and nutrition-source claims on the landing stay pinned to
 *     the real constants in `adaptiveTdee.ts` and
 *     `src/lib/landing/content.ts`. If someone changes an algorithm
 *     threshold (e.g. requires 14 days of logging instead of 7), the
 *     landing copy must be updated — this test will fail otherwise.
 *
 * Scope note: we assert on the rendered HTML of `LandingPage` (the
 * component), not the raw source. That way a string that's broken up
 * by JSX tags, or composed from constants, still counts.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { LandingPage } from "../../app/(landing)/LandingPage";
import {
  TODAY_RING_OVERLINE,
  TODAY_STAT_LABELS,
  MEAL_SLOT_HEADERS,
  NET_DEFICIT_LABEL,
} from "../../src/lib/copy/today";
import {
  NUTRITION_SOURCES,
  PRICING_TIERS,
  ROADMAP,
  TDEE_MIN_LOGGING_DAYS,
  TDEE_MIN_WEIGH_INS,
  FREE_SAVE_LIMIT,
  currentAppVersionLabel,
} from "../../src/lib/landing/content";

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

  it("/pricing imports the shared SSOT (PRICING_TIERS)", () => {
    expect(PRICING_SOURCE).toContain("PRICING_TIERS");
    expect(PRICING_SOURCE).toContain('from "../../src/lib/landing/content');
  });

  it("SSOT exposes exactly Free / Base / Pro", () => {
    expect(PRICING_TIERS.map((t) => t.name)).toEqual(["Free", "Base", "Pro"]);
  });

  it("landing displays every SSOT tier headline price", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    for (const tier of PRICING_TIERS) {
      expect(text).toContain(tier.price);
    }
  });

  it("landing tier names match SSOT tier names", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    for (const tier of PRICING_TIERS) {
      expect(text).toContain(tier.name);
    }
  });
});

describe("landing page — nutrition source pipeline parity", () => {
  it("trust strip lists every source the verifyIngredients pipeline uses", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    for (const source of NUTRITION_SOURCES) {
      expect(text).toContain(source);
    }
  });

  it("does not claim a source that isn't in the pipeline", () => {
    // Guard against re-adding a retired source to the trust strip
    // without also adding it to the pipeline (happened with Spoonacular in an
    // earlier draft).
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    const RETIRED = ["Spoonacular", "Nutritionix"];
    for (const gone of RETIRED) {
      expect(text).not.toContain(gone);
    }
  });
});

describe("landing page — Adaptive TDEE threshold parity", () => {
  it("cites the real minimum logging days from adaptiveTdee.ts", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    // Copy form: "logged N days"
    expect(text).toContain(`${TDEE_MIN_LOGGING_DAYS} days`);
  });

  it("cites the real minimum weigh-in count", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).toContain(`${TDEE_MIN_WEIGH_INS} times`);
  });

  it("does not repeat the retired '14 days' claim", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).not.toContain("over 14 days");
  });
});

describe("landing page — Free-tier save limit parity", () => {
  it("quotes the real FREE_SAVE_LIMIT", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).toContain(`${FREE_SAVE_LIMIT} recipes`);
  });
});

describe("landing page — roadmap parity", () => {
  it("'Now' bucket renders the current app/build label", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text).toContain(currentAppVersionLabel());
  });

  it("every 'shipped' item from the SSOT renders on the landing", () => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    const shipped = ROADMAP.flatMap((b) => b.items).filter((i) => i.status === "shipped");
    for (const item of shipped) {
      expect(text).toContain(item.text);
    }
  });

  it("no item is listed as both 'building' and 'shipped'", () => {
    const building = new Set(
      ROADMAP.flatMap((b) => b.items).filter((i) => i.status === "building").map((i) => i.text),
    );
    const shipped = ROADMAP.flatMap((b) => b.items).filter((i) => i.status === "shipped").map((i) => i.text);
    for (const s of shipped) {
      expect(building.has(s)).toBe(false);
    }
  });

  /**
   * Every `building` roadmap item must point at a real anchor file so
   * marketing can't advertise work that doesn't exist yet — this is
   * exactly the failure mode that let "Creator analytics for published
   * recipes" sit at `status: "building"` with zero scaffolding until
   * the 2026-04-19 sync-enforcer sweep caught it.
   *
   * Adding a new `building` item requires adding its anchor here. The
   * anchor must be a path to a file that exists today; a directory
   * path (e.g. `apps/mobile/widgets/`) also counts, provided the
   * directory contains at least one file. If the work hasn't started,
   * the item should stay `planned`.
   */
  const BUILDING_ANCHORS: Record<string, string> = {
    "Home screen widgets (iOS)": "apps/mobile/lib/widgetSnapshot.ts",
    "Richer macro trend reports": "src/app/components/ProgressDashboard.tsx",
  };

  function anchorExists(relPath: string): boolean {
    const abs = join(process.cwd(), relPath);
    if (!existsSync(abs)) return false;
    const s = statSync(abs);
    if (s.isFile()) return true;
    if (s.isDirectory()) {
      // Consider the anchor resolved if the directory contains any file.
      try {
        const entries = readdirSync(abs);
        return entries.some((e) => {
          try {
            return statSync(join(abs, e)).isFile();
          } catch {
            return false;
          }
        });
      } catch {
        return false;
      }
    }
    return false;
  }

  it("every 'building' roadmap item has an entry in BUILDING_ANCHORS", () => {
    const building = ROADMAP.flatMap((b) => b.items).filter((i) => i.status === "building").map((i) => i.text);
    const missing = building.filter((t) => !(t in BUILDING_ANCHORS));
    expect(missing).toEqual([]);
  });

  it("every BUILDING_ANCHORS entry resolves to at least one real file", () => {
    const building = new Set(
      ROADMAP.flatMap((b) => b.items).filter((i) => i.status === "building").map((i) => i.text),
    );
    const unresolved: string[] = [];
    for (const [text, anchor] of Object.entries(BUILDING_ANCHORS)) {
      if (!building.has(text)) continue; // stale map entry — tolerated, not a test fail
      if (!anchorExists(anchor)) {
        unresolved.push(`${text} → ${anchor}`);
      }
    }
    expect(unresolved).toEqual([]);
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
    // Retired: fabricated version label from an earlier draft
    "v1.4 · May 2026",
    // Retired: refund over-promise — refund is manual via Stripe
    "no questions asked",
    // Retired: imaginary perk — no monthly roadmap email exists
    "monthly roadmap email",
    // Retired: imaginary perk — we do not market CSV export
    "Export data (CSV)",
    // Retired: Android widget claim contradicts FAQ (Android not on roadmap)
    "iOS 18 + Android",
    // Retired: unsubstantiated SLO from an earlier draft
    "under five seconds",
    // Retired: promise of a perk that doesn't exist
    "direct support response",
    // Retired: "Creator analytics" promised but never built
    "creator analytics for published recipes going live",
  ];

  it.each(FORBIDDEN_CLAIMS)("does not claim %s", (claim) => {
    const { container } = render(<LandingPage />);
    const text = container.textContent ?? "";
    expect(text.toLowerCase()).not.toContain(claim.toLowerCase());
  });
});
