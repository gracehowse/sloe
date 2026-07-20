/**
 * AvatarDisc — the ONE initials-avatar primitive (S5 avatar ruling
 * 2026-07-10, ENG-1375). Identity = solid damson (`--avatar-identity`) +
 * white initial; member = per-member accent fill (household micro-discs).
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import { AvatarDisc } from "../../src/app/components/ui/avatar-disc";

void React;

describe("AvatarDisc (ENG-1375 S5)", () => {
  it("identity default: damson token fill + white initial, decorative", () => {
    const { getByTestId } = render(<AvatarDisc initial="G" />);
    const disc = getByTestId("avatar-disc");
    expect(disc.textContent).toBe("G");
    expect(disc.getAttribute("aria-hidden")).toBe("true");
    expect(disc.className).toContain("bg-[var(--avatar-identity)]");
    expect(disc.className).toContain("text-white");
    expect(disc.className).toContain("rounded-full");
    // Default size 36 pairs with the 13px initial (mobile 654:6 parity).
    expect(disc.className).toContain("h-9");
    expect(disc.className).toContain("text-[13px]");
  });

  it("member fill: per-member accent background, foreground ink initial", () => {
    const { getByTestId } = render(
      <AvatarDisc initial="ST" size={22} fill="member" accent="#4cd080" />,
    );
    const disc = getByTestId("avatar-disc");
    expect(disc.style.backgroundColor).toBe("rgb(76, 208, 128)");
    expect(disc.className).toContain("text-foreground");
    expect(disc.className).not.toContain("bg-[var(--avatar-identity)]");
    expect(disc.className).toContain("text-[9px]");
  });

  it("every size maps to an on-ladder initial size (9/11/13/18)", () => {
    for (const [size, expected] of [
      [18, "text-[9px]"],
      [22, "text-[9px]"],
      [28, "text-[11px]"],
      [36, "text-[13px]"],
      [52, "text-[18px]"],
    ] as const) {
      const { getByTestId, unmount } = render(
        <AvatarDisc initial="G" size={size} />,
      );
      expect(getByTestId("avatar-disc").className).toContain(expected);
      unmount();
    }
  });
});

/**
 * ENG-1593 — Rule 7 (DESIGN-CONSTITUTION.md) monogram treatment: "People may
 * use serif initials only with the frost-ring treatment, as a stated
 * placeholder until real photography lands." `treatment` defaults to
 * `"legacy"` (today's unchanged sans-bold initial, no ring); `"frostRing"`
 * is the new Rule 7-compliant render, gated at every call site behind
 * `avatar_monogram_frost_ring_v1` (default-OFF). Mobile twin:
 * `apps/mobile/tests/unit/gradientAvatar.test.tsx`.
 */
describe("AvatarDisc — Rule 7 frost-ring treatment (ENG-1593)", () => {
  it("legacy treatment (default) stays sans-bold with no ring box-shadow", () => {
    const { getByTestId } = render(<AvatarDisc initial="G" />);
    const disc = getByTestId("avatar-disc");
    expect(disc.className).toContain("font-bold");
    expect(disc.className).not.toContain("font-medium");
    expect(disc.style.boxShadow).toBeFalsy();
  });

  it("frostRing treatment renders the Newsreader serif, medium weight", () => {
    const { getByTestId } = render(<AvatarDisc initial="G" treatment="frostRing" />);
    const disc = getByTestId("avatar-disc");
    expect(disc.className).toContain("font-[family-name:var(--font-headline)]");
    expect(disc.className).toContain("font-medium");
    expect(disc.className).not.toContain("font-bold");
  });

  it("frostRing treatment applies the prototype's exact double ring box-shadow", () => {
    // `Sloe-App.html` L1728: `box-shadow: 0 0 0 2px var(--card), 0 0 0 3.5px
    // var(--accent-frost)` — a 2px card-coloured gap, then a 3.5px frost ring.
    const { getByTestId } = render(<AvatarDisc initial="G" treatment="frostRing" />);
    expect(getByTestId("avatar-disc").style.boxShadow).toBe(
      "0 0 0 2px var(--card), 0 0 0 3.5px var(--accent-frost)",
    );
  });

  it("frostRing treatment still carries the ONE canonical damson identity fill", () => {
    const { getByTestId } = render(<AvatarDisc initial="G" treatment="frostRing" />);
    expect(getByTestId("avatar-disc").className).toContain("bg-[var(--avatar-identity)]");
  });

  it("a caller-supplied style still wins over the frostRing box-shadow default", () => {
    const { getByTestId } = render(
      <AvatarDisc initial="G" treatment="frostRing" style={{ boxShadow: "none" }} />,
    );
    expect(getByTestId("avatar-disc").style.boxShadow).toBe("none");
  });
});
