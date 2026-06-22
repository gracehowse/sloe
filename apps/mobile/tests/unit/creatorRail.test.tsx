// @vitest-environment jsdom
/**
 * CreatorRail (mobile, ENG-1225 #14) — the parity mirror of the web
 * `DiscoverCreatorRail`. Renders a chip per creator (initial-on-tint fallback)
 * and HIDES entirely when empty (the `creators` table is empty pre-launch — no
 * fabricated chips). Tint + initial come from the shared
 * `creatorChipPresentation` helpers, so this stays in lockstep with web.
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react-native";
import { CreatorRail } from "../../components/discover/CreatorRail";

void React;

const creators = [
  { id: "a1", handle: "mob", displayName: "Mob Kitchen", avatarUrl: null },
  { id: "b2", handle: "anna", displayName: "Anna Jones", avatarUrl: null },
];

describe("CreatorRail", () => {
  it("renders the fallback initial + name for each creator", () => {
    const { getByText } = render(<CreatorRail creators={creators} />);
    expect(getByText("M")).toBeTruthy();
    expect(getByText("A")).toBeTruthy();
    expect(getByText("Mob Kitchen")).toBeTruthy();
    expect(getByText("Anna Jones")).toBeTruthy();
  });

  it("renders nothing when there are no creators (no fabricated chips)", () => {
    const { toJSON } = render(<CreatorRail creators={[]} />);
    expect(toJSON()).toBeNull();
  });
});
