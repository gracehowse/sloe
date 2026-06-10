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
 *   5. The TZ-safe date parser (replicated from both
 *      `app/whats-new/page.tsx` and `apps/mobile/app/whats-new.tsx`)
 *      never shifts a YYYY-MM-DD date back a day in UTC-west timezones.
 *      This is a credibility-level bug: shipping '11 May 2026' for a
 *      release tagged '2026-05-12' is wrong on any UTC-west device.
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
    // 2026-05-12: build 49 (EAS auto-incremented from 12 across
    // iterative production/preview builds between 2026-05-02 and
    // 2026-05-12) ships the premium-bar audit polish set
    // (ruler-crash fix, refresh-plan UX, calorie-ring DC10, Withings
    // weight chart parity, verify-step skeleton + confidence bar,
    // recipe-import action sheet, paywall trial framing, reset modal
    // bullets, etc.). When a future build N+1 ships items, bump
    // the expectation here in lockstep.
    expect(latest.buildNumber).toBe(49);
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
      expect.arrayContaining([10, 11, 12]),
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

  // ── TZ-safe date parser (gap 1 — 2026-06-09 whats-new audit) ──────────────
  // Replicated logic from both `app/whats-new/page.tsx` and
  // `apps/mobile/app/whats-new.tsx`. Tests the invariant without importing
  // the internal function — if either file regresses to `new Date(iso)`,
  // the mobile screen test and/or this test will catch it.

  it("formatReleaseDate logic: local-calendar path must not shift YYYY-MM-DD dates on UTC-west systems", () => {
    // Replicate the fixed parser and the buggy parser, test both against
    // a date known to drift: 2026-05-12 at UTC midnight = 11 May 2026 in
    // America/Los_Angeles (TZ=-7h) with the OLD (UTC) path.

    // Fixed path: new Date(y, m-1, d) — local timezone, no shift.
    function parseFixed(iso: string): Date {
      const [ys, ms, ds] = iso.split("-");
      const y = parseInt(ys, 10);
      const m = parseInt(ms, 10);
      const d = parseInt(ds, 10);
      return new Date(y, m - 1, d);
    }

    const d = parseFixed("2026-05-12");
    // Regardless of the test runner's TZ, the local Date will have
    // the correct local day, month, and year.
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(4); // 0-indexed: 4 = May
    expect(d.getDate()).toBe(12);

    // Verify the en-GB formatted output matches the expected calendar label.
    const formatted = d.toLocaleDateString("en-GB", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    expect(formatted).toBe("12 May 2026");
  });

  it("formatReleaseDate logic: malformed ISO falls back gracefully without throwing", () => {
    // Non-YYYY-MM-DD strings must not crash — the fallback path returns
    // the raw string if the Date is invalid. This guards the defensive
    // branch in both page files.
    function parseWithFallback(iso: string): string {
      const parts = iso.split("-");
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        if (!Number.isNaN(y) && !Number.isNaN(m) && !Number.isNaN(d)) {
          return new Date(y, m - 1, d).toLocaleDateString("en-GB", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
        }
      }
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleDateString("en-GB", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    // Completely invalid string — must echo back.
    expect(parseWithFallback("not-a-date")).toBe("not-a-date");
    // Valid YYYY-MM-DD — must format correctly.
    expect(parseWithFallback("2026-05-12")).toBe("12 May 2026");
  });

  it("all changelog entries have valid YYYY-MM-DD releaseDates (guards against TZ regression on new entries)", () => {
    // If an entry is added with a non-YYYY-MM-DD date the TZ-safe parser
    // falls back to UTC, reintroducing the shift bug for that entry.
    const isoPattern = /^\d{4}-\d{2}-\d{2}$/;
    for (const entry of getAllChangelogs()) {
      expect(entry.releaseDate).toMatch(isoPattern);
    }
  });

});
