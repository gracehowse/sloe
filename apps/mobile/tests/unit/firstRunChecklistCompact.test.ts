import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const CHECKLIST = readFileSync(
  resolve(__dirname, "../../components/FirstRunChecklist.tsx"),
  "utf8",
);

describe("FirstRunChecklist compact treatment", () => {
  it("renders only the next unfinished step", () => {
    expect(CHECKLIST).toMatch(/const nextStep = steps\.find\(\(s\) => !s\.done\)/);
    expect(CHECKLIST).toMatch(/if \(dismissed \|\| !nextStep\) return null/);
    expect(CHECKLIST).not.toMatch(/steps\.map/);
  });

  it("uses the mobile press primitive for the checklist action", () => {
    expect(CHECKLIST).toMatch(/import \{ PressableScale \}/);
    expect(CHECKLIST).toMatch(/<PressableScale[\s\S]*haptic="selection"/);
  });
});
