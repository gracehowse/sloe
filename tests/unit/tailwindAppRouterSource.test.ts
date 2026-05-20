import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Tailwind source discovery", () => {
  it("does not restrict utility generation to src-only files", () => {
    const css = readFileSync(join(process.cwd(), "src/styles/tailwind.css"), "utf8");

    expect(css).toContain("@import 'tailwindcss';");
    expect(css).not.toContain("source(none)");
    expect(css).not.toContain("@source '../**/*.{js,ts,jsx,tsx}'");
  });
});
