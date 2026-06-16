/**
 * ENG-827 — documents Gate 1.5 visual-regression coverage and keeps the
 * Playwright spec inventory wired into `npm run test:e2e:visual`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const PKG = readFileSync(resolve(ROOT, "package.json"), "utf8");
const GATE15_PUBLIC = readFileSync(
  resolve(ROOT, "tests/e2e/visual-redesign-gate15.spec.ts"),
  "utf8",
);
const GATE15_AUTHED = readFileSync(
  resolve(ROOT, "tests/e2e/visual-redesign-gate15-authed.spec.ts"),
  "utf8",
);

/** Gate 1.5 surfaces that must have a committed golden or explicit spec coverage. */
const GATE_15_VISUAL_COVERAGE = [
  { surface: "Today tab", spec: "visual-audit-authed.spec.ts", needle: 'name: "today"' },
  { surface: "Onboarding welcome", spec: "visual-redesign-gate15.spec.ts", needle: "gate15/onboarding-welcome-" },
  { surface: "Onboarding goal", spec: "visual-redesign-gate15.spec.ts", needle: "gate15/onboarding-goal-" },
  { surface: "Log sheet (mobile-web)", spec: "visual-redesign-gate15-authed.spec.ts", needle: "gate15/log-sheet-mobile-web" },
  { surface: "Paywall upgrade dialog", spec: "visual-regression-deep.spec.ts", needle: "deep/paywall-dialog-" },
  { surface: "Pricing", spec: "visual-regression-subpages.spec.ts", needle: 'name: "pricing"' },
  { surface: "Discover tab", spec: "visual-audit-authed.spec.ts", needle: 'name: "discover"' },
  { surface: "Library tab", spec: "visual-audit-authed.spec.ts", needle: 'name: "library"' },
] as const;

describe("ENG-827 — Gate 1.5 visual regression manifest", () => {
  it("npm run test:e2e:visual includes Gate 1.5 public onboarding spec", () => {
    expect(PKG).toContain("visual-redesign-gate15.spec.ts");
  });

  it("npm run test:e2e:visual includes Gate 1.5 authed log-sheet spec", () => {
    expect(PKG).toContain("visual-redesign-gate15-authed.spec.ts");
  });

  it("public Gate 1.5 spec captures welcome + goal at mobile and desktop", () => {
    expect(GATE15_PUBLIC).toContain("gate15/onboarding-welcome-${vp.name}");
    expect(GATE15_PUBLIC).toContain("gate15/onboarding-goal-${vp.name}");
    expect(GATE15_PUBLIC).toContain("What brings you to Sloe?");
  });

  it("authed Gate 1.5 spec opens log sheet via mobile-web FAB", () => {
    expect(GATE15_AUTHED).toContain("mobile-web-tab-log-button");
    expect(GATE15_AUTHED).toContain("log-sheet-input-mode-row");
    expect(GATE15_AUTHED).toContain("log-sheet-search-input");
  });

  it("every documented Gate 1.5 surface maps to a Playwright spec file", () => {
    for (const row of GATE_15_VISUAL_COVERAGE) {
      const path = resolve(ROOT, "tests/e2e", row.spec);
      const src = readFileSync(path, "utf8");
      expect(src, row.surface).toContain(row.needle);
    }
  });
});
