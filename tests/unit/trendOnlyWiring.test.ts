/**
 * ENG-713 — trend-only weight wiring across the Progress + Settings surfaces
 * on both platforms. Source-level pins (mirrors the ENG-1098 calm-mode wiring
 * test) so a refactor can't silently drop the dignity behaviour:
 *
 *   - both Progress screens compute an EFFECTIVE weight-surface mode from the
 *     client-side pref + the flag, and gate the numeric weight surfaces on it
 *   - both Settings expose the flag-gated opt-in toggle (same testID)
 *   - the toggle fires the analytics event and the event contract forbids any
 *     weight value in the payload
 *   - the pref reuses the shared trend-copy helper (no per-platform copy fork)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const read = (p: string) => readFileSync(resolve(ROOT, p), "utf8");

const WEB_PROGRESS = "src/app/components/ProgressDashboard.tsx";
const MOBILE_PROGRESS = "apps/mobile/app/(tabs)/progress.tsx";
// The Settings toggle is extracted to its own component on each platform so the
// pinned Settings hosts stay thin (ENG-713). The host just mounts it; the
// behaviour + testID + analytics live in the extracted row.
const WEB_SETTINGS = "src/app/components/settings/TrendOnlyWeightToggle.tsx";
const MOBILE_SETTINGS = "apps/mobile/components/settings/TrendOnlyWeightRow.tsx";
const WEB_SETTINGS_HOST = "src/app/components/Settings.tsx";
const MOBILE_SETTINGS_HOST =
  "apps/mobile/components/settings/SettingsBundleContent.tsx";

describe("Progress screens honour the trend-only pref via an effective mode", () => {
  for (const p of [WEB_PROGRESS, MOBILE_PROGRESS]) {
    it(`${p} reads the pref + flag and derives effectiveWeightSurfaceMode`, () => {
      const src = read(p);
      expect(src, "reads the client-side pref").toMatch(/useTrendOnlyWeight/);
      expect(src, "reads the flag").toMatch(/progress_trend_only_v1/);
      expect(src, "derives an effective mode").toMatch(/effectiveWeightSurfaceMode/);
      // The escalation logic lives in the shared helper (so the pinned hosts stay
      // thin) — the host must call it, passing the DB mode, the pref, and the flag.
      // The helper only escalates a `show` surface to `trends_only`; it never
      // overrides a DB `hide`/`trends_only` back to numbers (pinned in the
      // helper's own unit test).
      expect(src).toMatch(/resolveEffectiveWeightSurfaceMode\s*\(/);
      expect(src).toMatch(
        /resolveEffectiveWeightSurfaceMode\([\s\S]{0,120}?(profileWeightSurfaceMode|weightSurfaceMode)[\s\S]{0,120}?trendOnlyWeight[\s\S]{0,120}?isFeatureEnabled\("progress_trend_only_v1"\)/,
      );
    });

    it(`${p} gates the numeric "show" weight surface on the effective mode, not the raw profile mode`, () => {
      const src = read(p);
      // With the escalation extracted to the shared helper, NO render-site gate
      // reads the raw profile mode directly — every `=== "show"` / `=== "trends_only"`
      // gate is on effectiveWeightSurfaceMode. (Comments referencing the raw name
      // are excluded: they don't compare with `===`.)
      const rawShowGates = src.match(/\b(profileWeightSurfaceMode|weightSurfaceMode) === "(show|trends_only)"/g) ?? [];
      expect(rawShowGates.length, `raw-mode gates in ${p}: ${rawShowGates.join(", ")}`).toBe(0);
    });

    it(`${p} sources its trend copy from the shared helper (no per-platform fork)`, () => {
      const src = read(p);
      expect(src).toMatch(/describeTrendOnly/);
      expect(src).toMatch(/TREND_ONLY_MODE_NOTE/);
      // The old valenced T13 copy must no longer be ASSIGNED as a label value in
      // the card (it may survive in a historical JSDoc comment on web — that's
      // documentation, not rendered copy).
      expect(src).not.toMatch(/label\s*=[\s\S]{0,80}?Slightly (up|down) this week/);
    });
  }
});

describe("Settings hosts mount the extracted trend-only row", () => {
  it("web Settings host mounts <TrendOnlyWeightToggle />", () => {
    const src = read(WEB_SETTINGS_HOST);
    expect(src).toMatch(/TrendOnlyWeightToggle/);
    expect(src).toMatch(/<TrendOnlyWeightToggle\s*\/>/);
  });
  it("mobile Settings host mounts <TrendOnlyWeightRow />", () => {
    const src = read(MOBILE_SETTINGS_HOST);
    expect(src).toMatch(/TrendOnlyWeightRow/);
    expect(src).toMatch(/<TrendOnlyWeightRow\s*\/>/);
  });
});

describe("Settings expose the flag-gated opt-in toggle on both platforms", () => {
  for (const p of [WEB_SETTINGS, MOBILE_SETTINGS]) {
    it(`${p} renders the toggle only when progress_trend_only_v1 is on`, () => {
      const src = read(p);
      expect(src).toMatch(/settings-trend-only-weight-toggle/);
      expect(src).toMatch(/progress_trend_only_v1/);
      expect(src).toMatch(/useTrendOnlyWeight/);
    });

    it(`${p} fires trend_only_weight_toggled with a platform, and NO weight value`, () => {
      const src = read(p);
      expect(src).toMatch(/trend_only_weight_toggled/);
      // Grep the toggle's track(...) PAYLOAD object (the `{ ... }` after the event
      // name) and assert it carries enabled+platform only — never a kg / delta /
      // direction leak. The event NAME itself contains "weight", so we inspect
      // only the object literal, not the whole call.
      const call = src.match(/trend_only_weight_toggled\s*,\s*(\{[\s\S]{0,200}?\})/);
      expect(call, "found the track call payload").not.toBeNull();
      const payload = call![1];
      expect(payload).toMatch(/enabled/);
      expect(payload).toMatch(/platform/);
      expect(payload).not.toMatch(/weight|kg|delta|direction|deltaKg/i);
    });
  }
});
