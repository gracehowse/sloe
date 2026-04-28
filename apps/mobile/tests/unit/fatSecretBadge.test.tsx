// @vitest-environment jsdom
/**
 * FatSecretBadge — mobile primitive.
 *
 * Attribution contract: FatSecret Platform API ToS requires the badge
 * or text snippet to appear wherever FatSecret-sourced content is shown.
 * These tests pin the contract surface:
 *   - text variant renders the exact required phrase
 *   - badge variant renders the attribution image
 *   - show=false renders nothing
 *   - show=true (default) renders the element
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

import { FatSecretBadge } from "../../components/ui/FatSecretBadge";

void React;

// Minimal hook mock — the component reads text colour from useThemeColors.
vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    textTertiary: "#999",
    text: "#000",
    background: "#fff",
    card: "#fff",
    border: "#ccc",
    textSecondary: "#666",
  }),
}));

describe("FatSecretBadge (mobile)", () => {
  it("renders nothing when show=false", () => {
    const { toJSON } = render(<FatSecretBadge show={false} />);
    expect(toJSON()).toBeNull();
  });

  it("renders something when show defaults to true", () => {
    const { toJSON } = render(<FatSecretBadge />);
    expect(toJSON()).not.toBeNull();
  });

  describe("text variant", () => {
    it("renders the exact required attribution phrase", () => {
      const { getByText } = render(
        <FatSecretBadge variant="text" />,
      );
      // The exact phrase mandated by FatSecret ToS
      expect(getByText("Powered by fatsecret Platform API")).toBeTruthy();
    });

    it("has an accessible label", () => {
      const { getByLabelText } = render(
        <FatSecretBadge variant="text" testID="fs-badge" />,
      );
      expect(getByLabelText("Powered by fatsecret Platform API")).toBeTruthy();
    });
  });

  describe("badge variant", () => {
    it("renders with the correct testID", () => {
      const { getByTestId } = render(
        <FatSecretBadge variant="badge" testID="fs-badge-img" />,
      );
      expect(getByTestId("fs-badge-img")).toBeTruthy();
    });

    it("has an accessible label", () => {
      const { getByLabelText } = render(
        <FatSecretBadge variant="badge" testID="fs-badge-img" />,
      );
      expect(getByLabelText("Powered by fatsecret Platform API")).toBeTruthy();
    });
  });
});
