/**
 * ENG-889 — Today header avatar uses design tokens (dark-mode safe).
 * S5 (2026-07-10, ENG-1375): the inline `--accent-info` fill is retired —
 * the avatar is the shared `AvatarDisc` identity disc (`--avatar-identity`,
 * scheme-constant damson; accent-info lightens in dark and fails AA under
 * the white initial).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../../src/app/components/suppr/today-date-header.tsx"),
  "utf8",
);

const DISC = readFileSync(
  resolve(__dirname, "../../src/app/components/ui/avatar-disc.tsx"),
  "utf8",
);

describe("today-date-header avatar token (ENG-889 / ENG-1375 S5)", () => {
  it("renders the shared AvatarDisc, no inline accent-info fill or raw damson hex", () => {
    expect(SRC).toContain("<AvatarDisc");
    expect(SRC).not.toMatch(/bg-\[var\(--accent-info\)\]/);
    expect(SRC.toLowerCase()).not.toMatch(/#6a4b7a/);
  });

  it("AvatarDisc identity fill is the --avatar-identity token, not a raw hex", () => {
    expect(DISC).toContain("bg-[var(--avatar-identity)]");
    expect(DISC.toLowerCase()).not.toMatch(/#6a4b7a/);
  });
});
