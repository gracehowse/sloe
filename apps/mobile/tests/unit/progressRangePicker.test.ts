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

  it("mobile header omits the range overline (pills + subtitle carry time context)", () => {
    // Sloe Figma 492:2 retired the `LAST N DAYS` overline entirely — the
    // 7d/30d/90d/All pills + the calm subtitle carry the range. Default
    // range is `30d`.
    expect(mobileSrc).toMatch(/const \[rangeKey, setRangeKey\] = useState<"7d" \| "30d" \| "90d" \| "all">\("30d"\)/);
    // The retired overline labels must be gone from the rendered source.
    expect(mobileSrc).not.toContain("LAST 30 DAYS");
    expect(mobileSrc).not.toContain("LAST 7 DAYS");
    expect(mobileSrc).not.toContain("ALL TIME");
    // The old static "Weekly report" subtitle must be gone.
    expect(mobileSrc).not.toContain("Weekly report");
    // 2026-05-22 — overline removed from sticky chrome (duplicated the pills).
    expect(mobileChromeSrc).toContain("overline={null}");
    expect(mobileChromeSrc).toContain('titleTestID="progress-header"');
    // Re-pinned: headers census 2026-06-10. The chrome title converged onto the
    // canonical Type.title token (Newsreader serif 24/28) + navPrimary, and the
    // compact-22 size fork was deleted — Plan/Progress now render the same 24px
    // tab title as every sibling (22 was off the type ramp). The raw
    // "Newsreader_400Regular" string + the `compact ? 22 : …` fork are gone.
    expect(mobileSectionSrc).toMatch(/title:\s*\{\s*\.\.\.Type\.title,\s*color:\s*colors\.navPrimary\s*\}/);
    expect(mobileSectionSrc).not.toMatch(/compact\s*\?\s*22/);
    expect(mobileSectionSrc).not.toContain('"Newsreader_400Regular"');
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

  it("web header shows the calm subtitle, not the retired range overline", () => {
    expect(webSrc).toMatch(/const \[range, setRange\] = useState<"7d" \| "30d" \| "90d" \| "all">\("30d"\)/);
    // Sloe Figma 492:2 retired the `LAST N DAYS` overline — only a stray
    // mention may survive in a code comment, never the rendered labels.
    expect(webSrc).not.toContain("LAST 7 DAYS");
    expect(webSrc).not.toContain("LAST 90 DAYS");
    expect(webSrc).not.toContain("ALL TIME");
    expect(webSrc).not.toContain("Weekly report");
    // The chrome renders the calm subtitle slot (`progress-subtitle`).
    expect(webChromeSrc).toContain('data-testid="progress-subtitle"');
    expect(webChromeSrc).toContain('data-testid="progress-header"');
    // Sloe Figma 492:2 redesign sized the serif "Progress" title at 28px
    // (the calm subtitle replaced the uppercase range overline). Web/mobile
    // Progress header-size + subtitle parity tracked in ENG-985.
    expect(webChromeSrc).toMatch(/text-\[28px\]/);
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

  it("mobile range picker is the Sloe aubergine soft-tint pill rail (web parity)", () => {
    // 2026-06-08 Sloe treatment system (docs/prototypes/sloe-component-
    // treatments.html §7): the selected range pill moved off the solid plum
    // fill onto the aubergine SOFT-TINT — `accent.primarySoft` fill +
    // `accent.primarySolid` border/label — rationing the accent (the solid
    // fill is reserved for the FAB + conversion CTAs). The old inset
    // segmented-control container stays gone.
    expect(mobileSrc).toMatch(/testID="progress-range-picker"[\s\S]*?style=\{\{ flexDirection: "row", gap: (?:6|Spacing\.sm) \}\}/);
    expect(mobileSrc).not.toMatch(/testID="progress-range-picker"[\s\S]*?borderRadius: 10,\s*\n\s*padding: 4,/);
    // Chips census (2026-06-10): selected = soft fill + solid LABEL only —
    // the accentSolid selected RING double-signalled and no sibling filter
    // chip wears one (§7 grammar). Hairline border matches the fill when
    // selected so no ring renders.
    expect(mobileSrc).toMatch(/backgroundColor: active \? t\.accentSoft : t\.elevated/);
    expect(mobileSrc).toMatch(/borderColor: active \? t\.accentSoft : t\.border/);
    expect(mobileSrc).not.toMatch(/borderColor: active \? t\.accentSolid : t\.border/);
    expect(mobileSrc).toMatch(/color: active \? t\.accentSolid : t\.sub/);
    // The treatment tokens resolve from the aubergine accent.
    expect(mobileSrc).toMatch(/accentSolid: accent\.primarySolid/);
    expect(mobileSrc).toMatch(/accentSoft: accent\.primarySoft/);
    // The solid-plum range-pill fill is gone.
    expect(mobileSrc).not.toMatch(/backgroundColor: active \? t\.plum : t\.elevated/);
  });

  it("web range picker uses aubergine soft-tint active pills (mobile parity)", () => {
    // Re-pinned to the shipped chip grammar (web parity 2026-06-10, ENG-1022):
    // active range = `bg-primary-soft` fill + `primary-solid` label +
    // `font-semibold`, NO ring/border; inactive = quiet `bg-card` + muted label,
    // NO border. This supersedes the older `bg-primary/10 border-primary-solid`
    // pin, which drifted in commit 504c00db without updating this assertion —
    // a pre-existing web-only stale pin, unrelated to the mobile headers census.
    expect(webSrc).toMatch(/data-testid="progress-range-picker"/);
    expect(webSrc).toContain("bg-primary-soft text-primary-solid font-semibold");
    expect(webSrc).toMatch(/bg-card text-muted-foreground font-medium/);
    // Neither the old plum fill nor the old primary-fill chip styling.
    expect(webSrc).not.toContain("bg-foreground-brand text-white");
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
