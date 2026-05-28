import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";

describe("ImageWithFallback", () => {
  it("renders the primary image when load succeeds", () => {
    render(<ImageWithFallback src="https://example.com/photo.jpg" alt="Recipe photo" />);
    const img = screen.getByRole("img", { name: "Recipe photo" });
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
  });

  it("shows the inline SVG fallback after an image error", () => {
    render(<ImageWithFallback src="https://example.com/broken.jpg" alt="Recipe photo" />);
    const img = screen.getByRole("img", { name: "Recipe photo" });
    fireEvent.error(img);
    const fallback = screen.getByRole("img", { name: "Error loading image" });
    expect(fallback).toHaveAttribute("data-original-url", "https://example.com/broken.jpg");
    expect(fallback.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  });
});
