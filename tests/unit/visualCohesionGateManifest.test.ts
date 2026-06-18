/**
 * ENG-1142 — pins the visual cohesion gate: Today + paywall + recipe-detail.
 * The gate is implemented as a filtered Playwright run over existing specs,
 * not duplicate snapshot files.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const PKG = JSON.parse(
  readFileSync(resolve(__dirname, "../../package.json"), "utf8"),
) as { scripts: Record<string, string> };

const AUTHED_SPEC = readFileSync(
  resolve(__dirname, "../e2e/visual-audit-authed.spec.ts"),
  "utf8",
);
const DEEP_SPEC = readFileSync(
  resolve(__dirname, "../e2e/visual-regression-deep.spec.ts"),
  "utf8",
);

describe("visual cohesion gate manifest (ENG-1142)", () => {
  it("exposes npm run test:e2e:visual:cohesion targeting both specs", () => {
    const script = PKG.scripts["test:e2e:visual:cohesion"];
    expect(script).toBeTruthy();
    expect(script).toContain("visual-audit-authed.spec.ts");
    expect(script).toContain("visual-regression-deep.spec.ts");
    expect(script).toMatch(/today mobile\|today desktop/);
    expect(script).toMatch(/recipe detail/);
    expect(script).toMatch(/upgrade paywall/);
  });

  it("pins Today in visual-audit-authed", () => {
    expect(AUTHED_SPEC).toMatch(/name:\s*"today"/);
    expect(AUTHED_SPEC).toMatch(/path:\s*"\/today"/);
  });

  it("pins recipe detail + paywall in visual-regression-deep", () => {
    expect(DEEP_SPEC).toMatch(/recipe detail/);
    expect(DEEP_SPEC).toMatch(/upgrade paywall dialog/);
    expect(DEEP_SPEC).toMatch(/toHaveScreenshot\(`deep\/recipe-detail-/);
    expect(DEEP_SPEC).toMatch(/toHaveScreenshot\(`deep\/paywall-dialog-/);
  });
});
