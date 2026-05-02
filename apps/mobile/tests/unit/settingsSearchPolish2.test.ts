/**
 * Settings polish-2 (2026-05-01, TestFlight Build 40).
 *
 * Five focused polish items (see
 * `docs/decisions/2026-05-01-settings-mobile-polish-2.md`):
 *
 *  1. Lucide `Search` replaces the bare emoji magnifier in the
 *     Settings search bar. (Feedback ALCot9q4E4UFAtVubO6GlHo.)
 *  2. The promo placeholder no longer leaks the SUPPR_TEST_PREMIUM SKU.
 *  3. The PROMO CODE micro-header is sentence-case, matching the
 *     bundle's SectionHeading pattern (14/700, -0.1 tracking).
 *  4. Fasting is findable: searching "fast" / "fasting" / "intermittent"
 *     matches the Body & activity section, which now has a
 *     `settings-fasting-row` row pointing at `/fasting`. (Feedback
 *     AFHtAQRAWad1w8bDvSgZkUg.)
 *
 * Mounting the full Settings screen in vitest is heavy — this is a
 * structural source-level check that guards the contract.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SETTINGS_PATH = resolve(__dirname, "../../app/(tabs)/settings.tsx");
const SRC = readFileSync(SETTINGS_PATH, "utf8");

const MAGNIFIER = "\u{1F50D}";

describe("Settings polish-2 (TestFlight Build 40)", () => {
  it("imports lucide Search and renders it in place of the emoji magnifier", () => {
    // Item 1.
    expect(SRC).toMatch(/import\s*\{[^}]*\bSearch\b[^}]*\}\s*from\s*["']lucide-react-native["']/);
    expect(SRC).toMatch(/<Search\s+size=\{16\}/);
    // The bare emoji must not survive in the render tree of Settings.
    expect(SRC).not.toContain(MAGNIFIER);
  });

  it("uses a neutral 'Enter code' placeholder, not the SUPPR_TEST_PREMIUM SKU", () => {
    // Item 3 — no internal SKU leaks to user-facing surfaces.
    expect(SRC).not.toContain("SUPPR_TEST_PREMIUM");
    expect(SRC).toMatch(/placeholder="Enter code"/);
  });

  it("renders the Promo code micro-header in sentence case (no ALL CAPS)", () => {
    // Item 2 — drop the explicit ALL-CAPS string + letterSpacing 0.6.
    expect(SRC).not.toContain(">PROMO CODE<");
    expect(SRC).toMatch(/>Promo code</);
    // Bundle SectionHeading visual: 14/700, letterSpacing -0.1, sentence case.
    expect(SRC).toMatch(/letterSpacing:\s*-0\.1[^}]*\}\s*\}\s*>\s*Promo code</);
  });

  it("registers fasting keywords in the Body & activity section search", () => {
    // Item 4a — keyword index hits "fast", "fasting", "intermittent".
    const bodyActivityArray = SRC.match(
      /matchesSearch\(\s*\[\s*"Body & activity"[\s\S]*?\]\)/,
    );
    expect(bodyActivityArray).not.toBeNull();
    const arr = bodyActivityArray?.[0] ?? "";
    expect(arr).toContain('"Fasting"');
    expect(arr).toContain('"fast"');
    expect(arr).toContain('"intermittent"');
  });

  it("renders a Fasting row that pushes /fasting", () => {
    // Item 4b — real Settings home for the feature, not just a search hit.
    expect(SRC).toContain('testID="settings-fasting-row"');
    expect(SRC).toMatch(/router\.push\(\s*"\/fasting"/);
    expect(SRC).toMatch(/>Intermittent fasting</);
  });
});

/**
 * Search keyword index integration test — reproduces the matcher
 * settings.tsx uses (case-insensitive substring against the keyword
 * list) and asserts that "fast" hits the Body & activity section.
 *
 * This is what the user actually did in TestFlight Build 40
 * (feedback AFHtAQRAWad1w8bDvSgZkUg): typed "fast", expected a hit.
 */
describe("Settings search keyword index — fasting", () => {
  function matches(haystack: readonly string[], query: string): boolean {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    for (const s of haystack) {
      if (s.toLowerCase().includes(q)) return true;
    }
    return false;
  }

  // Mirror of the keyword list in settings.tsx for the Body & activity
  // section. If/when the section's keywords change, update here.
  const BODY_ACTIVITY_KEYWORDS = [
    "Body & activity",
    "Activity level",
    "TDEE",
    "active",
    "sedentary",
    "Fasting",
    "fast",
    "intermittent",
    "16:8",
    "eating window",
  ];

  // The matcher returns true when ANY haystack item contains the query
  // as a substring (haystack.includes(q)). Multi-word queries like
  // "Intermittent fasting" won't hit unless a haystack item literally
  // contains that phrase — for now the tester's actual flow is
  // single-word ("fast", "fasting").
  it.each([
    "fast",
    "Fast",
    "FAST",
    "fasting",
    "Fasting",
    "intermittent",
    "16:8",
  ])("matches Body & activity for query %s", (query) => {
    expect(matches(BODY_ACTIVITY_KEYWORDS, query)).toBe(true);
  });

  it("does not match Body & activity for an unrelated query", () => {
    expect(matches(BODY_ACTIVITY_KEYWORDS, "kombucha")).toBe(false);
  });
});
