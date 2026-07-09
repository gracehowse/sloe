/**
 * ENG-1372 slice 2 — Streak freezes zero-collapse (web-only), host-wiring pin.
 *
 * `StreakFreezeCard` (`src/app/components/suppr/streak-freeze-card.tsx`) was
 * extracted out of `ProgressDashboard.tsx` (Batch 4.11's inline "Streak
 * freezes" block) in the same change that added the zero-collapse, so the
 * addition didn't push the pinned 2550-line host over budget. This file pins
 * the HOST wiring (still too large for a full render harness); the
 * component's own render behaviour is covered by
 * `streakFreezeCard.test.tsx` (render test, isolated component).
 *
 * Mobile has no equivalent standalone card — its own comment ("Streak chips
 * were demoted out of the Progress frame... the streak + freeze figures now
 * surface only inside the Week Digest") confirms the figures moved into the
 * Digest instead. This is a web-only fix; there is nothing to collapse on
 * mobile because there is no mobile zero-triad card to begin with.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const WEB = readFileSync(resolve(ROOT, "src/app/components/ProgressDashboard.tsx"), "utf8");
const MOBILE_PROGRESS = readFileSync(
  resolve(ROOT, "apps/mobile/app/(tabs)/progress.tsx"),
  "utf8",
);

describe("Streak freezes zero-collapse — web host wiring", () => {
  it("ProgressDashboard mounts the extracted StreakFreezeCard with the empty_state_grammar_v1 flag", () => {
    expect(WEB).toMatch(/import \{ StreakFreezeCard \} from ".\/suppr\/streak-freeze-card/);
    expect(WEB).toMatch(/<StreakFreezeCard\b/);
    expect(WEB).toMatch(/emptyStateGrammarOn=\{isFeatureEnabled\("empty_state_grammar_v1"\)\}/);
  });

  it("passes through the freeze budget/ledger/streak props the card needs", () => {
    expect(WEB).toMatch(/freezeBudgetMax=\{freezeBudgetMax\}/);
    expect(WEB).toMatch(/freezesAvailable=\{freezesAvailable\}/);
    expect(WEB).toMatch(/freezeLedger=\{freezeLedger\}/);
    expect(WEB).toMatch(/protectedDateKeys=\{protectedStreakInfo\.protectedDateKeys\}/);
  });
});

describe("Streak freezes zero-collapse — mobile (documented non-applicability)", () => {
  it("mobile has no standalone streak-freeze card to collapse (figures live in the Week Digest instead)", () => {
    expect(MOBILE_PROGRESS).not.toMatch(/data-testid="streak-freeze-zero-collapse"/);
    expect(MOBILE_PROGRESS).not.toMatch(/testID="streak-freeze-zero-collapse"/);
  });
});
