import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Lock-in regression test — fails if `@expo/vector-icons` re-appears in
 * the four mobile surfaces that ui-critic finding #3 swept to lucide.
 * Replaces stale PR #32; rebuilt on current main per PR-staleness-prevention
 * sweep on 2026-05-02.
 */

const SWEPT_FILES = [
  "components/VoiceLogSheet.tsx",
  "components/PhotoLogSheet.tsx",
  "components/QuickAddPanel.tsx",
  "components/charts/DayStrip.tsx",
] as const;

describe("icon language: no Ionicons in swept files (PR #32 lock-in)", () => {
  for (const path of SWEPT_FILES) {
    it(`apps/mobile/${path} does not import Ionicons / @expo/vector-icons`, () => {
      const src = readFileSync(resolve(__dirname, "../..", path), "utf8");
      expect(src).not.toMatch(/from\s+["']@expo\/vector-icons["']/);
      expect(src).not.toMatch(/\bIonicons\b/);
    });
  }

  it("all four files import from lucide-react-native instead", () => {
    for (const path of SWEPT_FILES) {
      const src = readFileSync(resolve(__dirname, "../..", path), "utf8");
      expect(src, `${path} should import from lucide-react-native`).toMatch(
        /from\s+["']lucide-react-native["']/,
      );
    }
  });
});
