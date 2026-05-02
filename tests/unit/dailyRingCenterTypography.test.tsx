/**
 * DailyRing centre-value typography — 2026-05-01 ui-critic finding #7.
 *
 * Web mirror of `apps/mobile/tests/unit/calorieRingCenterTypography.test.tsx`.
 *
 * The Today-screen ring's central calorie number was previously 22px
 * (expanded) / 36px (collapsed via `--text-display`) — almost the
 * same weight as the macro tile values (~22px) sitting below the
 * ring. ui-critic flagged that the central number should dominate
 * its real estate per the Cal AI flagship convention; the brief
 * specifies 56px (mobile `Type.ringValueLg`) as the default with a
 * 48px fallback for 4-digit goals (e.g. 1,847 kcal) so they don't
 * clip the inner-most macro-ring band.
 *
 * Tests pinned here:
 *   - 3-digit centre value renders at 56px.
 *   - 4-digit centre value renders at the 48px fallback (still much
 *     larger than the ~22px macro tiles → no parity confusion).
 *   - The tabular-nums variant is preserved so animated counting
 *     doesn't jitter horizontally.
 *   - The rendered text is never truncated (no ellipsis / overflow
 *     character in the DOM output) for either width.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { DailyRing } from "../../src/app/components/suppr/daily-ring";

void React;

describe("DailyRing — centre-value typography (ui-critic #7)", () => {
  it("renders a 3-digit centre value at 56px", () => {
    const { container } = render(
      <DailyRing consumed={420} target={2000} expanded displayMode="consumed" />,
    );
    const span = container.querySelector("span.tabular-nums") as HTMLElement | null;
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe("420");
    expect(span!.style.fontSize).toBe("56px");
    // Explicit ≥48px proxy for "much bigger than the ~22px macro tile values".
    expect(parseInt(span!.style.fontSize, 10)).toBeGreaterThanOrEqual(48);
    // tabular-nums utility class is preserved (animated count-up shouldn't
    // jitter horizontally as the digit width changes).
    expect(span!.className).toContain("tabular-nums");
  });

  it("falls back to 48px for 4-digit centre values to avoid clipping", () => {
    const { container } = render(
      <DailyRing consumed={1847} target={2400} expanded displayMode="consumed" />,
    );
    const span = container.querySelector("span.tabular-nums") as HTMLElement | null;
    expect(span).not.toBeNull();
    expect(span!.textContent).toBe("1847");
    expect(span!.style.fontSize).toBe("48px");
    // Still above the ≥48px floor — the lift requirement is "ring value
    // dominates the macro tiles", not "ring value is exactly 56px".
    expect(parseInt(span!.style.fontSize, 10)).toBeGreaterThanOrEqual(48);
    // No truncation in the rendered output.
    const html = container.innerHTML;
    expect(html).not.toContain("…");
    expect(span!.textContent).not.toMatch(/\.\.\./);
  });

  it("collapsed ring (no inner macro rings) still uses 56px", () => {
    const { container } = render(
      <DailyRing consumed={420} target={2000} expanded={false} displayMode="consumed" />,
    );
    const span = container.querySelector("span.tabular-nums") as HTMLElement | null;
    expect(span).not.toBeNull();
    expect(span!.style.fontSize).toBe("56px");
    expect(parseInt(span!.style.fontSize, 10)).toBeGreaterThanOrEqual(48);
  });

  it("preserves the 'Start your day' empty-state copy (not a giant 0)", () => {
    const { getByText } = render(
      <DailyRing consumed={0} target={2000} expanded displayMode="consumed" />,
    );
    expect(getByText("Start your day")).toBeTruthy();
  });

  it("over-budget colour applies to the lifted centre value", () => {
    const { container } = render(
      <DailyRing consumed={2200} target={2000} expanded displayMode="consumed" />,
    );
    const span = container.querySelector("span.tabular-nums") as HTMLElement | null;
    expect(span).not.toBeNull();
    // 4-digit fallback still kicks in for over-budget displays.
    expect(span!.style.fontSize).toBe("48px");
    // Over-budget colour is wired through inline `color` (var(--warning)).
    expect(span!.style.color).toBe("var(--warning)");
  });
});
