// @vitest-environment jsdom
/**
 * Brand-mark canonical-unify test (ENG-797) — updated for the Sloe wordmark
 * (2026-06-04 Grace decision). Mirror of `tests/unit/brandMark.test.tsx` (web).
 *
 * The mark used to gate on `design_system_brandmark` (legacy S-glyph ↔ ring
 * motif). That whole branch is RETIRED: `SupprMark` / `SupprPlateMark` now
 * render ONE unconditional brand — the "Sloe" wordmark (capital S, Newsreader
 * semibold; casing updated 2026-06-08 to match Figma `654:2`) — with NO flag
 * read and NO legacy 'S'. This file pins that single-canonical-mark contract
 * so the glyph + flag can never sneak back:
 *
 *  - the mark renders the Sloe wordmark regardless of flag state;
 *  - it never renders a standalone 'S' glyph;
 *  - it does NOT read `design_system_brandmark` (no analytics dependency).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    background: "#FBF8F3",
    brandMarkRing: "#1c1916",
  }),
}));

// Owned spy so we can prove the mark NEVER calls the brandmark flag.
vi.mock("@/lib/analytics", () => ({
  track: vi.fn(),
  isFeatureEnabled: vi.fn(() => false),
}));

import { isFeatureEnabled } from "@/lib/analytics";
import {
  SupprMark,
  SupprPlateMark,
  SupprPlateWordmark,
} from "../../components/SupprMark";

beforeEach(() => {
  vi.mocked(isFeatureEnabled).mockClear();
  vi.mocked(isFeatureEnabled).mockReturnValue(false);
});

afterEach(() => {
  vi.mocked(isFeatureEnabled).mockReturnValue(false);
});

describe("SupprMark canonical Sloe wordmark (mobile, ENG-797)", () => {
  it("renders the Sloe wordmark, never a legacy 'S' glyph (flag OFF)", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false);
    const { getByLabelText, queryByText } = render(<SupprMark />);
    expect(getByLabelText("Sloe")).toBeTruthy();
    expect(queryByText("S")).toBeNull();
  });

  it("renders the SAME Sloe wordmark regardless of flag state (flag ON)", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(true);
    const { getByLabelText, queryByText } = render(<SupprMark />);
    expect(getByLabelText("Sloe")).toBeTruthy();
    expect(queryByText("S")).toBeNull();
  });

  it("does NOT read the design_system_brandmark flag (no gated branch left)", () => {
    render(<SupprMark />);
    expect(vi.mocked(isFeatureEnabled)).not.toHaveBeenCalledWith(
      "design_system_brandmark",
    );
  });
});

describe("SupprPlateMark — always the Sloe wordmark (mobile, ENG-797)", () => {
  it("renders no S-glyph regardless of flag state", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false);
    const { queryByText, getByLabelText } = render(<SupprPlateMark />);
    expect(queryByText("S")).toBeNull();
    expect(getByLabelText("Sloe")).toBeTruthy();
  });

  it("composes the Sloe wordmark in the lockup", () => {
    const { getByText } = render(<SupprPlateWordmark />);
    expect(getByText("Sloe")).toBeTruthy();
  });
});
