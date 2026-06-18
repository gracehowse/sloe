/** Playwright project routing — imported by `playwright.config.ts` and unit tests. */

/** Journey / screenshot specs that use the general E2E account (`auth.setup.ts`). */
export const journeyAuthedTestMatch = [
  /journeys\/authenticated-views\.spec\.ts/,
  /journeys\/today-authenticated\.spec\.ts/,
  /journeys\/recipe-create-paste\.spec\.ts/,
  /journeys\/cook-mode\.spec\.ts/,
  /journeys\/core-flows-authed\.spec\.ts/,
  /screenshots\/web-authed-tour\.spec\.ts/,
  /screenshots\/redesign-flags-capture\.spec\.ts/,
  /screenshots\/redesign-populated\.spec\.ts/,
  /screenshots\/today-premium/,
  /ai\//,
] as const;

/** Authed visual specs baselined on the dedicated golden account (`auth.visual-setup.ts`). */
export const visualGoldenAuthedTestMatch = [
  /visual-regression-subpages-authed\.spec\.ts/,
] as const;

/** Authed visual specs baselined on the general E2E account (`auth.setup.ts`). */
export const visualE2EAuthedTestMatch = [
  /visual-audit-authed\.spec\.ts/,
  /visual-regression-deep\.spec\.ts/,
  /visual-redesign-gate15-authed\.spec\.ts/,
] as const;

/** All authed visual specs — excluded from the public `chromium` project. */
export const visualAuthedTestMatch = [
  ...visualGoldenAuthedTestMatch,
  ...visualE2EAuthedTestMatch,
] as const;

export const publicVisualSpecFiles = [
  "tests/e2e/visual-audit.spec.ts",
  "tests/e2e/visual-regression-subpages-public.spec.ts",
  "tests/e2e/visual-redesign-gate15.spec.ts",
] as const;

export const goldenAuthedVisualSpecFiles = [
  "tests/e2e/visual-regression-subpages-authed.spec.ts",
] as const;

export const e2eAuthedVisualSpecFiles = [
  "tests/e2e/visual-audit-authed.spec.ts",
  "tests/e2e/visual-regression-deep.spec.ts",
  "tests/e2e/visual-redesign-gate15-authed.spec.ts",
] as const;

export const authedVisualSpecFiles = [
  ...goldenAuthedVisualSpecFiles,
  ...e2eAuthedVisualSpecFiles,
] as const;

export const allVisualSpecFiles = [...publicVisualSpecFiles, ...authedVisualSpecFiles] as const;
