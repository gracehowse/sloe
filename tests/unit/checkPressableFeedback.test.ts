import { describe, it, expect } from "vitest";
// @ts-expect-error — plain .mjs ratchet script, no types
import { findFeedbackless } from "../../scripts/check-pressable-feedback.mjs";

/**
 * ENG-1519 — the check:pressable-feedback census. Guards the regression that
 * nearly shipped: matching `<Pressable[\s>]` PER LINE missed multi-line opening
 * tags (`<Pressable\n  onPress=…`), under-counting 84 files as 17. The census
 * matches `/<Pressable\b/` on the full text (also excludes `<PressableScale`).
 */
describe("ENG-1519 check:pressable-feedback census", () => {
  it("counts a multi-line raw <Pressable (props start on the next line)", () => {
    const src = `<Pressable\n  onPress={x}\n>\n  <Text>Go</Text>\n</Pressable>`;
    expect(findFeedbackless(src)).toHaveLength(1);
  });

  it("counts multiple raw pressables in a feedbackless file", () => {
    const src = `<Pressable onPress={a} />\n<Pressable\n  onPress={b}\n/>`;
    expect(findFeedbackless(src)).toHaveLength(2);
  });

  it("does NOT count <PressableScale, and excludes the file as already fed-back", () => {
    const src = `import { PressableScale } from "x";\n<PressableScale onPress={x}><Text>Go</Text></PressableScale>`;
    expect(findFeedbackless(src)).toHaveLength(0);
  });

  it("excludes a file with an inline ({ pressed }) style function", () => {
    const src = `<Pressable style={({ pressed }) => [{ opacity: pressed ? 0.5 : 1 }]}><Text /></Pressable>`;
    expect(findFeedbackless(src)).toHaveLength(0);
  });

  it("excludes a file using SupprButton", () => {
    const src = `import { SupprButton } from "x";\n<Pressable onPress={a} /><SupprButton />`;
    expect(findFeedbackless(src)).toHaveLength(0);
  });

  it("ignores <Pressable inside comments", () => {
    const src = `// <Pressable />\n{/* <Pressable /> */}\nconst x = 1;`;
    expect(findFeedbackless(src)).toHaveLength(0);
  });
});
