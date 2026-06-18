import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Storybook static asset copy", () => {
  it("build-storybook uses the deterministic wrapper instead of Storybook's parallel static copy", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["build-storybook"]).toBe("node scripts/build-storybook.mjs");
  });

  it("wrapper disables staticDirs during build and copies public once afterward", () => {
    const script = readFileSync("scripts/build-storybook.mjs", "utf8");
    expect(script).toContain('SUPPR_STORYBOOK_SKIP_STATIC_DIRS: "1"');
    expect(script).toContain('await cp(resolve(root, "public"), outputDir');
    expect(script).toContain("recursive: true");
    expect(script).toContain("force: true");
  });

  it("Storybook config preserves staticDirs for dev but skips them for the wrapper build", () => {
    const config = readFileSync(".storybook/main.ts", "utf8");
    expect(config).toContain('process.env.SUPPR_STORYBOOK_SKIP_STATIC_DIRS === "1" ? [] : ["../public"]');
  });
});
