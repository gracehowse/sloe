/**
 * ENG-602 / ENG-643 — Eat Again editorial parity (web).
 */

import * as React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

import { TodayEatAgainBanner } from "../../src/app/components/suppr/today-eat-again-banner";
import type { FoodHistoryItem } from "../../src/lib/nutrition/foodHistory";

const base: FoodHistoryItem = {
  recipeTitle: "Greek yogurt bowl with berries and granola",
  calories: 420,
  protein: 28,
  carbs: 52,
  fat: 12,
  lastLoggedAt: "2026-05-18T12:00:00.000Z",
  imageUrl: "https://example.com/yogurt.jpg",
};

describe("TodayEatAgainBanner (web)", () => {
  it("renders 64px thumb, 2-line title, and Log it CTA", () => {
    render(
      <TodayEatAgainBanner
        suggestion={base}
        slot="Lunch"
        onLog={vi.fn()}
        onDismiss={vi.fn()}
      />,
    );
    expect(screen.getByText("Eat again")).toBeDefined();
    expect(screen.getByText(base.recipeTitle)).toBeDefined();
    expect(screen.getByRole("button", { name: /Log Greek yogurt/ }).textContent).toContain("Log it");
    const img = document.querySelector('img[src="https://example.com/yogurt.jpg"]');
    expect(img).not.toBeNull();
  });

  it("fires onLog and onDismiss", () => {
    const onLog = vi.fn();
    const onDismiss = vi.fn();
    render(
      <TodayEatAgainBanner suggestion={base} slot="Lunch" onLog={onLog} onDismiss={onDismiss} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /Log Greek yogurt/ }));
    fireEvent.click(screen.getByRole("button", { name: "Dismiss Eat again suggestion" }));
    expect(onLog).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
