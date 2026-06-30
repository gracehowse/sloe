/**
 * ENG-728 — import-success "magic moment" web/mobile parity (source-wiring).
 *
 * A CALM one-shot `log-confirm` win-moment over the recipe-import success
 * surface, gated by the NEW default-OFF `import_magic_moment` flag +
 * reduce-motion on BOTH platforms. Flag OFF (the shipped default) → zero visual
 * change, so the headless gate-on/gate-off behaviour is what these source
 * assertions pin (the motion itself needs a sim + web glance before the flag
 * ramps — out of scope for vitest).
 *
 * Same convention as `planWinMomentParity.test.ts`: source-text assertions that
 * break if either platform drops the flag gate, the reduce-motion skip, the
 * `WinMomentPlayer celebration="log-confirm" fullBleed` mount, or the one-shot
 * unmount. They also pin that the flag is REGISTERED in both default-OFF
 * registries so a ramp can target it.
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
  it("registers the flag in BOTH default-OFF registries", () => {
    expect(MOBILE_FLAGS).toContain('"import_magic_moment",');
    expect(WEB_FLAGS).toContain('"import_magic_moment",');
    // Must be inside the KNOWN_DEFAULT_OFF list, not REDESIGN_DEFAULT_ON.
    const mobileBlock = MOBILE_FLAGS.slice(
      MOBILE_FLAGS.indexOf("KNOWN_DEFAULT_OFF_FLAGS"),
    );
    const webBlock = WEB_FLAGS.slice(WEB_FLAGS.indexOf("KNOWN_DEFAULT_OFF_FLAGS"));
    expect(mobileBlock).toContain(`"${FLAG}",`);
    expect(webBlock).toContain(`"${FLAG}",`);
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

  it("flag OFF (default) ships zero overlay — neither platform mounts the player unconditionally", () => {
    // The WinMomentPlayer mount is guarded by `celebrate` (flag && !reduceMotion)
    // on both platforms, so the default-OFF flag renders the sheet verbatim.
    expect(MOBILE_CELEBRATION).toContain("if (!celebrate)");
    expect(WEB_SUCCESS_SHEET).toContain("celebrate && showOverlay ?");
  });
});
