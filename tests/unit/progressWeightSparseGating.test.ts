/**
 * ENG-1372 slice 2 — Progress weight sparse-state HOST gating (source pins).
 *
 * Both hosts (`apps/mobile/app/(tabs)/progress.tsx`, web
 * `src/app/components/ProgressDashboard.tsx`) must mount the sparse state
 * (`WeightSparseState` / `ProgressWeightEmptyState`) whenever there are FEWER
 * THAN 2 real weigh-ins AND `empty_state_grammar_v1` is on — closing the gap
 * where the old ENG-1225 gate (`progress_weight_empty` /
 * `web_progress_weight_empty`) only covered the 0-point case, leaving a
 * 1-weigh-in user with a hero numeral over an empty chart slot (neither the
 * old sparse component nor the canonical chart mounts at exactly 1 point).
 *
 * These are source-grep pins (both host files are pinned in
 * `scripts/screen-line-budget.json` and too large for a full render
 * harness); the render-level behaviour of the sparse components themselves
 * is covered by `weightSparseState.test.tsx` (mobile) and
 * `progressWeightSparseStateWeb.test.tsx` (web).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = resolve(__dirname, "../..");
const MOBILE = readFileSync(resolve(ROOT, "apps/mobile/app/(tabs)/progress.tsx"), "utf8");
const WEB = readFileSync(resolve(ROOT, "src/app/components/ProgressDashboard.tsx"), "utf8");

describe("Progress weight sparse-state gating — mobile", () => {
  it("mounts WeightSparseState whenever points.length < 2 AND empty_state_grammar_v1 is on", () => {
    expect(MOBILE).toMatch(
      /weightChartTrend\.points\.length < 2 && isFeatureEnabled\("empty_state_grammar_v1"\)/,
    );
    expect(MOBILE).toMatch(/<WeightSparseState\b/);
  });

  it("no longer gates on the superseded ENG-1225 progress_weight_empty flag", () => {
    expect(MOBILE).not.toMatch(/isFeatureEnabled\("progress_weight_empty"\)/);
  });

  it("passes goalKg through so the sparse state can draw its goal band/projection", () => {
    expect(MOBILE).toMatch(/<WeightSparseState[\s\S]{0,200}goalKg=\{goalWeightKg/);
  });

  it("the canonical WeightChart still requires >=2 points (mutually exclusive with the sparse branch)", () => {
    expect(MOBILE).toMatch(/weightChartTrend\.points\.length >= 2 \? \(/);
  });
});

describe("Progress weight sparse-state gating — web", () => {
  it("mounts ProgressWeightEmptyState whenever weightChartData.length < 2 AND empty_state_grammar_v1 is on", () => {
    expect(WEB).toMatch(
      /weightChartData\.length < 2 && isFeatureEnabled\("empty_state_grammar_v1"\)/,
    );
    expect(WEB).toMatch(/<ProgressWeightEmptyState\b/);
  });

  it("no longer gates on the superseded ENG-1225 web_progress_weight_empty flag", () => {
    expect(WEB).not.toMatch(/isFeatureEnabled\("web_progress_weight_empty"\)/);
  });

  it("wires the empty-state CTA to focus the existing inline Log-weight input (no new modal)", () => {
    expect(WEB).toMatch(/onLogWeight=\{\(\) => weightInputRef\.current\?\.focus\(\)\}/);
    expect(WEB).toMatch(/ref=\{weightInputRef\}/);
  });

  it("the recharts LineChart still requires >=2 points (mutually exclusive with the sparse branch)", () => {
    expect(WEB).toMatch(/weightChartData\.length >= 2 &&/);
  });
});
