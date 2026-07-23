/**
 * Calorie-ring colour rule — structural pins (mobile + web).
 *
 * web ring parity 2026-06-10 (mobile ring wave): the ring is PLUM in every
 * state — under AND over budget. The over verdict lives in the centre +
 * status chip, NOT in a recoloured arc and NOT in a second overage lap (the
 * 2026-06-04 Apple-wrap lap was retired in the same wave). These source-text
 * pins break if either platform reintroduces a destructive recolour, a hash
 * texture, or a second lap.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const MOBILE_PATH = resolve(
  __dirname,
  "../../apps/mobile/components/charts/CalorieRing.tsx",
);
const MOBILE_CENTER_PATH = resolve(
  __dirname,
  "../../apps/mobile/components/charts/calorieRing/CalorieRingCenter.tsx",
);
const WEB_PATH = resolve(
  __dirname,
  "../../src/app/components/suppr/daily-ring.tsx",
);

const MOBILE_SRC = readFileSync(MOBILE_PATH, "utf8");
const MOBILE_CENTER_SRC = readFileSync(MOBILE_CENTER_PATH, "utf8");
const WEB_SRC = readFileSync(WEB_PATH, "utf8");

describe("Sloe calorie ring — mobile CalorieRing", () => {
  it("ring is PLUM in every state, NOT recoloured destructive when over", () => {
    expect(MOBILE_SRC).toMatch(/const ringStateColor = calorieRingColor/);
    expect(MOBILE_SRC).not.toMatch(
      /ringStateColor = isOver \? Accent\.destructive/,
    );
  });

  it("over budget caps at full — NO overage lap, NO hash, NO over-arc recolour", () => {
    // The lap was retired (2026-06-10): no overageLapColor, no overHash pattern.
    expect(MOBILE_SRC).not.toMatch(/overageLapColor/);
    expect(MOBILE_SRC).not.toMatch(/stroke="url\(#overHash\)"/);
    expect(MOBILE_SRC).not.toMatch(/id="overHash"/);
    expect(MOBILE_SRC).not.toMatch(/const overArcColor/);
  });

  it("centre number + label use textColor (ink), not ring stroke hue", () => {
    // Centre ink styles live in CalorieRingCenter after ENG-1565 extraction.
    expect(MOBILE_CENTER_SRC).toMatch(/color: textColor/);
    expect(MOBILE_CENTER_SRC).not.toMatch(/color: ringStateColor/);
  });
});

describe("Sloe calorie ring — web DailyRing", () => {
  it("logged arc stays plum in every state; NO overage-lap token, NO hash", () => {
    expect(WEB_SRC).toMatch(/var\(--macro-calories\)/);
    // The overage lap + its tokens are retired — the arc renders the only lap.
    expect(WEB_SRC).not.toMatch(/var\(--ring-overage-lap\)/);
    expect(WEB_SRC).not.toMatch(/data-testid="daily-ring-overage-lap"/);
    expect(WEB_SRC).not.toMatch(/url\(#overHash\)/);
    expect(WEB_SRC).not.toMatch(
      /isOverBudget[\s\S]{0,40}\?\s*"var\(--destructive\)"/,
    );
  });

  it("centre number + label use the foreground ink in every state", () => {
    expect(WEB_SRC).toMatch(/const centerValueColor = "var\(--foreground\)"/);
  });
});
