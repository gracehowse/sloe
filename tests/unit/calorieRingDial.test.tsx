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
import { render } from "@testing-library/react";
import { beforeAll, describe, expect, it } from "vitest";
import { CalorieRingDial } from "../../src/app/components/suppr/calorie-ring-dial";

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
