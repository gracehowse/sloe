/**
 * canonicalTodayPhase2 — pins the Phase 2 (B1.2, 2026-04-27)
 * canonical Today behaviours that aren't covered by the broader
 * tracker tests.
 *
 * Authority: D-2026-04-27-03 (one canonical Today),
 * D-2026-04-27-07 (streak as pip), D-2026-04-27-15 (canonical FAB).
 *
 * Scope:
 *   - <StreakPip>: rendering rules at zero / 1 / N days.
 *   - <LogFab>: visibility, position, no-op default tap, custom
 *     onPress override.
 *   - Today index source pin: the variant picker is suppressed
 *     (`hidePicker` set on TodayHero), the QuickLogStrip is no
 *     longer rendered, and the LogFab is wired into the
 *     composition root.
 */

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";
import { Alert } from "react-native";
import * as fs from "node:fs";
import * as path from "node:path";

import { StreakPip } from "../../components/today/StreakPip";
import { LogFab } from "../../components/today/LogFab";

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
  selectionAsync: vi.fn(async () => undefined),
}));
vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    background: "#fff",
    card: "#fff",
    cardBorder: "#eee",
  }),
}));

describe("StreakPip", () => {
  it("renders 'Start your streak' label at zero days", () => {
    const { getByText } = render(<StreakPip days={0} />);
    expect(getByText("Start your streak")).toBeTruthy();
  });

  it("renders '1 day' (singular) at one day", () => {
    const { getByText } = render(<StreakPip days={1} />);
    expect(getByText("1 day")).toBeTruthy();
  });

  it("renders 'N days' (plural) at two or more days", () => {
    const { getByText: get5 } = render(<StreakPip days={5} />);
    expect(get5("5 days")).toBeTruthy();

    const { getByText: get42 } = render(<StreakPip days={42} />);
    expect(get42("42 days")).toBeTruthy();
  });

  it("clamps non-finite or negative inputs to 0 (defensive)", () => {
    const { getByText } = render(<StreakPip days={Number.NaN} />);
    expect(getByText("Start your streak")).toBeTruthy();

    const { getByText: getNeg } = render(<StreakPip days={-3} />);
    expect(getNeg("Start your streak")).toBeTruthy();
  });

  it("exposes a stable accessibility label", () => {
    const { getByLabelText } = render(<StreakPip days={7} />);
    expect(getByLabelText("7-day logging streak")).toBeTruthy();
  });
});

describe("LogFab", () => {
  it("renders by default with the canonical accessibility label", () => {
    const { getByLabelText } = render(<LogFab />);
    expect(getByLabelText("Log a meal")).toBeTruthy();
  });

  it("returns null when visible=false", () => {
    const { queryByLabelText } = render(<LogFab visible={false} />);
    expect(queryByLabelText("Log a meal")).toBeNull();
  });

  it("calls the supplied onPress instead of surfacing the placeholder alert", () => {
    const onPress = vi.fn();
    const alertSpy = vi.spyOn(Alert, "alert").mockImplementation(() => {});
    const { getByLabelText } = render(<LogFab onPress={onPress} />);
    fireEvent.press(getByLabelText("Log a meal"));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(alertSpy).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("falls back to the 'Coming in Phase 3' alert when no onPress is provided", () => {
    const alertSpy = vi.spyOn(Alert, "alert").mockImplementation(() => {});
    const { getByLabelText } = render(<LogFab />);
    fireEvent.press(getByLabelText("Log a meal"));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(alertSpy.mock.calls[0]?.[0]).toBe("Coming in Phase 3");
    alertSpy.mockRestore();
  });

  it("respects custom bottom / right placement props", () => {
    // The placement is applied as inline styles on the wrapping
    // absolute-positioned View. Walk up the parent chain to find a
    // node whose style carries `position: 'absolute'` (the LogFab
    // wrapper) and assert the bottom / right values match.
    const { getByLabelText } = render(<LogFab bottom={140} right={24} />);
    const button = getByLabelText("Log a meal");
    let node: { parent: typeof button | null; props: { style?: unknown } } | null = button.parent;
    let positionStyle: Record<string, unknown> | null = null;
    let safety = 8;
    while (node && safety-- > 0) {
      const s = node.props.style;
      const flat = Array.isArray(s) ? Object.assign({}, ...s.filter(Boolean)) : (s ?? {});
      if ((flat as Record<string, unknown>).position === "absolute") {
        positionStyle = flat as Record<string, unknown>;
        break;
      }
      // node.parent is typed loosely; cast to keep walking.
      node = (node.parent as unknown) as typeof node;
    }
    expect(positionStyle).not.toBeNull();
    expect(positionStyle?.bottom).toBe(140);
    expect(positionStyle?.right).toBe(24);
  });
});

describe("(tabs)/index.tsx — canonical Today composition root pin", () => {
  const indexSrc = fs.readFileSync(
    path.resolve(__dirname, "../../app/(tabs)/index.tsx"),
    "utf-8",
  );

  it("imports the new <StreakPip> primitive", () => {
    expect(indexSrc).toContain("import { StreakPip }");
  });

  it("imports the new <LogFab> primitive", () => {
    expect(indexSrc).toContain("import { LogFab }");
  });

  it("renders the <StreakPip> on day-view (with streakDays passed in)", () => {
    expect(indexSrc).toMatch(/<StreakPip\s+days=\{streakDays\}/);
  });

  it("passes hidePicker to <TodayHero> so the variant picker is suppressed", () => {
    // The exact JSX may shift; pin "hidePicker" appearing as a prop on
    // TodayHero rather than the precise indentation.
    expect(indexSrc).toMatch(/<TodayHero[\s\S]+?hidePicker[\s\S]+?\/>/);
  });

  it("locks the heroVariant to 'ring' (no AsyncStorage hydration of bar/number)", () => {
    expect(indexSrc).toContain('const heroVariant: TodayHeroVariant = "ring"');
    // The legacy AsyncStorage.getItem(HERO_VARIANT_STORAGE_KEY) call
    // must be gone — its replacement is a no-op setHeroVariant.
    expect(indexSrc).not.toContain('AsyncStorage.getItem(HERO_VARIANT_STORAGE_KEY)');
  });

  it("no longer renders <TodayQuickLogStrip> in the composition root", () => {
    // The component file is still imported (the import remains for
    // backwards-compat with any deep test references), but no JSX
    // call site renders it.
    expect(indexSrc).not.toMatch(/<TodayQuickLogStrip[\s\S]+?\/>/);
  });

  it("renders the canonical <LogFab> wired to open the canonical LogSheet (was TodayFabSheet pre-Phase-3)", () => {
    expect(indexSrc).toMatch(/<LogFab[\s\S]+?onPress=\{\(\)\s*=>\s*setFabSheetOpen\(true\)\}/);
  });

  it("Phase 3: replaces TodayFabSheet with the canonical <LogSheet>", () => {
    // Phase 3 / B2.1: TodayFabSheet's import + render is gone; the
    // FAB now opens the unified <LogSheet>. The fabSheetOpen state
    // variable is retained as the LogSheet's open flag (parallels
    // the web Phase 3 wiring in NutritionTracker.tsx).
    expect(indexSrc).not.toContain('import { TodayFabSheet }');
    expect(indexSrc).toContain("import { LogSheet }");
    expect(indexSrc).toMatch(/<LogSheet[\s\S]+?visible=\{fabSheetOpen\}/);
  });
});
