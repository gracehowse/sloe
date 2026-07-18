/**
 * Settings search index — 2026-05-02
 * (`claude/fasting-findable-urgent`).
 *
 * Pin tests for the keyword-based search the Settings screen now
 * runs against `lib/settingsSearchIndex.ts`. Build 40 testers
 * reported "fast → No matches" with no in-app way to find the
 * fasting preferences; this index is the fix.
 */

import { describe, expect, it } from "vitest";
import {
  filterSettingsIndex,
  SETTINGS_SEARCH_INDEX,
} from "../../lib/settingsSearchIndex";

describe("filterSettingsIndex", () => {
  it("returns an empty array for an empty query (caller renders the bundle)", () => {
    expect(filterSettingsIndex("")).toEqual([]);
    expect(filterSettingsIndex("   ")).toEqual([]);
  });

  it("matches Fasting on the literal user complaint 'fast'", () => {
    const hits = filterSettingsIndex("fast");
    expect(hits.map((h) => h.id)).toContain("fasting");
  });

  it("matches Fasting on 'fasting'", () => {
    const hits = filterSettingsIndex("fasting");
    expect(hits.map((h) => h.id)).toContain("fasting");
  });

  it("matches Fasting on 'intermittent'", () => {
    const hits = filterSettingsIndex("intermittent");
    expect(hits.map((h) => h.id)).toContain("fasting");
  });

  it("matches Fasting on '16:8' (preset substring)", () => {
    const hits = filterSettingsIndex("16:8");
    expect(hits.map((h) => h.id)).toContain("fasting");
  });

  it("is case-insensitive (FAST, Fast, fast all hit)", () => {
    expect(filterSettingsIndex("FAST").map((h) => h.id)).toContain("fasting");
    expect(filterSettingsIndex("Fast").map((h) => h.id)).toContain("fasting");
    expect(filterSettingsIndex("fast").map((h) => h.id)).toContain("fasting");
  });

  it("Fasting entry routes to /fasting", () => {
    const fasting = SETTINGS_SEARCH_INDEX.find((e) => e.id === "fasting");
    expect(fasting).toBeDefined();
    expect(fasting?.route).toBe("/fasting");
  });

  it("matches Daily targets on common goal keywords", () => {
    expect(filterSettingsIndex("calorie").map((h) => h.id)).toContain(
      "daily-targets",
    );
    expect(filterSettingsIndex("protein").map((h) => h.id)).toContain(
      "daily-targets",
    );
    expect(filterSettingsIndex("macro").map((h) => h.id)).toContain(
      "daily-targets",
    );
  });

  it("matches Notifications on push / reminder", () => {
    expect(filterSettingsIndex("push").map((h) => h.id)).toContain(
      "notifications",
    );
    expect(filterSettingsIndex("reminder").map((h) => h.id)).toContain(
      "notifications",
    );
  });

  it("matches Apple Health on health / healthkit / steps", () => {
    expect(filterSettingsIndex("health").map((h) => h.id)).toContain(
      "health-sync",
    );
    expect(filterSettingsIndex("healthkit").map((h) => h.id)).toContain(
      "health-sync",
    );
    expect(filterSettingsIndex("steps").map((h) => h.id)).toContain(
      "health-sync",
    );
  });

  it("returns empty array for nonsense queries (drives the empty-state copy)", () => {
    expect(filterSettingsIndex("xyzzy")).toEqual([]);
    expect(filterSettingsIndex("qqqqqqq")).toEqual([]);
  });

  it("does not over-match — 'fast' returns Fasting only, not Daily targets", () => {
    const ids = filterSettingsIndex("fast").map((h) => h.id);
    expect(ids).toContain("fasting");
    expect(ids).not.toContain("daily-targets");
    expect(ids).not.toContain("notifications");
    expect(ids).not.toContain("health-sync");
    // ENG-955 — the weigh-in reminder has no "fast"-containing keyword.
    expect(ids).not.toContain("weigh-in-reminder");
  });

  it("matches the ENG-955 weigh-in reminder on weigh keywords, routing to Settings", () => {
    for (const q of ["weigh", "weigh in", "weigh-in", "scale"]) {
      const ids = filterSettingsIndex(q).map((h) => h.id);
      expect(ids, q).toContain("weigh-in-reminder");
    }
    const entry = SETTINGS_SEARCH_INDEX.find((e) => e.id === "weigh-in-reminder");
    expect(entry?.route).toBe("/settings");
    // Anti-nag framing in the sub copy — never a streak/badge/threat.
    expect(entry?.sub.toLowerCase()).not.toMatch(/streak|badge|don't lose|keep your/);
  });

  it("every entry has a stable id, label, sub, route, and at least one keyword", () => {
    const ids = new Set<string>();
    for (const entry of SETTINGS_SEARCH_INDEX) {
      expect(entry.id).toBeTruthy();
      expect(ids.has(entry.id)).toBe(false);
      ids.add(entry.id);
      expect(entry.label.length).toBeGreaterThan(0);
      expect(entry.sub.length).toBeGreaterThan(0);
      expect(entry.route.startsWith("/")).toBe(true);
      expect(entry.keywords.length).toBeGreaterThan(0);
    }
  });
});
