/**
 * Mobile + web Progress screens — prototype port pins (2026-04-20).
 *
 * Pins the header + range-picker shape that landed when the Progress
 * tab was ported to the Claude Design prototype, plus the skeleton-
 * gate fix that wraps `loadData` / `load` in try/finally so a thrown
 * supabase error can't pin the skeleton indefinitely (Grace's
 * 2026-04-20 testflight screenshot).
 *
 * These are structural source-grep pins — cheap, survive RNTL / mock
 * drift, and run in plain node.
 *
 * Deferred (flagged in the port summary): the deeper card-level
 * restructure (sparkline weight card, calories bar card, protein bar
 * card matching the prototype's exact bordered-14px-radius shape).
 * The existing cards below the range picker are left in place; this
 * pass only aligns the header + picker + skeleton-gate.
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../..");

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("Progress prototype port — header + range picker", () => {
  const mobileSrc = read("apps/mobile/app/(tabs)/progress.tsx");
  const mobileChromeSrc = read("apps/mobile/components/tabs/ProgressTabChrome.tsx");
  const mobileSectionSrc = read("apps/mobile/components/suppr/screen-section-chrome.tsx");
  const webSrc = read("src/app/components/ProgressDashboard.tsx");
  const webChromeSrc = read("src/app/components/suppr/progress-tab-chrome.tsx");

  it("mobile header omits the duplicate range overline (pills carry time context)", () => {
    // New state drives the overline label: `LAST 7 DAYS` / `LAST 30
    // DAYS` / `LAST 90 DAYS` / `ALL TIME`. Default range is `30d`.
    expect(mobileSrc).toMatch(/const \[rangeKey, setRangeKey\] = useState<"7d" \| "30d" \| "90d" \| "all">\("30d"\)/);
    expect(mobileSrc).toContain("LAST 30 DAYS");
    expect(mobileSrc).toContain("LAST 7 DAYS");
    expect(mobileSrc).toContain("LAST 90 DAYS");
    expect(mobileSrc).toContain("ALL TIME");
    // The old static "Weekly report" subtitle must be gone.
    expect(mobileSrc).not.toContain("Weekly report");
    // 2026-05-22 — overline removed from sticky chrome (duplicated the pills).
    expect(mobileChromeSrc).toContain("overline={null}");
    expect(mobileChromeSrc).toContain('titleTestID="progress-header"');
    // Progress chrome uses compact title sizing (22pt) + the Sloe Newsreader
    // serif with tuned -0.3 tracking, via ScreenSectionChrome.
    expect(mobileSectionSrc).toMatch(/fontFamily:\s*"Newsreader_400Regular"/);
    expect(mobileSectionSrc).toMatch(/fontSize:\s*compact\s*\?\s*22\s*:\s*Layout\.titleSize/);
    expect(mobileSectionSrc).toMatch(/letterSpacing:\s*compact\s*\?\s*-0\.3\s*:\s*-0\.3/);
  });

  it("mobile header carries a trailing log-weight control", () => {
    // Trailing chrome button — `Scale` glyph, test id kept for e2e parity.
    expect(mobileSrc).toMatch(/<Scale\b/);
    expect(mobileSrc).toContain('testID="progress-calendar-button"');
  });

  it("mobile renders [7d, 30d, 90d, All] range-picker pills with test IDs", () => {
    expect(mobileSrc).toContain('testID="progress-range-picker"');
    expect(mobileSrc).toContain('testID={`progress-range-pill-${k}`}');
    // The pill list maps over the full 4-range tuple.
    expect(mobileSrc).toMatch(/\["7d", "30d", "90d", "all"\] as const\)\.map/);
    // Pressing a pill calls setRangeKey(k) — may be inline or inside
    // a multi-line handler that also fires a haptic.
    expect(mobileSrc).toContain("setRangeKey(k)");
  });

  it("mobile skeleton-gate fix — loadData wraps fetch+hydrate in try/finally", () => {
    // Try block opens right after the early-return + setLoading(true).
    expect(mobileSrc).toMatch(/setLoading\(true\);[\s\S]*?try \{/);
    // Finally backstop flips loading regardless of sad-path throws.
    expect(mobileSrc).toMatch(/\} finally \{\s*setLoading\(false\);\s*\}/);
    // Happy-path setLoading(false) is still before the deferred fetch
    // so the H-4 first-paint order pin in `progressSkeletonSource.test.ts`
    // keeps passing.
    const happyPathIdx = mobileSrc.indexOf("setLoading(false)");
    const deferredIdx = mobileSrc.indexOf("void getDailyTargets(supabase, userId, weekKeys)");
    expect(happyPathIdx).toBeGreaterThan(-1);
    expect(deferredIdx).toBeGreaterThan(-1);
    expect(happyPathIdx).toBeLessThan(deferredIdx);
  });

  it("web header carries an uppercase range overline (not 'Weekly report')", () => {
    expect(webSrc).toMatch(/const \[range, setRange\] = useState<"7d" \| "30d" \| "90d" \| "all">\("30d"\)/);
    expect(webSrc).toContain("LAST 30 DAYS");
    expect(webSrc).toContain("LAST 7 DAYS");
    expect(webSrc).toContain("LAST 90 DAYS");
    expect(webSrc).toContain("ALL TIME");
    expect(webSrc).not.toContain("Weekly report");
    expect(webSrc + webChromeSrc).toContain('data-testid="progress-overline"');
    expect(webChromeSrc).toContain('data-testid="progress-header"');
    // 24pt per the prototype mirrors mobile title size — uses Tailwind `text-2xl`
    // (1.5rem = 24px) with the Sloe headline font.
    expect(webChromeSrc).toMatch(/text-2xl/);
    expect(webChromeSrc).toMatch(/font-\[family-name:var\(--font-headline\)\]/);
  });

  it("web header carries a calendar icon button", () => {
    // Uses the new `Icons.calendar` alias (CalendarDays lucide glyph),
    // the shared equivalent of the mobile `calendar-outline` Ionicon.
    expect(webSrc).toContain("Icons.calendar");
    expect(webSrc).toContain('data-testid="progress-calendar-button"');
  });

  it("web renders [7d, 30d, 90d, All] range-picker pills with test IDs", () => {
    expect(webSrc).toContain('data-testid="progress-range-picker"');
    expect(webSrc).toContain('data-testid={`progress-range-pill-${k}`}');
    expect(webSrc).toMatch(/\["7d", "30d", "90d", "all"\] as const\)\.map/);
    // Clicking a pill updates `range`.
    expect(webSrc).toContain("onClick={() => setRange(k)}");
  });

  it("web skeleton-gate fix — load wraps fetch+hydrate in try/finally", () => {
    // Try block opens inside the callback.
    expect(webSrc).toMatch(/setLoading\(true\);[\s\S]*?try \{/);
    // Finally backstop flips loading regardless of thrown errors.
    expect(webSrc).toMatch(/\} finally \{\s*setLoading\(false\);\s*\}/);
    // The happy-path `setLoading(false)` remains before the deferred
    // daily-targets fetch — the H-4 perf pin's ordering keeps holding.
    const happyPathIdx = webSrc.indexOf("setLoading(false)");
    const deferredIdx = webSrc.indexOf(
      "void getDailyTargets(supabase, authedUserId, weekKeys)",
    );
    expect(happyPathIdx).toBeGreaterThan(-1);
    expect(deferredIdx).toBeGreaterThan(-1);
    expect(happyPathIdx).toBeLessThan(deferredIdx);
  });

  it("web skeleton uses the prototype header (no 'Loading progress…' line)", () => {
    // Pinned text is gone from the rendered tree — the loading branch
    // now renders the prototype header + 2x2 tile skeleton and the
    // Suspense fallback mirrors the same chrome. Remaining matches
    // only appear inside the code-comment trail explaining the
    // regression, so we pin the absence of the rendered string rather
    // than every mention.
    expect(webSrc).not.toMatch(/>Loading progress…</);
    expect(webSrc).toContain('data-testid="progress-loading-skeleton"');
    expect(webSrc).toContain('data-testid="progress-suspense-fallback"');
    // Stat-tile placeholders mirror mobile's four testIDs.
    expect(webSrc).toContain("progress-skeleton-tile-");
    expect(webSrc).toMatch(/\[0, 1, 2, 3\]\.map/);
  });

  it("mobile range picker is a segmented control (muted container, inset chip)", () => {
    // 2026-04-21 D5 port — prototype `screens-mobile.jsx:581-591`.
    // Container wraps the pills in a muted bg + padding + 10px radius.
    expect(mobileSrc).toMatch(/testID="progress-range-picker"[\s\S]*?backgroundColor: t\.border[\s\S]*?borderRadius: 10[\s\S]*?padding: 4/);
    // Active chip uses `t.elevated` (card) not the accent; individual
    // pill rows no longer set a `borderWidth`/`borderColor`.
    expect(mobileSrc).toMatch(/active \? t\.elevated : "transparent"/);
    expect(mobileSrc).not.toMatch(/borderColor: active \? t\.accent : t\.border/);
    // Subtle shadow marks the active chip (prototype's `0 1px 2px rgba(0,0,0,0.1)`).
    expect(mobileSrc).toMatch(/shadowOpacity: active \? 0\.1 : 0/);
  });

  it("web range picker is a segmented control (muted container, inset chip)", () => {
    // 2026-04-21 D5 — mirrors mobile. `bg-muted` wraps the pills with
    // `p-1` + `rounded-[10px]`, and the active chip swaps to
    // `bg-card text-foreground shadow-sm` (no primary fill).
    expect(webSrc).toMatch(/data-testid="progress-range-picker"[\s\S]*?bg-muted/);
    expect(webSrc).toMatch(/p-1 rounded-\[10px\] bg-muted/);
    expect(webSrc).toMatch(/"bg-card text-foreground shadow-sm"/);
    expect(webSrc).not.toMatch(/bg-primary text-primary-foreground border-primary/);
  });

  it("web rangeDays still maps correctly for the new 4-pill layout", () => {
    // `rangeDays` feeds the weight + steps chart windows below the
    // picker. All-time stays at the existing 9999-day sentinel.
    expect(webSrc).toMatch(
      /const rangeDays = range === "7d" \? 7 : range === "30d" \? 30 : range === "90d" \? 90 : 9999/,
    );
  });
});
