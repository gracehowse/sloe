import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Icon-language sweep (ui-critic finding #3, P1).
 *
 * The Suppr design language is `lucide-react-native` everywhere — never
 * `@expo/vector-icons` Ionicons, which has a different stroke language
 * and weight. This test pins four high-traffic surfaces (voice + photo
 * + quick-add + day-strip) so a future refactor can't silently re-add an
 * `Ionicons` import.
 *
 * If a new icon is needed in any of these files, route it via lucide
 * (the `IconSize` token + matching role table in
 * `apps/mobile/constants/theme.ts`).
 */

const REPO_ROOT = resolve(__dirname, "../../../..");

const FILES = [
  "apps/mobile/components/VoiceLogSheet.tsx",
  "apps/mobile/components/PhotoLogSheet.tsx",
  "apps/mobile/components/QuickAddPanel.tsx",
  "apps/mobile/components/charts/DayStrip.tsx",
];

function read(relPath: string): string {
  return readFileSync(resolve(REPO_ROOT, relPath), "utf8");
}

describe("icon-language sweep — no Ionicons in voice/photo/quick-add/day-strip", () => {
  for (const path of FILES) {
    it(`${path} does not import Ionicons`, () => {
      const src = read(path);
      expect(src).not.toMatch(/\bIonicons\b/);
      expect(src).not.toMatch(/from\s+["']@expo\/vector-icons["']/);
    });

    it(`${path} imports from lucide-react-native`, () => {
      const src = read(path);
      expect(src).toMatch(/from\s+["']lucide-react-native["']/);
    });
  }
});
