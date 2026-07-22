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
 *     onPress override. Component still ships (preserved for parity
 *     with web's LogFab and Maestro continuity) but is no longer
 *     rendered in Today's composition root — see the `?openLog=1`
 *     pin below.
 *   - Today index source pin: the variant picker is suppressed
 *     (`hidePicker` set on TodayHero), the QuickLogStrip is no
 *     longer rendered, and the canonical LogSheet is opened either
 *     by meal-slot taps or by the global `<SupprTabBar>` raised
 *     button (which routes to `/(tabs)?openLog=1`).
 */

import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";
import * as fs from "node:fs";
import * as path from "node:path";

import { StreakPip } from "../../components/today/StreakPip";
import { LogFab } from "../../components/today/LogFab";

const noop = () => {};

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
  it("renders 'Start streak' label at zero days", () => {
    const { getByText } = render(<StreakPip days={0} />);
    expect(getByText("Start streak")).toBeTruthy();
  });

  it("renders '1-day streak' at one day", () => {
    const { getByText } = render(<StreakPip days={1} />);
    expect(getByText("1-day streak")).toBeTruthy();
  });

  it("renders 'N-day streak' at two or more days", () => {
    const { getByText: get5 } = render(<StreakPip days={5} />);
    expect(get5("5-day streak")).toBeTruthy();

    const { getByText: get42 } = render(<StreakPip days={42} />);
    expect(get42("42-day streak")).toBeTruthy();
  });

  it("clamps non-finite or negative inputs to 0 (defensive)", () => {
    const { getByText } = render(<StreakPip days={Number.NaN} />);
    expect(getByText("Start streak")).toBeTruthy();

    const { getByText: getNeg } = render(<StreakPip days={-3} />);
    expect(getNeg("Start streak")).toBeTruthy();
  });

  it("exposes a stable accessibility label", () => {
    const { getByLabelText } = render(<StreakPip days={7} />);
    expect(getByLabelText("7-day logging streak")).toBeTruthy();
  });
});

describe("LogFab", () => {
  it("renders by default with the canonical accessibility label", () => {
    const { getByLabelText } = render(<LogFab onPress={noop} />);
    expect(getByLabelText("Log a meal")).toBeTruthy();
  });

  it("returns null when visible=false", () => {
    const { queryByLabelText } = render(<LogFab visible={false} onPress={noop} />);
    expect(queryByLabelText("Log a meal")).toBeNull();
  });

  it("calls the supplied onPress on press (Phase 3 placeholder alert was removed 2026-04-28)", () => {
    const onPress = vi.fn();
    const { getByLabelText } = render(<LogFab onPress={onPress} />);
    fireEvent.press(getByLabelText("Log a meal"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("respects custom bottom / right placement props", () => {
    // The placement is applied as inline styles on the wrapping
    // absolute-positioned View. Walk up the parent chain to find a
    // node whose style carries `position: 'absolute'` (the LogFab
    // wrapper) and assert the bottom / right values match.
    const { getByLabelText } = render(<LogFab onPress={noop} bottom={140} right={24} />);
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
    path.resolve(__dirname, "../../app/(tabs)/_today/TodayScreen.tsx"),
    "utf-8",
  );

  it("StreakPip is rendered through <TodayDateHeader> (inline, premium-bar DC8 polish 2026-05-14)", () => {
    // 2026-05-14 (premium-bar audit DC8 polish): the streak pip is no
    // longer rendered as a standalone block in the Today host — it now
    // lives inline next to the "Today" pill, owned by
    // `<TodayDateHeader>`. The host passes `streakDays`,
    // `freezeProtected`, `onStreakPress`, and `streakResetCopyVisible`
    // props through; the header decides when to mount the pip.
    expect(indexSrc).not.toContain("import { StreakPip }");
    expect(indexSrc).toMatch(/streakDays=\{protectedStreakLength\}/);
    expect(indexSrc).toMatch(/onStreakPress=\{/);
    expect(indexSrc).toMatch(/streakResetCopyVisible=\{/);
  });

  it("no longer imports the side <LogFab> (retired 2026-04-30 — the centered raised Log button lives in <SupprTabBar>)", () => {
    // The LogFab.tsx component file still ships (deferred deletion;
    // see header comment). The pin here is that Today's composition
    // root no longer pulls it in — proving the side-FAB render path
    // is gone. The new entry-point pin below replaces it.
    expect(indexSrc).not.toMatch(/^import\s*\{\s*LogFab\s*\}/m);
  });

  it("Today still routes the freeze-protected streak to the pip (audit S01, 2026-05-05 — DC8 polish 2026-05-14)", () => {
    // S01 fix: Today now consumes the freeze-protected streak so the
    // pip matches Settings + weekly-recap + push-body, all of which
    // already used the protected count. Was `streakDays` (raw
    // computeLoggingStreak) until 2026-05-05. DC8 polish 2026-05-14
    // moved the pip into <TodayDateHeader>; the value still flows via
    // the `streakDays={protectedStreakLength}` prop.
    expect(indexSrc).toMatch(/streakDays=\{protectedStreakLength\}/);
    expect(indexSrc).not.toMatch(/streakDays=\{streakDays\}/);
  });

  it("TodaySnapShortcut removed from main scroll — empty day uses TodayFirstMealEmptyState (2026-05-23)", () => {
    expect(indexSrc).not.toMatch(/<TodaySnapShortcut/);
    expect(indexSrc).toMatch(/<TodayFirstMealEmptyState/);
    expect(indexSrc).toMatch(/mealsToday\.length\s*===\s*0/);
  });

  it("Phase 3 (2026-04-28): the variant picker has been removed entirely (no variant / hidePicker / onVariantChange props)", () => {
    // Phase 2 set `hidePicker={true}` and pinned `heroVariant: "ring"`
    // as a hedge while the bar / number variant components were still
    // in the tree. Phase 3 (D-2026-04-27-03 finished) deletes the
    // variant components and turns TodayHero into a thin wrapper
    // around TodayHeroRing. After this change, the variant prop, the
    // hidePicker prop, and the heroVariant local variable should ALL
    // be absent from the composition root.
    // Scope the prop check to the `<TodayHero …/>` opening tag itself
    // (bounded at its self-closing `/>`). The old unbounded
    // `/<TodayHero[\s\S]+?variant=\{/` cross-scanned the ENTIRE composition
    // root, so any later, unrelated `variant=` token — e.g. the ENG-786
    // "Copy to another day" success `<Toast variant={…}/>` — false-matched
    // and failed this assertion even though TodayHero has no variant prop.
    const todayHeroOpenTag = indexSrc.match(/<TodayHero\b[\s\S]*?\/>/)?.[0] ?? "";
    expect(todayHeroOpenTag).not.toMatch(/variant=\{/);
    expect(todayHeroOpenTag).not.toMatch(/hidePicker/);
    expect(todayHeroOpenTag).not.toMatch(/onVariantChange/);
    expect(indexSrc).not.toMatch(/heroVariant: TodayHeroVariant/);
    expect(indexSrc).not.toContain('AsyncStorage.getItem(HERO_VARIANT_STORAGE_KEY)');
    // The hero is still rendered — since ENG-1653 the composition root
    // mounts it via the extracted <TodayHeroBlock> (which renders
    // <TodayHero> internally; see todayAboveMealsCap pins). Pin the open
    // tag so a refactor that removes the hero entirely fails loudly.
    expect(indexSrc).toMatch(/<TodayHeroBlock[\s\n]+entranceStyle=/);
  });

  it("no longer renders <TodayQuickLogStrip> in the composition root", () => {
    // The component file is still imported (the import remains for
    // backwards-compat with any deep test references), but no JSX
    // call site renders it.
    expect(indexSrc).not.toMatch(/<TodayQuickLogStrip[\s\S]+?\/>/);
  });

  it("opens the canonical LogSheet via the `?openLog=1` deep-link from <SupprTabBar> (replaces the side <LogFab> render, 2026-04-30)", () => {
    // The `params.openLog === "1"` consumer moved into the extracted
    // `useLogSheetDeepLinks` hook (launch-audit 2026-06-12, P2 #5 —
    // behavioural coverage lives in useLogSheetDeepLinks.test.ts). Pin
    // BOTH halves of the wiring: index.tsx mounts the hook with
    // `setFabSheetOpen`, and the hook itself still consumes the param —
    // so removing either side fails CI before the centered raised Log
    // button stops working.
    expect(indexSrc).toMatch(/useLogSheetDeepLinks\(\{[\s\S]+?setFabSheetOpen/);
    const hookSrc = fs.readFileSync(
      path.resolve(__dirname, "../../hooks/useLogSheetDeepLinks.ts"),
      "utf8",
    );
    expect(hookSrc).toMatch(/openLog\s*===\s*"1"/);
    expect(hookSrc).toMatch(/setFabSheetOpen\(true\)/);
    // Side FAB JSX render is gone (the comment-block reference to
    // `<LogFab>` in backticks must not match this — we only want to
    // catch a real JSX open tag, identified by the JSX-attribute
    // syntax that immediately follows the tag name with whitespace).
    expect(indexSrc).not.toMatch(/<LogFab\s+visible=/);
    expect(indexSrc).not.toMatch(/<LogFab\s+onPress=/);
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

  it("SLOE redesign (2026-06-03): Today opens with a Sloe wordmark + avatar header, and the date header is stripOnly", () => {
    // Grace decision: the "< Today >" date-nav row is replaced by a
    // "Sloe" wordmark (left) + GradientAvatar (right) header above the
    // greeting; the week strip (rendered via <TodayDateHeader
    // stripOnly>) owns day-selection. Pin both halves so a future
    // sweep can't silently revert to the chevron date-nav header.
    // The header row (wordmark + notifications bell + avatar) was extracted to
    // <TodayHeaderBar> (ENG-1247 — added the bell + closed the web parity gap);
    // the host renders it, and the header details live there now.
    expect(indexSrc).toMatch(/<TodayHeaderBar\s/);
    const headerSrc = fs.readFileSync(
      path.resolve(__dirname, "../../components/today/TodayHeaderBar.tsx"),
      "utf-8",
    );
    expect(headerSrc).toContain(
      'import { GradientAvatar } from "@/components/GradientAvatar"',
    );
    expect(headerSrc).toMatch(/testID="today-wordmark"/);
    expect(headerSrc).toContain("SloeHeaderWordmark");
    expect(headerSrc).toMatch(/gradientIdSuffix="today-wordmark-header"/);
    // The date header is now stripOnly (week strip only).
    expect(indexSrc).toMatch(/<TodayDateHeader\s+stripOnly/);
  });
});
