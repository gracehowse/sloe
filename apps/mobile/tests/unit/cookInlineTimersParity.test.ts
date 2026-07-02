/**
 * ENG-945 / ENG-1230 — cook-mode timer parity on the canonical `/cook` screen.
 *
 * After ENG-945, "Cook Mode" on recipe detail routes to `app/cook.tsx` (not the
 * retired inline overlay). Timers live on the rich cook screen + shared
 * `CookTimerPanel` primitives — same posture as web `CookMode.tsx`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const RECIPE_PATH = resolve(__dirname, "../../app/recipe/[id].tsx");
const COOK_PATH = resolve(__dirname, "../../app/cook.tsx");
const PANEL_PATH = resolve(
  __dirname,
  "../../components/cook/CookTimerPanel.tsx",
);

const RECIPE_SOURCE = readFileSync(RECIPE_PATH, "utf8");
const COOK_SOURCE = readFileSync(COOK_PATH, "utf8");
const PANEL_SOURCE = readFileSync(PANEL_PATH, "utf8");

describe("ENG-945 recipe detail — routes to canonical /cook screen", () => {
  it("imports buildCookModeHref and navigates via router.push", () => {
    expect(RECIPE_SOURCE).toMatch(
      /import\s*\{\s*buildCookModeHref\s*\}\s*from\s+["']@\/lib\/navigateToCookMode["']/,
    );
    expect(RECIPE_SOURCE).toMatch(/router\.push\(\s*buildCookModeHref\(/);
  });

  it("does not render the retired inline CookTimerPanel overlay", () => {
    expect(RECIPE_SOURCE).not.toMatch(/<CookTimerPanel\b/);
    expect(RECIPE_SOURCE).not.toMatch(/visible=\{cookMode/);
  });

  it("honours batch-cook ?cook=1 deep link once recipe loads", () => {
    expect(RECIPE_SOURCE).toMatch(/cook\s*!==\s*["']1["']/);
    expect(RECIPE_SOURCE).toMatch(/cookAutoOpenedRef/);
  });
});

describe("ENG-1230 cook.tsx — step timers on the live cook path", () => {
  it("uses the shared multi-timer hook + pills (not a one-off rebuild)", () => {
    expect(COOK_SOURCE).toMatch(/useCookRunningTimers/);
    expect(COOK_SOURCE).toMatch(/CookRunningTimerStrip/);
    expect(COOK_SOURCE).toMatch(/CookStepTimerPills/);
  });

  it("gates concurrent timers behind cook_multi_timers_v1", () => {
    expect(COOK_SOURCE).toMatch(/cook_multi_timers_v1/);
  });
});

describe("ENG-1230 CookTimerPanel — reuses existing primitives (no rebuild)", () => {
  it("uses the shared useCookRunningTimers hook", () => {
    expect(PANEL_SOURCE).toMatch(
      /import\s*\{\s*useCookRunningTimers\s*\}\s*from\s+["']@\/hooks\/useCookRunningTimers["']/,
    );
    expect(PANEL_SOURCE).toMatch(/useCookRunningTimers\(/);
  });

  it("renders the existing CookRunningTimerStrip + CookStepTimerPills", () => {
    expect(PANEL_SOURCE).toMatch(
      /import\s*\{\s*CookRunningTimerStrip\s*\}\s*from\s+["']@\/components\/cook\/CookRunningTimerStrip["']/,
    );
    expect(PANEL_SOURCE).toMatch(
      /import\s*\{\s*CookStepTimerPills\s*\}\s*from\s+["']@\/components\/cook\/CookStepTimerPills["']/,
    );
  });
});
