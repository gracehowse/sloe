/**
 * ENG-1516 — the onboarding upgrade step's trial price card is a STATIC
 * callout on both platforms.
 *
 * Pre-fix the card was interactive on web (OptionCard onClick) and on
 * mobile (PressableScale onPress): tapping it toggled a
 * `trialChoice: "trial"` selected-highlight that nothing consumed — not
 * persisted, never read by either CTA, and impossible to deselect. A
 * dead affordance dressed as a choice. The step keeps exactly two real
 * affordances (legal C4): "Start free trial" and "Continue on Free".
 *
 * Source-level pins on both files (cross-tree reads are the established
 * pattern — see adherenceDisplay.test.ts) so neither platform quietly
 * re-introduces the fake selection.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const webSrc = readFileSync(
  resolve(__dirname, "../../src/app/components/onboarding/steps/upgrade.tsx"),
  "utf8",
);
const mobileSrc = readFileSync(
  resolve(
    __dirname,
    "../../apps/mobile/components/onboarding/steps/upgrade.tsx",
  ),
  "utf8",
);

describe("ENG-1516 — upgrade-step trial card is a static callout (web)", () => {
  it("has no card click handler and no trialChoice-selected highlight", () => {
    expect(webSrc).not.toContain("onClick={() => set({ trialChoice");
    expect(webSrc).not.toContain('state.trialChoice === "trial"');
    // The interactive OptionCard is gone from this step entirely.
    expect(webSrc).not.toContain("OptionCard");
  });

  it("keeps the two real affordances", () => {
    expect(webSrc).toContain("Start free trial");
    expect(webSrc).toContain("Continue on Free");
  });
});

describe("ENG-1516 — upgrade-step trial card is a static callout (mobile)", () => {
  it("has no card press handler and no trialChoice-selected highlight", () => {
    expect(mobileSrc).not.toContain("onPress={() => set({ trialChoice");
    expect(mobileSrc).not.toContain('state.trialChoice === "trial"');
  });

  it("keeps exactly two pressables — Start free trial + Continue on Free", () => {
    const pressables = mobileSrc.match(/<PressableScale/g) ?? [];
    expect(pressables).toHaveLength(2);
    expect(mobileSrc).toContain("Start free trial");
    expect(mobileSrc).toContain("Continue on Free");
  });
});
