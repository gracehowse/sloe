import { describe, expect, it } from "vitest";
import { formatSidebarBadge } from "@/lib/navigation/sidebarBadge";

describe("formatSidebarBadge", () => {
  it("hides at zero", () => {
    expect(formatSidebarBadge(0)).toEqual({ show: false, label: "" });
  });

  it("shows exact count up to 9", () => {
    expect(formatSidebarBadge(7)).toEqual({ show: true, label: "7" });
  });

  it("shows a dot instead of 99+ for large lists", () => {
    expect(formatSidebarBadge(123)).toEqual({ show: true, label: "•" });
  });
});
