/**
 * northStarBlockPhase3 — pins the Phase 3 (B2.2, 2026-04-27) mobile
 * `<NorthStarBlock>` primitive. Mirrors `tests/unit/northStarBlockPhase3.test.tsx`.
 */

import * as React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

let figmaMealsLayout = true;
// ENG-1454 — mutable per-test override so the staged-coaching tests can
// flip `coaching_stages_v1` ON without affecting the other flag-off tests
// in this file (which must keep rendering the exact legacy caption).
let coachingStagesOn = false;

vi.mock("@/lib/analytics", () => ({
  isFeatureEnabled: (flag: string) => {
    if (flag === "today_meals_figma_654") return figmaMealsLayout;
    if (flag === "coaching_stages_v1") return coachingStagesOn;
    return false;
  },
  track: vi.fn(),
}));

import {
  NorthStarBlock,
  type NorthStarBlockSuggestion,
} from "../../components/today/NorthStarBlock";

vi.mock("expo-haptics", () => ({
  impactAsync: vi.fn(async () => undefined),
  ImpactFeedbackStyle: { Medium: "medium", Light: "light" },
  selectionAsync: vi.fn(async () => undefined),
  notificationAsync: vi.fn(async () => undefined),
  NotificationFeedbackType: { Success: "success" },
}));

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    card: "#fff",
    cardBorder: "#eee",
    border: "#eee",
    inputBg: "#f4f4f4",
    sourceUsda: "#5E7C5A",
    sourceOff: "#4A7878",
    sourceFatsecret: "#C9892C",
    sourceManual: "#94a3b8",
    sourceAi: "#6A4B7A",
    northStarBgFrom: "rgba(88,140,228,0.08)",
    northStarBgTo: "rgba(223,94,188,0.04)",
    northStarBorder: "rgba(88,140,228,0.18)",
    overBudgetFg: "#C0533F",
    overBudgetSoft: "rgba(247,138,50,0.08)",
  }),
}));

vi.mock("@/hooks/use-reduce-motion", () => ({
  useReduceMotion: () => false,
}));

const baseSuggestion: NorthStarBlockSuggestion = {
  recipeId: "rec-1",
  title: "Tofu poke bowl",
  predictedCalories: 520,
  predictedProtein: 38,
  predictedCarbs: 42,
  predictedFat: 18,
  bandLabel: "Hits within 3%",
  bandTight: true,
};

describe("NorthStarBlock (mobile) — Figma 654 hero", () => {
  beforeEach(() => {
    figmaMealsLayout = true;
  });

  it("renders section title, hero card, slot eyebrow, and kcal", () => {
    const { getByText, getByTestId } = render(
      <NorthStarBlock
        kind="default"
        suggestion={baseSuggestion}
        slotEyebrow="Dinner suggestion"
      />,
    );
    expect(getByText("What to eat next")).toBeTruthy();
    expect(getByText("Tofu poke bowl")).toBeTruthy();
    expect(getByText("Dinner suggestion")).toBeTruthy();
    expect(getByText("Fits your day")).toBeTruthy();
    expect(getByText(/520 kcal/)).toBeTruthy();
    expect(getByTestId("north-star-figma-hero")).toBeTruthy();
  });
});

describe("NorthStarBlock (mobile) — compact default kind", () => {
  beforeEach(() => {
    figmaMealsLayout = false;
  });

  it("renders the eyebrow, title, band chip and macro caption", () => {
    const { getByText } = render(
      <NorthStarBlock kind="default" suggestion={baseSuggestion} ctaLabel="Log it" />,
    );
    expect(getByText("What to eat next")).toBeTruthy();
    expect(getByText("Tofu poke bowl")).toBeTruthy();
    expect(getByText("Hits within 3%")).toBeTruthy();
    expect(getByText(/520 kcal · 38g P · 42g C · 18g F/)).toBeTruthy();
  });

  it("primary CTA fires onPrimaryCta on press", () => {
    const onPrimaryCta = vi.fn();
    const { getByLabelText } = render(
      <NorthStarBlock
        kind="default"
        suggestion={baseSuggestion}
        ctaLabel="Cook it →"
        onPrimaryCta={onPrimaryCta}
      />,
    );
    fireEvent.press(getByLabelText("Cook it →"));
    expect(onPrimaryCta).toHaveBeenCalled();
  });

  it("default kind without suggestion renders nothing", () => {
    const { toJSON } = render(<NorthStarBlock kind="default" />);
    expect(toJSON()).toBeNull();
  });
});

describe("NorthStarBlock (mobile) — non-default kinds", () => {
  beforeEach(() => {
    coachingStagesOn = false;
  });

  it("library-empty: renders invitation copy + tappable row", () => {
    const onOpenLibrary = vi.fn();
    const { getByText, getByLabelText } = render(
      <NorthStarBlock kind="library-empty" onOpenLibrary={onOpenLibrary} />,
    );
    expect(getByText(/Pick a few recipes — we'll suggest from there\./)).toBeTruthy();
    fireEvent.press(getByLabelText("Pick recipes for your library"));
    expect(onOpenLibrary).toHaveBeenCalled();
  });

  it("over-budget: renders calm caption", () => {
    const { getByText } = render(<NorthStarBlock kind="over-budget" />);
    expect(
      getByText(
        /You've hit your calories for today — eat freely, or save for tomorrow\./,
      ),
    ).toBeTruthy();
  });

  it("over-budget (ENG-935 permanent block): caption replaces the suggestion card — no CTA, no header", () => {
    // ENG-935 (2026-06-17): "What to eat next" is now a permanent
    // glanceable Today block. When over-budget the block does NOT
    // disappear (the pre-ENG-935 screen gate `remaining > 0` used to
    // hide it) — instead the host renders this `over-budget` kind so
    // the user always sees something where the suggestion lives. This
    // pins that the over-budget render is the calm caption ONLY: no
    // "What to eat next" header, no suggestion title, no CTA. It uses
    // the dedicated over-budget testID so the host's branch is
    // unambiguous.
    const { getByTestId, queryByText } = render(
      <NorthStarBlock kind="over-budget" />,
    );
    expect(getByTestId("north-star-over-budget")).toBeTruthy();
    // The suggestion chrome must not leak into the over-budget state.
    expect(queryByText("What to eat next")).toBeNull();
    expect(queryByText("Tofu poke bowl")).toBeNull();
    expect(queryByText("Log it")).toBeNull();
  });

  describe("ENG-1454 — staged over-budget coaching (behind coaching_stages_v1)", () => {
    it("flag ON + stage/calories supplied: renders the staged line, not the legacy caption", () => {
      coachingStagesOn = true;
      const { getByText, queryByText } = render(
        <NorthStarBlock
          kind="over-budget"
          overBudgetStage="big"
          overBudgetCalories={{ consumed: 3450, goal: 2000 }}
        />,
      );
      expect(
        getByText(/A big day\. It happens — log it honestly and move on\. Tomorrow's a clean slate\./),
      ).toBeTruthy();
      expect(
        queryByText(/You've hit your calories for today — eat freely, or save for tomorrow\./),
      ).toBeNull();
    });

    it("flag ON but no stage/calories supplied: falls through to the legacy caption (kill switch)", () => {
      coachingStagesOn = true;
      const { getByText } = render(<NorthStarBlock kind="over-budget" />);
      expect(
        getByText(/You've hit your calories for today — eat freely, or save for tomorrow\./),
      ).toBeTruthy();
    });

    it("flag OFF even with stage/calories supplied: still the legacy caption (kill switch)", () => {
      coachingStagesOn = false;
      const { getByText, queryByText } = render(
        <NorthStarBlock
          kind="over-budget"
          overBudgetStage="over"
          overBudgetCalories={{ consumed: 2500, goal: 2000 }}
        />,
      );
      expect(
        getByText(/You've hit your calories for today — eat freely, or save for tomorrow\./),
      ).toBeTruthy();
      expect(queryByText(/Over by 500 today/)).toBeNull();
    });

    it("renders each stage's exact staged string", () => {
      coachingStagesOn = true;
      const cases: Array<
        [import("../../components/today/NorthStarBlock").NorthStarBlockProps["overBudgetStage"], number, number, RegExp]
      > = [
        ["approaching", 1850, 2000, /About 150 kcal left — a light dinner fits\./],
        [
          "landed",
          2000,
          2000,
          /You've hit today's calories\. One day at the line is exactly how this is meant to work\./,
        ],
        ["over", 2450, 2000, /Over by 450 today\. Nothing to fix tonight — tomorrow starts fresh\./],
        [
          "big",
          3450,
          2000,
          /A big day\. It happens — log it honestly and move on\. Tomorrow's a clean slate\./,
        ],
      ];
      for (const [stage, consumed, goal, expected] of cases) {
        const { getByText, unmount } = render(
          <NorthStarBlock
            kind="over-budget"
            overBudgetStage={stage}
            overBudgetCalories={{ consumed, goal }}
          />,
        );
        expect(getByText(expected)).toBeTruthy();
        unmount();
      }
    });
  });

  describe("ENG-1454 — under-eating kind (behind coaching_stages_v1)", () => {
    it("renders the ED-safe single-day line when supplied", () => {
      const { getByText, getByTestId } = render(
        <NorthStarBlock
          kind="under-eating"
          underEatingLine="Well under target so far. If that wasn't the plan, a proper dinner still fits tonight."
        />,
      );
      expect(getByTestId("north-star-under-eating")).toBeTruthy();
      expect(
        getByText(/Well under target so far\. If that wasn't the plan, a proper dinner still fits tonight\./),
      ).toBeTruthy();
    });

    it("renders nothing when no line is supplied (no legacy predecessor to fall back to)", () => {
      const { toJSON } = render(<NorthStarBlock kind="under-eating" />);
      expect(toJSON()).toBeNull();
    });
  });

  it("no-fit: renders caption + Browse button", () => {
    const onBrowse = vi.fn();
    const { getByText, getByLabelText } = render(
      <NorthStarBlock kind="no-fit" onBrowse={onBrowse} />,
    );
    expect(
      getByText(/Library has nothing under your remaining macros today\./),
    ).toBeTruthy();
    fireEvent.press(getByLabelText("Browse"));
    expect(onBrowse).toHaveBeenCalled();
  });
});

describe("NorthStarBlock (mobile) — whyLine + macro row do not overlap", () => {
  // Regression guard for the 2026-06-04 "Fits your remaining N kcal"
  // overlap report. A scroll capture of Today appeared to show the
  // whyLine subtitle ("Fits your remaining 740 kcal") sitting ON TOP
  // of the macro caption row. Investigation found the card lays both
  // out as plain flex-column siblings (no absolute positioning, no
  // height clamp) — i.e. the capture was a mid-scroll motion-blur
  // artifact, not a real layout bug. These tests pin the structural
  // guarantee that PREVENTS an overlap so a future refactor (e.g.
  // absolutely-positioning the whyLine, or clamping the body height)
  // can't silently reintroduce one. The prior `baseSuggestion` never
  // carried a `whyLine`, so this rendering path was untested.
  const suggestionWithWhyLine: NorthStarBlockSuggestion = {
    ...baseSuggestion,
    whyLine: "Fits your remaining 740 kcal",
  };

  type StyleObj = Record<string, unknown>;
  const flat = (s: unknown): StyleObj => {
    if (Array.isArray(s)) {
      return s.reduce<StyleObj>((acc, x) => ({ ...acc, ...flat(x) }), {});
    }
    return (s ?? {}) as StyleObj;
  };

  // Walk from a node up to (and including) the card root, collecting
  // every ancestor's flattened style. `parent` is the RNTL test
  // instance chain.
  type StyleNode = { parent: unknown; props?: { style?: unknown } };
  function ancestorStyles(node: { parent: unknown } | null): StyleObj[] {
    const out: StyleObj[] = [];
    let cur: StyleNode | null = node as StyleNode | null;
    while (cur) {
      if (cur.props?.style != null) out.push(flat(cur.props.style));
      cur = (cur.parent ?? null) as StyleNode | null;
    }
    return out;
  }

  it("renders the whyLine and the macro caption as TWO distinct text nodes", () => {
    const { getByText } = render(
      <NorthStarBlock kind="default" suggestion={suggestionWithWhyLine} />,
    );
    // Two separate matches → the lines are NOT merged into one node and
    // are not the same element painted twice.
    const whyLine = getByText("Fits your remaining 740 kcal");
    const macro = getByText(/520 kcal · 38g P · 42g C · 18g F/);
    expect(whyLine).toBeTruthy();
    expect(macro).toBeTruthy();
    expect(whyLine).not.toBe(macro);
  });

  it("keeps the whyLine and macro row IN FLOW (no absolutely-positioned ancestor)", () => {
    const { getByText } = render(
      <NorthStarBlock kind="default" suggestion={suggestionWithWhyLine} />,
    );
    const whyLine = getByText("Fits your remaining 740 kcal");
    const macro = getByText(/520 kcal · 38g P · 42g C · 18g F/);

    // If either row sat under an absolutely-positioned container it
    // could be lifted out of column flow and stack on top of a sibling
    // — that is exactly the failure the report described. Neither may
    // have `position: "absolute"` anywhere up its ancestor chain. (The
    // only absolute element in the card is the reduce-motion skip
    // button, which these rows are not inside.)
    for (const styles of [ancestorStyles(whyLine), ancestorStyles(macro)]) {
      expect(styles.some((s) => s.position === "absolute")).toBe(false);
    }
  });

  it("does not clamp the body column to a fixed height that could force overlap", () => {
    const { getByText } = render(
      <NorthStarBlock kind="default" suggestion={suggestionWithWhyLine} />,
    );
    // A fixed `height` on the flex-column body (rather than letting it
    // grow to fit all rows) is the other way sibling rows could be
    // forced to overlap. Assert no ancestor of the macro row pins a
    // numeric `height`.
    const macro = getByText(/520 kcal · 38g P · 42g C · 18g F/);
    const heights = ancestorStyles(macro)
      .map((s) => s.height)
      .filter((h) => typeof h === "number");
    expect(heights).toHaveLength(0);
  });

  it("only renders the whyLine once (no duplicate stacked subtitle)", () => {
    const { queryAllByText } = render(
      <NorthStarBlock kind="default" suggestion={suggestionWithWhyLine} />,
    );
    expect(queryAllByText("Fits your remaining 740 kcal")).toHaveLength(1);
  });
});

describe("NorthStarBlock (mobile) — reduce-motion swipe-to-skip fallback", () => {
  it("renders an X button when reduce-motion is on AND onSkip is supplied", async () => {
    vi.resetModules();
    vi.doMock("@/hooks/use-reduce-motion", () => ({
      useReduceMotion: () => true,
    }));

    const { NorthStarBlock: BlockReduced } = await import(
      "../../components/today/NorthStarBlock"
    );
    const onSkip = vi.fn();
    const { getByLabelText } = render(
      <BlockReduced kind="default" suggestion={baseSuggestion} onSkip={onSkip} />,
    );
    fireEvent.press(getByLabelText("Skip this suggestion"));
    expect(onSkip).toHaveBeenCalled();

    vi.doUnmock("@/hooks/use-reduce-motion");
  });
});
