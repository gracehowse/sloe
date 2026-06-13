/**
 * Fasting CTAs (WEB) — migration to SupprButton primary
 * (button-system canon, `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 *
 * The fasting timer has exactly ONE action per state:
 *   - Landing → "Start fast"  → `SupprButton` variant="primary" (SOLID
 *     aubergine fill, white label, full pill, no border/shadow).
 *   - In-progress → "End fast" → `SupprButton` variant="primary".
 *
 * Both supersede the retired aubergine-OUTLINE primary
 * (`border-[1.5px] border-primary-solid` + plum label) which read
 * weak/floating on the flat cream ground.
 *
 * Deliberately NOT migrated:
 *   - "Complete fast" keeps the sage `--success` celebration fill when the
 *     goal is met (goal-reached state, not the retired outline).
 *   - Preset window pills + landing quick-start chips (segmented/filter
 *     grammar — SANCTIONED non-migration).
 *
 * Cross-platform parity for the same CTAs is pinned mobile-side in
 * `apps/mobile/tests/unit/fastingButtonSystem.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const FASTING = read("src/app/components/FastingTimer.tsx");

// The retired everyday aubergine-OUTLINE primary.
const OUTLINE_PILL = /border-\[1\.5px\]\s+border-primary-solid/;

describe("Fasting (web) — CTA migration to SupprButton", () => {
  it("imports the shared web SupprButton primitive", () => {
    expect(FASTING).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr\/suppr-button(?:\.tsx)?"/,
    );
  });

  it("'Start fast' (landing) is a SOLID primary — the landing state's ONE action", () => {
    expect(FASTING).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,260}data-testid="fasting-landing-start"[\s\S]{0,160}Start \{fastingWindowLabel\(fastingWindow\)\} fast\s*<\/SupprButton>/,
    );
    // startFast handler preserved (treatment-only migration).
    expect(FASTING).toMatch(
      /data-testid="fasting-landing-start"[\s\S]{0,120}onClick=\{startFast\}|onClick=\{startFast\}[\s\S]{0,120}data-testid="fasting-landing-start"/,
    );
  });

  it("'End fast' (in-progress) is a SOLID primary — the timer's ONE action", () => {
    expect(FASTING).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,260}data-testid="fasting-end-button"[\s\S]{0,160}End fast\s*<\/SupprButton>/,
    );
    // endFast handler + aria-label preserved.
    expect(FASTING).toMatch(
      /<SupprButton\s+variant="primary"\s+onClick=\{endFast\}\s+aria-label="End fast early"/,
    );
  });

  it("'Complete fast' keeps the sage --success celebration fill (NOT migrated, NOT outline)", () => {
    // Goal-reached state is a deliberate success treatment, not the retired
    // outline; it stays a raw button with the sage fill.
    expect(FASTING).toMatch(
      /aria-label="Complete fast"[\s\S]{0,200}bg-\[var\(--success\)\]/,
    );
  });

  it("no fasting CTA regresses to the retired aubergine outline pill", () => {
    expect(FASTING).not.toMatch(OUTLINE_PILL);
  });

  it("SANCTIONED non-migration: preset window pills + quick-start chips stay raw buttons", () => {
    // The window picker + landing chips are segmented/filter grammar — not
    // SupprButtons. Their handlers are unchanged.
    expect(FASTING).toMatch(/data-testid="fasting-window-picker"/);
    expect(FASTING).toMatch(/onClick=\{\(\) => quickStartFast\(w\)\}/);
  });
});
