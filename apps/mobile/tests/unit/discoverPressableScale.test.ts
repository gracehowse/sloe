/**
 * ENG-1016 — Discover recipe cards route primary taps through PressableScale.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = readFileSync(
  resolve(__dirname, "../../app/(tabs)/discover.tsx"),
  "utf8",
);

describe("Discover — PressableScale haptic rebalance (ENG-1016)", () => {
  it("recipe cards use confirm haptic via PressableScale", () => {
    expect(SRC).toMatch(/import \{ PressableScale \}/);
    expect(SRC).toMatch(/PressableScale[\s\S]{0,80}haptic="confirm"[\s\S]{0,120}router\.push\(`\/recipe\//);
  });

  it("ENG-1139: creator byline routes through PressableScale (selection haptic)", () => {
    expect(SRC).toMatch(/PressableScale[\s\S]{0,80}haptic="selection"[\s\S]{0,200}router\.push\(`\/creator\//);
  });

  it("ENG-1139: eating-out shortcut rows use PressableScale (selection haptic)", () => {
    expect(SRC).toMatch(/eatingOut\.map[\s\S]{0,160}PressableScale[\s\S]{0,80}haptic="selection"/);
  });
});
