// @vitest-environment jsdom
/**
 * FatSecretBadge — web primitive.
 *
 * Attribution contract: FatSecret Platform API ToS requires the badge
 * or text snippet to appear wherever FatSecret-sourced content is shown.
 * These tests pin the contract surface:
 *   - badge variant renders an <a> pointing to fatsecret.com
 *   - badge variant renders an <img> with the official URL
 *   - text variant renders the exact required phrase
 *   - show=false renders nothing (zero DOM nodes)
 *   - show=true (default) renders the element
 */
import * as React from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { FatSecretBadge } from "../../src/app/components/ui/FatSecretBadge";

void React;

describe("FatSecretBadge (web)", () => {
  it("renders nothing when show=false", () => {
    const { container } = render(<FatSecretBadge show={false} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders when show=true (default)", () => {
    const { container } = render(<FatSecretBadge />);
    expect(container.firstChild).not.toBeNull();
  });

  describe("badge variant (default)", () => {
    it("renders an anchor linking to fatsecret.com", () => {
      render(<FatSecretBadge variant="badge" />);
      const anchor = screen.getByRole("link", { name: /powered by fatsecret/i });
      expect(anchor).toBeDefined();
      expect((anchor as HTMLAnchorElement).href).toContain("fatsecret.com");
    });

    it("opens in a new tab", () => {
      render(<FatSecretBadge variant="badge" />);
      const anchor = screen.getByRole("link", { name: /powered by fatsecret/i });
      expect((anchor as HTMLAnchorElement).target).toBe("_blank");
    });

    it("renders the official badge image with the required alt text", () => {
      render(<FatSecretBadge variant="badge" />);
      const img = screen.getByRole("img", { name: /powered by fatsecret/i });
      expect(img).toBeDefined();
      expect((img as HTMLImageElement).src).toContain("platform.fatsecret.com");
    });
  });

  describe("text variant", () => {
    it("renders the exact required attribution phrase", () => {
      render(<FatSecretBadge variant="text" />);
      const link = screen.getByRole("link", { name: /powered by fatsecret platform api/i });
      expect(link).toBeDefined();
      // The exact phrase mandated by ToS
      expect(link.textContent).toBe("Powered by fatsecret Platform API");
    });

    it("links to fatsecret.com", () => {
      render(<FatSecretBadge variant="text" />);
      const link = screen.getByRole("link", { name: /powered by fatsecret platform api/i });
      expect((link as HTMLAnchorElement).href).toContain("fatsecret.com");
    });
  });
});
