/**
 * Build-12 H-5 — structural component-level pin for the "Day total vs goal"
 * summary line. TestFlight `AH8csBqtZsBJJr0uHgXyEcE` (2026-04-19): "Plan
 * doesn't tell me how close it is to my macro targets."
 *
 * A full render of `MealPlanner` requires the whole `AppDataContext` and
 * Supabase client — heavy for a pin test. The compute path is already
 * covered by `dayTotalVsGoal.test.ts`. What we need to guarantee here is
 * that the *wiring* isn't silently dropped: both platforms must call the
 * shared helper, render a line tagged `day-total-vs-goal-<day>`, and
 * apply the three tone classes / colours. A source-level grep locks
 * those contract points on both files.
 *
 * Mirrors the pattern used by `householdCardParity.test.ts` and
 * `householdMemberNumberLabels.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const WEB_PATH = resolve(__dirname, "../../src/app/components/MealPlanner.tsx");
const MOBILE_PATH = resolve(
  __dirname,
  "../../apps/mobile/app/(tabs)/planner.tsx",
);

const WEB_SRC = readFileSync(WEB_PATH, "utf8");
const MOBILE_SRC = readFileSync(MOBILE_PATH, "utf8");

describe("web MealPlanner — day total vs goal line", () => {
  it("imports the shared helper (not reinvented inline)", () => {
    expect(WEB_SRC).toMatch(
      /from\s+["'][^"']*lib\/planning\/dayTotalVsGoal[^"']*["']/,
    );
    expect(WEB_SRC).toMatch(/\bbuildDayTotalVsGoalLine\b/);
    expect(WEB_SRC).toMatch(/\bformatDayTotalCell\b/);
  });

  it("renders a testID'd summary line per day", () => {
    // Template literal form: `day-total-vs-goal-${dp.day}`
    expect(WEB_SRC).toMatch(/data-testid=\{`day-total-vs-goal-\$\{dp\.day\}`\}/);
  });

  it("gates rendering on hasTargets (new accounts get no line, never '—')", () => {
    expect(WEB_SRC).toMatch(/goalLine\.hasTargets\s*\?/);
    // Explicit null branch — the ternary must close with `null`, not
    // a fallback string, so the line is genuinely omitted.
    expect(WEB_SRC).toMatch(/goalLine\.hasTargets\s*\?[\s\S]+?:\s*null/);
  });

  it("maps each tone to a distinct class (neutral / amber / red)", () => {
    // The web component's toneClassDayTotal helper maps the three tones.
    expect(WEB_SRC).toMatch(/text-muted-foreground/); // neutral
    expect(WEB_SRC).toMatch(/text-warning/); // amber
    expect(WEB_SRC).toMatch(/text-destructive/); // red
  });

  it("labels the line with 'Day total'", () => {
    expect(WEB_SRC).toMatch(/Day total/);
  });
});

describe("mobile planner — day total vs goal line", () => {
  it("imports the shared helper (not reinvented inline)", () => {
    expect(MOBILE_SRC).toMatch(
      /from\s+["'][^"']*lib\/planning\/dayTotalVsGoal["']/,
    );
    expect(MOBILE_SRC).toMatch(/\bbuildDayTotalVsGoalLine\b/);
    expect(MOBILE_SRC).toMatch(/\bformatDayTotalCell\b/);
  });

  it("renders a testID'd summary line per day", () => {
    expect(MOBILE_SRC).toMatch(/testID=\{`day-total-vs-goal-\$\{dp\.day\}`\}/);
  });

  it("gates rendering on hasTargets (new accounts get no line)", () => {
    // mobile path: `{goalLine && goalLine.hasTargets && (...)}`
    expect(MOBILE_SRC).toMatch(/goalLine\s*&&\s*goalLine\.hasTargets/);
  });

  it("maps each tone to a distinct colour (neutral / amber / red)", () => {
    // toneColor helper: neutral → textSecondary, amber → warning, red → destructive
    expect(MOBILE_SRC).toMatch(/Accent\.warning/);
    expect(MOBILE_SRC).toMatch(/Accent\.destructive/);
    // `colors.textSecondary` is used elsewhere in the file; the key
    // pin is that the tone helper exists and maps "neutral" to it.
    expect(MOBILE_SRC).toMatch(
      /tone === "neutral"[\s\S]*?colors\.textSecondary/,
    );
  });

  it("labels the line with 'Day total'", () => {
    expect(MOBILE_SRC).toMatch(/Day total/);
  });
});

describe("parity — both platforms call the same helper", () => {
  it("both surfaces import from src/lib/planning/dayTotalVsGoal", () => {
    expect(WEB_SRC).toMatch(/lib\/planning\/dayTotalVsGoal/);
    expect(MOBILE_SRC).toMatch(/lib\/planning\/dayTotalVsGoal/);
  });

  it("both surfaces key the testID on the day number", () => {
    // Keeps E2E / Maestro selectors identical between platforms.
    expect(WEB_SRC).toMatch(/day-total-vs-goal-\$\{dp\.day\}/);
    expect(MOBILE_SRC).toMatch(/day-total-vs-goal-\$\{dp\.day\}/);
  });

  it("both surfaces render the 'Day total' label", () => {
    expect(WEB_SRC).toMatch(/Day total/);
    expect(MOBILE_SRC).toMatch(/Day total/);
  });
});
