/**
 * ENG-728 — import-success "magic moment" web/mobile parity (source-wiring).
 *
 * A CALM one-shot `log-confirm` win-moment over the recipe-import success
 * surface, gated by `import_magic_moment` (default-ON since 2026-06-30, ENG-1279
 * "always flag on") + reduce-motion on BOTH platforms. Flag OFF → zero visual
 * change, so the headless gate-on/gate-off behaviour is what these source
 * assertions pin (the motion itself needs Grace's sim + web glance — out of
 * scope for vitest).
 *
 * Same convention as `planWinMomentParity.test.ts`: source-text assertions that
 * break if either platform drops the flag gate, the reduce-motion skip, the
 * `WinMomentPlayer celebration="log-confirm" fullBleed` mount, or the one-shot
 * unmount. They also pin that the flag is REGISTERED default-ON in both
 * REDESIGN_DEFAULT_ON registries (the kill switch targets it there).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const FLAG = "import_magic_moment";

const MOBILE_CELEBRATION = readFileSync(
  resolve(__dirname, "../../components/import/ImportSuccessCelebration.tsx"),
  "utf8",
);
const MOBILE_IMPORT_SCREEN = readFileSync(
  resolve(__dirname, "../../app/import-shared.tsx"),
  "utf8",
);
const WEB_SUCCESS_SHEET = readFileSync(
  resolve(__dirname, "../../../../src/app/components/suppr/import-success-sheet.tsx"),
  "utf8",
);
const MOBILE_FLAGS = readFileSync(
  resolve(__dirname, "../../lib/analytics.ts"),
  "utf8",
);
const WEB_FLAGS = readFileSync(
  resolve(__dirname, "../../../../src/lib/analytics/track.ts"),
  "utf8",
);

describe("import magic-moment parity (ENG-728)", () => {
  it("registers the flag DEFAULT-ON in BOTH REDESIGN_DEFAULT_ON registries", () => {
    // Flipped default-ON 2026-06-30 (ENG-1279 "always flag on").
    const mOn = MOBILE_FLAGS.indexOf("REDESIGN_DEFAULT_ON = new Set");
    const wOn = WEB_FLAGS.indexOf("REDESIGN_DEFAULT_ON = new Set");
    expect(MOBILE_FLAGS.slice(mOn, MOBILE_FLAGS.indexOf("]);", mOn))).toContain(`"${FLAG}",`);
    expect(WEB_FLAGS.slice(wOn, WEB_FLAGS.indexOf("]);", wOn))).toContain(`"${FLAG}",`);
    // And NOT in the default-OFF list (a flag belongs to exactly one set).
    const mOff = MOBILE_FLAGS.indexOf("KNOWN_DEFAULT_OFF_FLAGS = [");
    const wOff = WEB_FLAGS.indexOf("KNOWN_DEFAULT_OFF_FLAGS = [");
    expect(MOBILE_FLAGS.slice(mOff, MOBILE_FLAGS.indexOf("]", mOff))).not.toContain(`"${FLAG}",`);
    expect(WEB_FLAGS.slice(wOff, WEB_FLAGS.indexOf("]", wOff))).not.toContain(`"${FLAG}",`);
  });

  it("both platforms gate the celebration behind the same flag", () => {
    expect(MOBILE_CELEBRATION).toContain(`isFeatureEnabled("${FLAG}")`);
    expect(WEB_SUCCESS_SHEET).toContain(`isFeatureEnabled("${FLAG}")`);
  });

  it("both platforms skip the celebration under reduce-motion (instant, no overlay)", () => {
    // Mobile uses the AccessibilityInfo-backed hook; web reads the media query.
    expect(MOBILE_CELEBRATION).toContain("useReduceMotion");
    expect(MOBILE_CELEBRATION).toContain("enabled && !reduceMotion");
    expect(WEB_SUCCESS_SHEET).toContain("prefers-reduced-motion");
    expect(WEB_SUCCESS_SHEET).toContain("enabled && !reduceMotion");
  });

  it("both platforms mount a CALM log-confirm WinMomentPlayer full-bleed (not goal-hit)", () => {
    expect(MOBILE_CELEBRATION).toContain("WinMomentPlayer");
    expect(MOBILE_CELEBRATION).toContain('celebration="log-confirm"');
    expect(MOBILE_CELEBRATION).toContain("fullBleed");
    expect(MOBILE_CELEBRATION).not.toContain('celebration="goal-hit"');

    expect(WEB_SUCCESS_SHEET).toContain("WinMomentPlayer");
    expect(WEB_SUCCESS_SHEET).toContain('celebration="log-confirm"');
    expect(WEB_SUCCESS_SHEET).toContain("fullBleed");
    expect(WEB_SUCCESS_SHEET).not.toContain('celebration="goal-hit"');
  });

  it("both platforms play the overlay ONCE then unmount (no replay on re-render)", () => {
    // A `showOverlay` state flipped false in onComplete is the one-shot guard.
    expect(MOBILE_CELEBRATION).toContain("setShowOverlay(false)");
    expect(MOBILE_CELEBRATION).toContain("showOverlay ?");
    expect(WEB_SUCCESS_SHEET).toContain("setShowOverlay(false)");
    expect(WEB_SUCCESS_SHEET).toContain("showOverlay ?");
  });

  it("both overlays share the same testID so a sim/web glance can find them", () => {
    expect(MOBILE_CELEBRATION).toContain('testID="import-magic-moment"');
    expect(WEB_SUCCESS_SHEET).toContain('testID="import-magic-moment"');
  });

  it("the mobile import screen wires the success sheet through the celebration wrapper", () => {
    // The success branch must render via ImportSuccessCelebration, not a bare View.
    expect(MOBILE_IMPORT_SCREEN).toContain(
      "import { ImportSuccessCelebration } from \"@/components/import/ImportSuccessCelebration\"",
    );
    expect(MOBILE_IMPORT_SCREEN).toContain(
      "<ImportSuccessCelebration sheetStyle={styles.successSheet}>",
    );
  });

  it("flag OFF ships zero overlay — neither platform mounts the player unconditionally", () => {
    // The WinMomentPlayer mount is guarded by `celebrate` (flag && !reduceMotion)
    // on both platforms, so the default-OFF flag renders the sheet verbatim.
    expect(MOBILE_CELEBRATION).toContain("if (!celebrate)");
    expect(WEB_SUCCESS_SHEET).toContain("celebrate && showOverlay ?");
  });
});
