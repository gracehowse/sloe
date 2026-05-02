/**
 * Cook handsfree v2 — structural source tests (2026-05-02).
 *
 * Source-level pins for the cook screen's v2 wiring. We use grep-
 * level assertions because `apps/mobile/app/cook.tsx` mounts
 * Expo-router + useKeepAwake + the speech-recognition listener,
 * which the vitest/jsdom environment cannot fully drive without an
 * intrusive mock harness. The structural assertions are sufficient
 * to catch the most common regressions:
 *
 *   - Banner-copy flips that move v1 / v2 strings around.
 *   - Removal of the feature-flag gate.
 *   - Removal of the listener teardown (privacy-sensitive — the
 *     listener MUST stop on unmount, blur, toggle-off, isDone).
 *   - Removal of the age-gate / on-device-support gates.
 *
 * If you need higher-fidelity test coverage on the listener
 * lifecycle, drive it through the helper modules
 * (`cookHandsfree.ts` / `cookHandsfreeListener.ts`) where it can be
 * tested in isolation — the cook screen orchestrates those helpers
 * but doesn't own the lifecycle logic.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const COOK_PATH = resolve(__dirname, "../../app/cook.tsx");
const SOURCE = readFileSync(COOK_PATH, "utf8");

describe("cook handsfree v2 — source structural pins", () => {
  describe("feature flag gate", () => {
    it("imports COOK_HANDSFREE_FEATURE_ENABLED from the helper module", () => {
      expect(SOURCE).toMatch(/COOK_HANDSFREE_FEATURE_ENABLED/);
      expect(SOURCE).toMatch(
        /from\s+["']@\/lib\/cookHandsfree["']/,
      );
    });

    it("guards v2 banner / listener / consent surface behind the flag", () => {
      // Every v2 surface should reference the flag at least once.
      // Stripping the flag would orphan the v1 fallback path.
      expect(
        (SOURCE.match(/COOK_HANDSFREE_FEATURE_ENABLED/g) ?? []).length,
      ).toBeGreaterThanOrEqual(3);
    });
  });

  describe("v1 banner (flag-off path)", () => {
    it("preserves the v1 transparency copy verbatim", () => {
      // If you change this copy, update the v2 decision doc + the
      // legal review artefacts. The v1 banner is the user-facing
      // claim while the flag is dark.
      expect(SOURCE).toContain("Screen stays awake while you cook.");
      // The apostrophe is HTML-encoded (`&apos;`) inside the JSX
      // string — that's how RN escapes literals in JSX text. The
      // user-facing render decodes it.
      expect(SOURCE).toContain("We don&apos;t record audio yet.");
    });
  });

  describe("v2 banner (flag-on + consent path)", () => {
    it("renders the canonical listening-hint copy", () => {
      expect(SOURCE).toContain(
        "Listening. Say next, back, repeat, pause, or resume.",
      );
    });

    it("ships a one-shot dismiss control wired to writeHandsfreeHintSeen", () => {
      expect(SOURCE).toMatch(/writeHandsfreeHintSeen/);
      expect(SOURCE).toMatch(/cook-handsfree-banner-dismiss/);
    });
  });

  describe("age gate (legal P0)", () => {
    it("imports + applies resolveHandsfreeAgeGate", () => {
      expect(SOURCE).toMatch(/resolveHandsfreeAgeGate/);
      expect(SOURCE).toMatch(/ageGateTooltip/);
    });

    it("renders the age-gate tooltip in the toggle's accessibility label/hint", () => {
      // The tooltip must be reachable via VoiceOver — exposing it
      // only via a visible bubble would fail accessibility review.
      expect(SOURCE).toMatch(/accessibilityHint=\{toggleTooltip/);
    });
  });

  describe("on-device support gate (privacy)", () => {
    it("imports isOnDeviceRecognitionSupported and disables the toggle when false", () => {
      expect(SOURCE).toMatch(/isOnDeviceRecognitionSupported/);
      // Tooltip wording must match the design spec exactly.
      expect(SOURCE).toContain("Voice control isn't supported on this device.");
    });
  });

  describe("listener lifecycle (privacy non-negotiable)", () => {
    it("tears down the listener on unmount", () => {
      // Cleanup return inside a useEffect with an empty dep array
      // (or one that depends on stopListening) — this is the unmount
      // teardown.
      expect(SOURCE).toMatch(/return\s*\(\)\s*=>\s*\{[\s\S]*stopListening\(\)/);
    });

    it("tears down the listener on screen blur (useFocusEffect)", () => {
      expect(SOURCE).toMatch(/useFocusEffect/);
    });

    it("tears down the listener when isDone becomes true", () => {
      expect(SOURCE).toMatch(/if \(isDone\) stopListening\(\)/);
    });
  });

  describe("consent flow", () => {
    it("renders CookHandsfreeConsentSheet inside the screen", () => {
      expect(SOURCE).toMatch(/<CookHandsfreeConsentSheet\b/);
      expect(SOURCE).toMatch(
        /from\s+["']@\/components\/cook\/CookHandsfreeConsentSheet["']/,
      );
    });

    it("only opens the sheet on first toggle ON (consentGiven gate)", () => {
      expect(SOURCE).toMatch(/if \(!consentGiven\)/);
      expect(SOURCE).toMatch(/setConsentSheetVisible\(true\)/);
    });
  });

  describe("analytics events", () => {
    it("fires cook_handsfree_command_detected with latencyMs", () => {
      expect(SOURCE).toMatch(
        /AnalyticsEvents\.cook_handsfree_command_detected/,
      );
      expect(SOURCE).toMatch(/latencyMs/);
    });

    it("fires cook_handsfree_miss_threshold_hit with kept/turned_off action", () => {
      expect(SOURCE).toMatch(
        /AnalyticsEvents\.cook_handsfree_miss_threshold_hit/,
      );
      expect(SOURCE).toMatch(/action: "kept"/);
      expect(SOURCE).toMatch(/action: "turned_off"/);
    });
  });

  describe("haptics on detected command", () => {
    it("fires Haptics.impactAsync(Light) on a recognised command", () => {
      // Light haptic confirms the command was understood without
      // shouting at the user mid-cook.
      expect(SOURCE).toMatch(
        /Haptics\.impactAsync\(Haptics\.ImpactFeedbackStyle\.Light\)/,
      );
    });
  });

  describe("transcript chip + repeat TTS", () => {
    it("renders a Heard: transcript chip for 220ms feedback", () => {
      expect(SOURCE).toMatch(/Heard:/);
      expect(SOURCE).toMatch(/cook-handsfree-transcript/);
    });

    it("uses expo-speech to read the current step on the repeat command", () => {
      // Wrapped require keeps expo-speech out of the v1 bundle path.
      expect(SOURCE).toMatch(/require\(["']expo-speech["']\)/);
      expect(SOURCE).toMatch(/Speech\.speak\(stepText/);
    });
  });
});
