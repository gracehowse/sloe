// @vitest-environment jsdom
/**
 * LogConfirmCheck (mobile, ENG-722) — the calm log-confirm checkmark overlay.
 *
 * Pins the render contract by `bump`:
 *   - bump === 0 (never fired) → renders nothing
 *   - bump > 0  + motion allowed → mounts the overlay (the sage check)
 *   - reduce-motion → renders nothing even when bumped (instant / no animation)
 *
 * The flag gate lives in the caller (`useLogConfirmCheck`, tested separately);
 * this component owns the reduce-motion belt-and-braces guard + the render.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react-native";

// Reduce-motion — flipped per-test.
const reduceMotion = vi.fn(() => false);
vi.mock("@/hooks/use-reduce-motion", () => ({
  useReduceMotion: () => reduceMotion(),
}));

import { LogConfirmCheck } from "../../components/today/LogConfirmCheck";

beforeEach(() => {
  reduceMotion.mockReturnValue(false);
});

afterEach(() => {
  vi.clearAllMocks();
});

// The overlay is decorative (`accessibilityElementsHidden`), so query with
// hidden elements included — a screen reader ignores it, but the test still
// asserts it mounts.
const HIDDEN = { includeHiddenElements: true } as const;

describe("LogConfirmCheck (mobile)", () => {
  it("renders nothing before the first bump (bump === 0)", () => {
    const { queryByTestId } = render(<LogConfirmCheck bump={0} />);
    expect(queryByTestId("log-confirm-check", HIDDEN)).toBeNull();
  });

  it("mounts the check overlay once bumped (motion allowed)", () => {
    const { getByTestId } = render(<LogConfirmCheck bump={1} />);
    expect(getByTestId("log-confirm-check", HIDDEN)).toBeTruthy();
  });

  it("reduce-motion: renders nothing even when bumped (instant / no animation)", () => {
    reduceMotion.mockReturnValue(true);
    const { queryByTestId } = render(<LogConfirmCheck bump={3} />);
    expect(queryByTestId("log-confirm-check", HIDDEN)).toBeNull();
  });

  it("the overlay is non-interactive so it never blocks ring taps", () => {
    const { getByTestId } = render(<LogConfirmCheck bump={1} />);
    const overlay = getByTestId("log-confirm-check", HIDDEN);
    const style = Array.isArray(overlay.props.style)
      ? Object.assign({}, ...overlay.props.style)
      : overlay.props.style;
    expect(style.pointerEvents).toBe("none");
  });
});
