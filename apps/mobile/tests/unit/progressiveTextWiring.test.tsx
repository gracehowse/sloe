// @vitest-environment jsdom
/**
 * ENG-720 — ProgressiveText gating wiring (mobile).
 *
 * Mirror of `tests/unit/progressiveTextWiring.test.tsx` (web). Pins the two
 * gates that make the staggered onboarding text reveal safe behind a
 * default-OFF flag:
 *
 *   1. Flag OFF  (`animate={false}`)          → instant text, single Text node.
 *   2. Reduce motion ON (even with `animate`) → instant text, single Text node.
 *   3. Flag ON + motion allowed               → one animated Text per token,
 *                                                full phrase still announced.
 *
 * "Instant" means a single plain `<Text>` — no per-token children — i.e.
 * pixel-identical to the pre-ENG-720 surface. We flip Reduce Motion via the
 * mocked `useReduceMotion` hook (the same gate the production component reads).
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

// Reduce-motion gate — flipped per test via this mutable flag.
let reduceMotion = false;
vi.mock("@/hooks/use-reduce-motion", () => ({
  useReduceMotion: () => reduceMotion,
}));

import { ProgressiveText } from "../../components/onboarding/ProgressiveText";

void React;

const PHRASE = "Cook what you love. Still reach your goals.";

/**
 * Count the immediate child Text nodes of the rendered root. In the instant
 * path the root <Text> has a single string child (the whole phrase); in the
 * animating path it has one nested <Text> per reveal token. RNTL composes
 * nested Text for `getByText`, so we inspect the JSON tree directly.
 */
function tokenTextNodeCount(json: unknown): number {
  const root = json as {
    children?: ({ type?: string } | string)[];
  } | null;
  if (!root || !Array.isArray(root.children)) return 0;
  return root.children.filter(
    (child) => typeof child === "object" && child?.type === "Text",
  ).length;
}

beforeEach(() => {
  reduceMotion = false;
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("ProgressiveText gating (mobile, ENG-720)", () => {
  it("flag OFF (default) → instant: one plain Text node with the full phrase, no token split", () => {
    const { getByText, toJSON } = render(
      <ProgressiveText>{PHRASE}</ProgressiveText>,
    );
    // The whole phrase resolves as a single text node (no token children).
    expect(getByText(PHRASE)).toBeTruthy();
    expect(tokenTextNodeCount(toJSON())).toBe(0);
  });

  it("flag OFF explicitly → instant fallback", () => {
    const { getByText, toJSON } = render(
      <ProgressiveText animate={false}>{PHRASE}</ProgressiveText>,
    );
    expect(getByText(PHRASE)).toBeTruthy();
    expect(tokenTextNodeCount(toJSON())).toBe(0);
  });

  it("reduce-motion ON beats flag ON → instant fallback (no token split)", () => {
    reduceMotion = true;
    const { getByText, toJSON } = render(
      <ProgressiveText animate>{PHRASE}</ProgressiveText>,
    );
    // Still the whole phrase as one node — the staggered token split is skipped.
    expect(getByText(PHRASE)).toBeTruthy();
    expect(tokenTextNodeCount(toJSON())).toBe(0);
  });

  it("flag ON + motion allowed → one animated Text per token (8 words → 8 tokens)", () => {
    const { toJSON } = render(<ProgressiveText animate>{PHRASE}</ProgressiveText>);
    expect(tokenTextNodeCount(toJSON())).toBe(8);
  });

  it("animating path keeps the full phrase as the accessibility label (a11y)", () => {
    const { getByLabelText } = render(
      <ProgressiveText animate>{PHRASE}</ProgressiveText>,
    );
    expect(getByLabelText(PHRASE)).toBeTruthy();
  });

  it("a single-word phrase (the wordmark) → one token when animating, plain Text when off", () => {
    const off = render(<ProgressiveText>sloe</ProgressiveText>);
    expect(off.getByText("sloe")).toBeTruthy();
    expect(tokenTextNodeCount(off.toJSON())).toBe(0);

    const on = render(<ProgressiveText animate>sloe</ProgressiveText>);
    expect(tokenTextNodeCount(on.toJSON())).toBe(1);
  });
});
