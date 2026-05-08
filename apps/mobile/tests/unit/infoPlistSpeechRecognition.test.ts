/**
 * 2026-05-08 build-46 hotfix — pin NSSpeechRecognitionUsageDescription
 * in ios/Suppr/Info.plist so a future agent can't accidentally remove
 * it and break Apple processing.
 *
 * Repro: build 46 was submitted to App Store Connect twice (12:25 PM
 * + 12:54 PM) and Apple processing failed both times. Root cause:
 * the `expo-speech-recognition` package added in PR #155 links the
 * iOS Speech framework, which requires NSSpeechRecognitionUsageDescription
 * in Info.plist or Apple's automated review fails the binary.
 *
 * In bare-workflow projects (like this one), expo plugin Info.plist
 * additions in app.json don't auto-propagate to ios/Suppr/Info.plist
 * at EAS build time — they only apply if `npx expo prebuild` runs.
 * The actual Info.plist on disk is authoritative.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");
const PLIST = readFileSync(
  resolve(REPO, "apps/mobile/ios/Suppr/Info.plist"),
  "utf8",
);

describe("build-46 hotfix — required Info.plist usage descriptions", () => {
  it("declares NSSpeechRecognitionUsageDescription with non-empty Suppr-branded copy", () => {
    expect(PLIST).toMatch(/<key>NSSpeechRecognitionUsageDescription<\/key>/);
    // Capture the value following the key and assert it's a real
    // sentence (not the default "Allow $(PRODUCT_NAME)…" placeholder).
    const m = PLIST.match(
      /<key>NSSpeechRecognitionUsageDescription<\/key>\s*<string>([^<]+)<\/string>/,
    );
    expect(m, "NSSpeechRecognitionUsageDescription must have a string value").not.toBeNull();
    if (m) {
      const v = m[1] ?? "";
      expect(v.length).toBeGreaterThan(20);
      expect(v).toMatch(/Suppr/);
      expect(v).not.toMatch(/\$\(PRODUCT_NAME\)/);
    }
  });

  it("declares NSMicrophoneUsageDescription with non-default Suppr-branded copy", () => {
    const m = PLIST.match(
      /<key>NSMicrophoneUsageDescription<\/key>\s*<string>([^<]+)<\/string>/,
    );
    expect(m).not.toBeNull();
    if (m) {
      const v = m[1] ?? "";
      // The pre-fix value was the default boilerplate "Allow
      // $(PRODUCT_NAME) to access your microphone". Apple processing
      // doesn't fail on it, but it shows up unbranded in the OS
      // permission prompt and reads as placeholder.
      expect(v).not.toMatch(/\$\(PRODUCT_NAME\)/);
      expect(v).toMatch(/Suppr/);
    }
  });
});
