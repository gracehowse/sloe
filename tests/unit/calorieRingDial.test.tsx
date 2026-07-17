// @vitest-environment jsdom
/**
 * CalorieRingDial — Sloe v3 jewel watch-dial ring.
 *
 * Pins the per-state segment behaviour, and guards the dropped-`transform`
 * regression (the lit segments must be DISTRIBUTED around the dial, not stacked
 * at rotate(0)) caught during the first sim verification.
 *
 * matchMedia is mocked to prefers-reduced-motion so the mount-grow resolves
 * synchronously (grow → 1) and `drawn` equals progress without driving rAF.
 */
import * as React from "react";
import { fireEvent, render } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { CalorieRingDial } from "../../src/app/components/suppr/calorie-ring-dial";
import { TodayHeroRing } from "../../src/app/components/suppr/today-hero-ring";

void React;

beforeAll(() => {
  // @ts-expect-error — jsdom matchMedia shim (reduced motion → grow resolves sync).
  window.matchMedia = (query: string) => ({
    matches: true,
    media: query,
    onchange: null,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent() {
      return false;
    },
  });
});

/** Transforms of the gradient-filled (lit) ticks currently at full opacity. */
function litTransforms(container: HTMLElement): string[] {
  return [...container.querySelectorAll("rect")]
    .filter(
      (r) =>
        (r.getAttribute("fill") ?? "").includes("url(") &&
        Number(r.style.opacity) > 0.9,
    )
    .map((r) => r.getAttribute("transform") ?? "");
}

describe("CalorieRingDial — jewel watch dial", () => {
  it("under budget lights ~60% of the dial across DISTINCT tick angles", () => {
    const { container } = render(
      <CalorieRingDial consumed={1200} target={2000} />,
    );
    const transforms = litTransforms(container);
    // ~29 of 48 segments at 60% progress.
    expect(transforms.length).toBeGreaterThan(20);
    expect(transforms.length).toBeLessThan(40);
    // Regression guard (dropped-transform bug, 2026-06-21): lit segments must be
    // distributed around the dial, never all stacked at rotate(0).
    expect(new Set(transforms).size).toBeGreaterThan(20);
    expect(transforms.every((t) => t === transforms[0])).toBe(false);
  });

  it("empty day lights only the leading mark", () => {
    const { container } = render(
      <CalorieRingDial consumed={0} target={2000} />,
    );
    expect(litTransforms(container).length).toBeLessThanOrEqual(2);
  });

  it("over budget fills the whole dial with the amber over gradient (ENG-1296)", () => {
    const { container } = render(
      <CalorieRingDial consumed={2300} target={2000} />,
    );
    expect(litTransforms(container).length).toBe(48);
    // Gradient id is instance-namespaced (`useId()`, ENG-1225) so two dials can
    // coexist (mobile-web + desktop) without colliding defs — match by state prefix.
    expect(container.querySelector('[id^="cr-dial-over"]')).not.toBeNull();
  });

  it("under budget uses the sage gradient; empty uses the frost gradient", () => {
    const { container: under } = render(
      <CalorieRingDial consumed={1200} target={2000} />,
    );
    expect(under.querySelector('[id^="cr-dial-under"]')).not.toBeNull();
    const { container: empty } = render(
      <CalorieRingDial consumed={0} target={2000} />,
    );
    expect(empty.querySelector('[id^="cr-dial-empty"]')).not.toBeNull();
  });
});

// ENG-1571 (ruling 2026-07-17) — flat dial material, ALL states, both themes:
// the core/rim radial-bloom circles stay REMOVED. The bloom was already
// dropped unconditionally on 2026-06-22 (commit 03946c62, Grace's call), so
// there is no bloom code path left to flag-gate — `dial_flat_material_v1`
// was intentionally NOT registered (a flag gating nothing would dead-letter
// the rollout; not a gap). These pins convert the ruling into a gate so the
// ENG-1247 prototype-conformance pass can't re-teach the bloom back in from
// `Sloe-App.html`. Kept jewel identity: the 48 graduation ticks, the
// per-state tick gradient def, and the lead-segment gem cap
// (`--ring-cap-core`; absent at a full dial, where there is no leading edge).
describe("CalorieRingDial — flat material, no radial bloom (ENG-1571)", () => {
  function expectFlat(consumed: number, target: number, gemCaps: number) {
    const { container } = render(
      <CalorieRingDial consumed={consumed} target={target} />,
    );
    // No bloom: zero radial-gradient defs, zero circle geometry — the dial
    // is rects-only in every state.
    expect(container.getElementsByTagName("radialGradient").length).toBe(0);
    expect(container.getElementsByTagName("circle").length).toBe(0);
    const rects = [...container.querySelectorAll("rect")];
    // Kept: all 48 frost graduation ticks…
    expect(
      rects.filter((r) => r.getAttribute("fill") === "var(--ring-tick)")
        .length,
    ).toBe(48);
    // …the per-state tick gradient def…
    expect(container.querySelector('linearGradient[id^="cr-dial-"]')).not.toBeNull();
    // …and the lead-segment gem cap where a leading edge exists.
    expect(
      rects.filter((r) => r.getAttribute("fill") === "var(--ring-cap-core)")
        .length,
    ).toBe(gemCaps);
  }

  it("empty state is flat: no bloom nodes, ticks + gem cap intact", () => {
    expectFlat(0, 2000, 1);
  });

  it("under-budget state is flat: no bloom nodes, ticks + gem cap intact", () => {
    expectFlat(1200, 2000, 1);
  });

  it("over-budget state is flat: no amber halo around 'kcal over' (trust posture)", () => {
    expectFlat(2300, 2000, 0);
  });
});

// ENG-1465 — the v3 dial swap dropped the legacy `DailyRing` interaction
// contract (click/keyboard macro toggle + the win/commit pulses). These pin
// the restored wiring: dial contract + hero host end-to-end.
describe("CalorieRingDial — click-to-toggle + pulses (ENG-1465)", () => {
  it("click and keyboard (Enter) fire onToggle; wired dial is role=button", () => {
    const onToggle = vi.fn();
    const { getByTestId } = render(
      <CalorieRingDial consumed={1200} target={2000} onToggle={onToggle} />,
    );
    const dial = getByTestId("calorie-ring-dial");
    expect(dial.getAttribute("role")).toBe("button");
    fireEvent.click(dial);
    fireEvent.keyDown(dial, { key: "Enter" });
    expect(onToggle).toHaveBeenCalledTimes(2);
  });

  it("Space fires onToggle AND calls preventDefault (no page scroll)", () => {
    const onToggle = vi.fn();
    const { getByTestId } = render(
      <CalorieRingDial consumed={1200} target={2000} onToggle={onToggle} />,
    );
    const dial = getByTestId("calorie-ring-dial");
    // fireEvent returns false when the handler called preventDefault —
    // Space must be consumed so it can't also scroll the page.
    const notPrevented = fireEvent.keyDown(dial, { key: " " });
    expect(notPrevented).toBe(false);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("stays inert (no role/tabindex) when no handler is wired", () => {
    const { getByTestId } = render(
      <CalorieRingDial consumed={1200} target={2000} />,
    );
    const dial = getByTestId("calorie-ring-dial");
    expect(dial.getAttribute("role")).toBeNull();
    expect(dial.getAttribute("tabindex")).toBeNull();
  });

  it("commitPulse marks the wrapper and applies the brief scale-up (ENG-1016 parity)", () => {
    const { getByTestId } = render(
      <CalorieRingDial consumed={1200} target={2000} commitPulse />,
    );
    const dial = getByTestId("calorie-ring-dial");
    expect(dial.getAttribute("data-commit-pulse")).toBe("true");
    expect(dial.className).toContain("scale-[1.03]");
  });

  it("the Today hero wires the dial click to the macro-expanded toggle", () => {
    const onToggleExpanded = vi.fn();
    const { getByTestId } = render(
      <TodayHeroRing
        consumed={1200}
        target={2000}
        proteinPct={0.5}
        carbsPct={0.5}
        fatPct={0.5}
        expanded={false}
        onToggleExpanded={onToggleExpanded}
      />,
    );
    fireEvent.click(getByTestId("calorie-ring-dial"));
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
  });
});
