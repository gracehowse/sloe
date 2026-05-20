import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const roadmapPath = path.resolve("app/roadmap/page.tsx");
const src = fs.readFileSync(roadmapPath, "utf-8");

describe("ENG-81 · Roadmap row visual differentiation", () => {
  it("defines rowBg per status", () => {
    expect(src).toContain("rowBg:");
    expect(src).toContain("bg-emerald-50/40");
    expect(src).toContain("bg-amber-50/40");
  });

  it("defines borderAccent per status", () => {
    expect(src).toContain("borderAccent:");
    expect(src).toContain("border-l-emerald-500");
    expect(src).toContain("border-l-amber-500");
  });

  it("applies a 3px left border to rows", () => {
    expect(src).toContain("border-l-[3px]");
  });

  it("applies dark mode variants for row backgrounds", () => {
    expect(src).toContain("dark:bg-emerald-950/20");
    expect(src).toContain("dark:bg-amber-950/20");
  });

  it("Planned rows get transparent border (no accent)", () => {
    expect(src).toContain("border-l-transparent");
  });
});
