/**
 * Fasting CTAs (MOBILE) — migration to SupprButton primary
 * (button-system canon, `docs/decisions/2026-06-12-button-system-solid-primary.md`).
 *
 * The fasting timer has exactly ONE action per state:
 *   - Landing → "Start fast"      → `SupprButton` variant="primary" (SOLID
 *     aubergine fill, white label, full pill, no border).
 *   - In-progress → "Hold to end fast" → `SupprButton` variant="primary",
 *     with hold-to-confirm (onLongPress → endFast; tap → confirm hint)
 *     preserved so a stray tap can't kill an active fast.
 *
 * Both supersede the retired aubergine-OUTLINE primary
 * (`borderWidth: 1.5` + `borderColor: accent.primarySolid` + plum label).
 *
 * Deliberately NOT migrated:
 *   - "Complete fast" keeps the sage `Accent.success` celebration fill when
 *     the goal is met (goal-reached state, not the retired outline).
 *   - Preset window pills + landing quick-start chips (segmented/filter
 *     grammar — SANCTIONED non-migration).
 *
 * Web parity for the same CTAs is pinned in
 * `tests/unit/fastingButtonSystemWeb.test.ts`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (p: string) => readFileSync(resolve(__dirname, "..", "..", p), "utf8");

const FASTING = read("app/fasting.tsx");
const SUPPR_BUTTON = read("components/ui/SupprButton.tsx");

describe("Fasting (mobile) — CTA migration to SupprButton", () => {
  it("imports the shared mobile SupprButton primitive", () => {
    expect(FASTING).toMatch(
      /import\s*\{\s*SupprButton\s*\}\s*from\s*"@\/components\/ui\/SupprButton"/,
    );
  });

  it("'Start fast' (landing) is a SOLID primary — the landing state's ONE action", () => {
    expect(FASTING).toMatch(
      /<SupprButton[\s\S]{0,200}testID="fasting-landing-start"[\s\S]{0,200}variant="primary"[\s\S]{0,200}label="Start fast"/,
    );
    // startFast handler + dynamic-window accessibilityLabel preserved.
    expect(FASTING).toMatch(/accessibilityLabel=\{`Start a \$\{fastingWindowLabel\(fastingWindow\)\} fast`\}/);
    expect(FASTING).toMatch(/testID="fasting-landing-start"[\s\S]{0,260}onPress=\{startFast\}/);
  });

  it("'End fast' (in-progress) is a SOLID primary with hold-to-confirm preserved", () => {
    expect(FASTING).toMatch(/<SupprButton\s+variant="primary"\s+style=\{styles\.endBtn\}/);
    // Hold-to-confirm gesture preserved: long-press ends, tap surfaces the hint.
    expect(FASTING).toMatch(
      /<SupprButton\s+variant="primary"[\s\S]{0,600}onLongPress=\{\(\) => \{[\s\S]{0,200}endFast\(\);/,
    );
    expect(FASTING).toMatch(/<SupprButton\s+variant="primary"[\s\S]{0,800}delayLongPress=\{650\}/);
    // Warning-haptic-on-tap + confirm Alert preserved.
    expect(FASTING).toMatch(/NotificationFeedbackType\.Warning/);
  });

  it("'Complete fast' keeps the sage Accent.success celebration fill (NOT migrated, NOT outline)", () => {
    expect(FASTING).toMatch(
      /<Pressable\s+style=\{\[styles\.endBtn,\s*\{ backgroundColor: Accent\.success \}\]\}[\s\S]{0,160}Complete fast/,
    );
  });

  it("no fasting CTA regresses to the retired aubergine outline (borderWidth 1.5 + primarySolid border)", () => {
    expect(FASTING).not.toMatch(/borderColor:\s*accent\.primarySolid/);
    expect(FASTING).not.toMatch(/borderWidth:\s*1\.5/);
  });

  it("the endBtn style is layout-only (margins/shape) — the primitive owns fill/label colour", () => {
    expect(FASTING).not.toMatch(/endBtn:\s*\{[\s\S]{0,200}backgroundColor:\s*accent/);
  });

  it("SANCTIONED non-migration: preset window pills stay raw Pressables; duplicate landing chips stay removed", () => {
    // The landing quick-start chips were removed in ENG-1302 (they
    // duplicated the picker; v3 prototype = one Start CTA + one chooser).
    expect(FASTING).toMatch(/testID="fasting-window-picker"/);
    expect(FASTING).not.toMatch(/fasting-landing-chips/);
    expect(FASTING).not.toMatch(/quickStartFast/);
  });
});

describe("SupprButton (mobile) — long-press contract for safety-critical CTAs", () => {
  it("forwards onLongPress / delayLongPress / onPressIn to the underlying pressable", () => {
    expect(SUPPR_BUTTON).toMatch(/onLongPress\?:\s*\(\)\s*=>\s*void/);
    expect(SUPPR_BUTTON).toMatch(/delayLongPress\?:\s*number/);
    expect(SUPPR_BUTTON).toMatch(/onLongPress=\{onLongPress \? handleLongPress : undefined\}/);
    expect(SUPPR_BUTTON).toMatch(/delayLongPress=\{delayLongPress\}/);
  });

  it("blocks long-press while disabled/loading (no commit on a blocked button)", () => {
    expect(SUPPR_BUTTON).toMatch(/handleLongPress[\s\S]{0,80}if \(blocked\) return;[\s\S]{0,40}onLongPress\?\.\(\)/);
  });
});
