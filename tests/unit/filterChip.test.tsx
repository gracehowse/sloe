/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { FilterChip } from "../../src/app/components/ui/filter-chip";

describe("FilterChip (§7 grammar)", () => {
  it("renders unselected with quiet card fill and no border", () => {
    render(<FilterChip label="Vegan" selected={false} data-testid="chip" />);
    const chip = screen.getByTestId("chip");
    expect(chip.className).toContain("rounded-full");
    expect(chip.className).toContain("bg-card");
    expect(chip.className).toContain("text-muted-foreground");
    expect(chip.className).not.toContain("border-primary");
    expect(chip.className).not.toContain("bg-primary/10");
  });

  it("renders selected with primary-soft fill and primary-solid label", () => {
    render(<FilterChip label="Vegan" selected data-testid="chip" />);
    const chip = screen.getByTestId("chip");
    expect(chip.className).toContain("bg-primary-soft");
    expect(chip.className).toContain("text-primary-solid");
    expect(chip.className).not.toContain("border-primary");
  });

  it("toggles via onClick", () => {
    const onClick = vi.fn();
    render(<FilterChip label="Gluten free" onClick={onClick} data-testid="chip" />);
    fireEvent.click(screen.getByTestId("chip"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
