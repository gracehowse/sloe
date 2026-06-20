/**
 * ENG-605 — Cook mode Kitchen Stories bar: large step type, no redundant
 * step badge, haptic step transitions.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const COOK = readFileSync(
  resolve(__dirname, "../../apps/mobile/app/cook.tsx"),
  "utf8",
);

describe("ENG-605 cook mode premium typography", () => {
  it("uses large editorial step text (24px) on mobile", () => {
    expect(COOK).toMatch(/stepText:\s*\{[^}]*fontSize:\s*24/s);
    expect(COOK).toMatch(/lineHeight:\s*34/);
  });

  it("drops the redundant in-body step number chip (header owns step count)", () => {
    expect(COOK).not.toMatch(/styles\.stepNumber/);
  });

  it("fires selection haptic on step next/prev", () => {
    expect(COOK).toMatch(/setStepIndex[\s\S]{0,240}Haptics\.selectionAsync/);
    expect(COOK).toMatch(/goNext[\s\S]{0,120}setStepIndex/);
    expect(COOK).toMatch(/goPrev[\s\S]{0,120}setStepIndex/);
  });
});
