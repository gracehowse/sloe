/**
 * build-45 bug fix (2026-05-08) — pin the `expo-speech-recognition`
 * package install + plugin config so a future agent doesn't
 * accidentally drop them and break voice logging.
 *
 * Grace's repro: hold-to-record mic on VoiceLogSheet does nothing
 * because `voiceLog.ts` lazy-requires `expo-speech-recognition` and
 * the package wasn't installed → silent fallback to typing-only.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");

function readJson(rel: string): any {
  return JSON.parse(readFileSync(resolve(REPO, rel), "utf8"));
}

describe("build-45 fix — voice recognition package + plugin", () => {
  it("expo-speech-recognition is in apps/mobile/package.json dependencies", () => {
    const pkg = readJson("apps/mobile/package.json");
    expect(pkg.dependencies?.["expo-speech-recognition"]).toBeDefined();
  });

  it("expo-speech-recognition is registered as an Expo plugin with usage strings", () => {
    const cfg = readJson("apps/mobile/app.json");
    const plugins: unknown[] = cfg.expo?.plugins ?? [];
    const entry = plugins.find(
      (p) => Array.isArray(p) && p[0] === "expo-speech-recognition",
    ) as [string, Record<string, string>] | undefined;
    expect(entry, "expo-speech-recognition plugin must be registered").toBeDefined();
    if (entry) {
      const opts = entry[1] ?? {};
      expect(opts.microphonePermission).toMatch(/.+/);
      expect(opts.speechRecognitionPermission).toMatch(/.+/);
    }
  });
});
