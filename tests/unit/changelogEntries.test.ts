/**
 * Shared changelog data — unit coverage.
 *
 * Pins the public contract that both the mobile What's new screen
 * (`apps/mobile/app/whats-new.tsx`) and the web page
 * (`app/whats-new/page.tsx`) rely on. Regressions here silently
 * break both platforms at once, so we keep the coverage tight.
 *
 * Covers:
 *   1. `getLatestChangelog()` returns the highest build number that
 *      has at least one item (the build-11 placeholder is empty by
 *      design and must not be the default).
 *   2. `getAllChangelogs()` is sorted newest-first regardless of
 *      authoring order in the source file.
 *   3. `ChangelogItem.kind` accepts exactly the three documented
 *      values — no silent widening of the enum.
 *   4. The build-10 entry carries the tester attribution footer and
 *      every bullet sits under the 120-char copy rule.
 */
import { describe, expect, it } from "vitest";

import {
  CHANGELOG_BULLET_MAX_CHARS,
  changelogKindLabel,
  getAllChangelogs,
  getLatestChangelog,
  groupChangelogItems,
  type ChangelogItemKind,
} from "../../src/lib/changelog/entries";

describe("changelog/entries", () => {
  it("getLatestChangelog returns the highest build number that has items (skips placeholders)", () => {
    const latest = getLatestChangelog();
    // 2026-05-01: build 11 picked up its first bullet (recipe detail
    // v3 redesign), and PR #30 added build 12 (Today micros widget) —
    // build 12 is now the latest user-visible entry. When a future
    // build N+1 ships items, bump the expectation here in lockstep.
    expect(latest.buildNumber).toBe(12);
    expect(latest.items.length).toBeGreaterThan(0);
  });

  it("getAllChangelogs sorts newest-first regardless of source order", () => {
    const all = getAllChangelogs();
    expect(all.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < all.length; i++) {
      expect(all[i - 1].buildNumber).toBeGreaterThan(all[i].buildNumber);
    }
    // The currently-shipped builds in the data file.
    expect(all.map((e) => e.buildNumber)).toEqual(
      expect.arrayContaining([10, 11]),
    );
  });

  it("pins the ChangelogItem.kind enum — every bullet uses one of the three documented kinds", () => {
    const allowed: ChangelogItemKind[] = ["fixed", "new", "coming_soon"];
    for (const entry of getAllChangelogs()) {
      for (const item of entry.items) {
        expect(allowed).toContain(item.kind);
        // `text` is always a non-empty string — an empty bullet would
        // render as dead space.
        expect(typeof item.text).toBe("string");
        expect(item.text.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it("build 10 carries tester attribution and every bullet respects the 120-char copy rule", () => {
    const entry = getAllChangelogs().find((e) => e.buildNumber === 10);
    expect(entry).toBeDefined();
    expect(entry?.testerAttribution).toMatch(
      /^Shaped by TestFlight feedback from \d+ testers\.$/,
    );
    for (const item of entry!.items) {
      expect(item.text.length).toBeLessThanOrEqual(CHANGELOG_BULLET_MAX_CHARS);
    }
  });

  it("changelogKindLabel maps every kind to a stable human label", () => {
    expect(changelogKindLabel("fixed")).toBe("Fixed");
    expect(changelogKindLabel("new")).toBe("New");
    expect(changelogKindLabel("coming_soon")).toBe("Coming soon");
  });

  it("groupChangelogItems renders sections in the canonical order (new → fixed → coming_soon)", () => {
    const entry = getAllChangelogs().find((e) => e.buildNumber === 10)!;
    const groups = groupChangelogItems(entry);
    // Sections the renderer will emit, in order.
    const kinds = groups.map((g) => g.kind);
    // Every present kind must appear at most once and in canonical order.
    const canonicalOrder: ChangelogItemKind[] = [
      "new",
      "fixed",
      "coming_soon",
    ];
    const filtered = canonicalOrder.filter((k) => kinds.includes(k));
    expect(kinds).toEqual(filtered);
    // Every returned group has at least one item — empty groups are
    // filtered out so the UI never renders a headless section.
    for (const group of groups) {
      expect(group.items.length).toBeGreaterThan(0);
    }
  });

  it("groupChangelogItems returns the canonical order for the populated entries", () => {
    // 2026-05-01: build 11 graduated from placeholder to real entry.
    // Pre-fix this test pinned build 11 as `[]`. Now it carries a
    // single `fixed` bullet. The canonical-order assertion still
    // applies — sections render `new` → `fixed` → `coming_soon`.
    const entry = getAllChangelogs().find((e) => e.buildNumber === 11);
    expect(entry).toBeDefined();
    const groups = groupChangelogItems(entry!);
    expect(groups.map((g) => g.kind)).toEqual(["fixed"]);
    expect(groups[0].items.length).toBe(1);
  });
});
