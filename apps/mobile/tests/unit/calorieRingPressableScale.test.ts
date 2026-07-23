/**
 * ENG-1565 — CalorieRing PressableScale migration restores disabled={!onToggle}
 * parity with CalorieRingDial + web DailyRing (inert when no handler wired).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(
  resolve(__dirname, "../../components/charts/CalorieRing.tsx"),
  "utf8",
);

describe("CalorieRing — PressableScale toggle parity (ENG-1565)", () => {
  it("uses PressableScale with disabled={!onToggle}", () => {
    expect(src).toContain("PressableScale");
    expect(src).toContain("disabled={!onToggle}");
    expect(src).toContain('haptic="selection"');
    expect(src).not.toMatch(/<Pressable[\s>]/);
  });
});
