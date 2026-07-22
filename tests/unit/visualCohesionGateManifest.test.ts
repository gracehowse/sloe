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
const GATE15_AUTHED_SPEC = readFileSync(
  resolve(__dirname, "../e2e/visual-redesign-gate15-authed.spec.ts"),
  "utf8",
);
const VISUAL_UTILS = readFileSync(
  resolve(__dirname, "../e2e/utils/visual.ts"),
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
    expect(DEEP_SPEC).toMatch(/deep\/paywall-dialog-\$\{vp\.name\}\.png/);
  });

  it("ENG-1639 — visual-regression-deep's describe block is NOT mode:'serial' (one flaky test must not cascade-skip the cohesion-gate surfaces)", () => {
    // Playwright aborts every LATER test in a serial block the moment one
    // fails — confirmed twice in one afternoon regenerating baselines for
    // this file: an unrelated flaky test declared earlier in the file took
    // down recipe detail + upgrade paywall dialog, the two ENG-1142
    // cohesion-gate surfaces this file exists to protect. No test in this
    // file shares mutable state, so nothing requires serial execution.
    // Strip `//` line comments before matching — this assertion's own
    // explanatory prose above would otherwise self-match the pattern.
    const codeOnly = DEEP_SPEC.replace(/\/\/[^\n]*/g, "");
    expect(codeOnly).not.toMatch(/mode:\s*["']serial["']/);
  });

  it("pins ENG-838 flag-ON visual coverage", () => {
    // `web-subscription-card` and `redesign_search_results` both collapsed
    // out of REDESIGN_VISUAL_FLAGS (ENG-1651): `web-subscription-card` was
    // already fully removed from app code (ENG-1334, entitlement-only gating
    // now); `redesign_search_results` resolved true in every build since
    // ENG-814/815 (2026-05-31/06-01) via REDESIGN_DEFAULT_ON, and its last
    // call sites were collapsed to their unconditional ON branch — so forcing
    // either ON during visual capture was already inert. Matches the
    // established design_system_elevation collapse pattern for this same pin.
    // The gate15 food-search-results-redesign coverage below is unaffected:
    // it pins the testid/screenshot name, not the (now-removed) flag string.
    expect(VISUAL_UTILS).toContain("REDESIGN_VISUAL_FLAGS");
    expect(AUTHED_SPEC).toContain("forceRedesignVisualFlagsOn(page)");
    expect(DEEP_SPEC).toContain("forceRedesignVisualFlagsOn(page)");
    expect(GATE15_AUTHED_SPEC).toContain(
      "food search redesigned results mobile-web",
    );
    expect(GATE15_AUTHED_SPEC).toContain(
      'getByTestId("food-search-results-redesign")',
    );
    expect(GATE15_AUTHED_SPEC).toContain(
      "gate15/food-search-results-mobile-web.png",
    );
  });
});
