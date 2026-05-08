/**
 * 2026-05-08 hotfix — pin the voiceLog wrapper to the actual
 * `expo-speech-recognition` API. Pre-fix used `mod.startAsync(...)`
 * and `require("expo-speech-recognition") as ModuleType` (treating the
 * whole namespace as the module), neither of which match the package's
 * API. Result: the require succeeded but every call silently no-op'd
 * → press-and-hold mic did nothing.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");
// Strip comments so JSDoc references to the OLD (broken) API in the
// "why this changed" header don't pollute the not-match assertions.
const SRC = readFileSync(
  resolve(REPO, "apps/mobile/lib/voiceLog.ts"),
  "utf8",
)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/\/\/[^\n]*/g, "");

describe("voiceLog — uses the correct expo-speech-recognition API", () => {
  it("requires the module via the named ExpoSpeechRecognitionModule export", () => {
    expect(SRC).toMatch(/ExpoSpeechRecognitionModule/);
    // Pre-fix shape was `const m = require(...) as SpeechModule` which
    // grabbed the namespace. Post-fix grabs the named export.
    expect(SRC).toMatch(
      /require\(["']expo-speech-recognition["']\)[\s\S]{0,200}ExpoSpeechRecognitionModule/,
    );
  });

  it("calls .start() (not .startAsync)", () => {
    expect(SRC).toMatch(/mod\.start\(/);
    expect(SRC).not.toMatch(/mod\.startAsync\(/);
  });

  it("calls .stop() (not .stopAsync)", () => {
    expect(SRC).toMatch(/mod\.stop\(/);
    expect(SRC).not.toMatch(/mod\.stopAsync\(/);
  });

  it("listens to the correct W3C event names: result, end, error", () => {
    expect(SRC).toMatch(/addListener\(["']result["']/);
    expect(SRC).toMatch(/addListener\(["']end["']/);
    expect(SRC).toMatch(/addListener\(["']error["']/);
  });

  it("handles partial + final results (isFinal flag)", () => {
    expect(SRC).toMatch(/isFinal/);
  });
});
