/**
 * Wave F (WEB) — Fasting CTA migration to SupprButton
 * (button-system canon, `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 *
 * Wave F is the Fasting + Health-sync + Targets + Weight + Profile + What's-new
 * sweep. On WEB the only surface in Wave F that owns a migrated SupprButton CTA
 * is the fasting timer — the other Wave F surfaces are mobile-only native
 * screens (health-sync, targets, weight-tracker, profile, the LogWeightSheet
 * modal) or, in the What's-new case, a public marketing page whose dismiss is a
 * "← Back to app" `<Link>` rather than a SupprButton "Done" pill. So this web
 * file pins the fasting timer; the full Wave F set is pinned mobile-side in
 * `apps/mobile/tests/unit/waveFButtonSystem.test.ts`.
 *
 * These are source-level structural pins (mirror `plannerButtonSystemWeb` /
 * `fastingButtonSystemWeb`) — they break if a Wave-F CTA regresses to the
 * retired aubergine-OUTLINE pill (`border-[1.5px] border-primary-solid`) or a
 * filled `bg-primary` slab so the migration can't silently drift.
 *
 * Overlap note: the fasting CTAs are also pinned in detail (per-state, with the
 * Complete-fast success carve-out + SANCTIONED preset-chip non-migration) in
 * `tests/unit/fastingButtonSystemWeb.test.ts`. This file keeps a tight Wave-F
 * roll-up so the Wave-F set reads as one system in one place.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const FASTING = read("src/app/components/FastingTimer.tsx");

// The retired everyday aubergine-OUTLINE primary.
const OUTLINE_PILL = /border-\[1\.5px\]\s+border-primary-solid/;

describe("Wave F (web) — Fasting CTAs", () => {
  it("imports the shared web SupprButton primitive", () => {
    expect(FASTING).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"\.\/suppr\/suppr-button(?:\.tsx)?"/,
    );
  });

  it("'Start fast' (landing) is a SOLID primary — the landing state's ONE action", () => {
    expect(FASTING).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,260}data-testid="fasting-landing-start"[\s\S]{0,160}Start \{fastingWindowLabel\(fastingWindow\)\} fast\s*<\/SupprButton>/,
    );
  });

  it("'End fast' (in-progress) is a SOLID primary — the timer's ONE action", () => {
    expect(FASTING).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,260}data-testid="fasting-end-button"[\s\S]{0,160}End fast\s*<\/SupprButton>/,
    );
  });

  it("ANTI-REGRESSION: no fasting CTA falls back to the retired aubergine outline pill", () => {
    expect(FASTING).not.toMatch(OUTLINE_PILL);
  });
});
