// @vitest-environment jsdom
/**
 * Brand-mark canonical-unify test (ENG-797, design-direction 2026-05-31).
 *
 * Mirror of `tests/unit/brandMark.test.tsx` (web). Locks in the
 * single-canonical-mark contract on mobile:
 *
 *  - `SupprMark` is the canonical entry point. When the
 *    `design_system_brandmark` flag is ON it renders the canonical ring
 *    motif (concentric circles) — NOT the legacy S-glyph.
 *  - When the flag is OFF (the default in the analytics shim and in a
 *    cold PostHog client) it falls back to the legacy S-glyph so the
 *    old path stays alive until the flag is at 100%.
 *  - `SupprPlateMark` always renders the canonical ring motif.
 *
 * `@/lib/analytics` is aliased to the test shim (see
 * `apps/mobile/vitest.config.ts`); we drive `isFeatureEnabled` through
 * that shim so both branches are exercised deterministically.
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

// Explicit analytics mock so `isFeatureEnabled` is a fresh spy owned by
// this file (the aliased shim's pre-made spy is shared and brittle under
// the vmThreads pool). Default OFF; tests flip it via `mockReturnValue`.
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

describe("SupprMark canonical-unify (mobile, ENG-797)", () => {
  it("renders the legacy S-glyph when design_system_brandmark is OFF", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false);
    const { queryByText } = render(<SupprMark />);
    expect(queryByText("S")).toBeTruthy();
  });

  it("renders the canonical ring motif (no S-glyph) when the flag is ON", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(true);
    const { queryByText, getByLabelText } = render(<SupprMark />);
    // Canonical ring path renders no S-glyph text node.
    expect(queryByText("S")).toBeNull();
    // Still exposes the brand accessibility label.
    expect(getByLabelText("Suppr")).toBeTruthy();
  });

  it("passes the design_system_brandmark flag key to isFeatureEnabled", () => {
    render(<SupprMark />);
    expect(vi.mocked(isFeatureEnabled)).toHaveBeenCalledWith(
      "design_system_brandmark",
    );
  });
});

describe("SupprPlateMark — always canonical (mobile, ENG-797)", () => {
  it("renders no S-glyph regardless of flag state", () => {
    vi.mocked(isFeatureEnabled).mockReturnValue(false);
    const { queryByText, getByLabelText } = render(<SupprPlateMark />);
    expect(queryByText("S")).toBeNull();
    expect(getByLabelText("Suppr")).toBeTruthy();
  });

  it("composes with the Suppr word in the wordmark", () => {
    const { getByText } = render(<SupprPlateWordmark />);
    expect(getByText("Suppr")).toBeTruthy();
  });
});
