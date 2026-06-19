/**
 * ENG-889 — Today header avatar uses design tokens (dark-mode safe).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../../src/app/components/suppr/today-date-header.tsx"),
  "utf8",
);

describe("today-date-header avatar token (ENG-889)", () => {
  it("uses --accent-info for mobile settings avatar, not hardcoded damson hex", () => {
    expect(SRC).toMatch(/bg-\[var\(--accent-info\)\]/);
    expect(SRC.toLowerCase()).not.toMatch(/#6a4b7a/);
  });
});
