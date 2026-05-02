/**
 * iOS Info.plist — voice handsfree microphone usage description
 * (legal P1, 2026-05-02).
 *
 * Pins that `NSMicrophoneUsageDescription` is registered with the
 * canonical copy approved by the legal review. iOS rejects builds
 * that request mic access without an Info.plist string — but it
 * also doesn't surface the violation until the user hits the
 * permission prompt. This test catches the regression at CI time.
 *
 * Mirrors the pattern in `cookHandsfreeAgeGate.test.ts` — pin the
 * legal-sensitive contract in code so a future edit fails fast.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

type Plist = Record<string, string | boolean>;
type AppJson = {
  expo: {
    ios: {
      infoPlist: Plist;
    };
  };
};

const APP_JSON_PATH = resolve(__dirname, "../../app.json");
const APP_JSON = JSON.parse(readFileSync(APP_JSON_PATH, "utf8")) as AppJson;
const plist = APP_JSON.expo.ios.infoPlist;

describe("iOS Info.plist — voice handsfree usage descriptions", () => {
  it("registers NSMicrophoneUsageDescription with the canonical copy", () => {
    const value = plist.NSMicrophoneUsageDescription;
    expect(typeof value).toBe("string");
    expect(value).toBe(
      'Suppr listens for cooking commands like "next", "back", and "repeat" only while you turn on Voice Control inside Cook Mode. Audio is never saved.',
    );
  });

  it("registers NSSpeechRecognitionUsageDescription so iOS Speech framework can start", () => {
    // iOS Speech framework rejects `start()` if either Mic or
    // SpeechRecognition prompts are missing. We register both so the
    // listener actually fires when permitted.
    const value = plist.NSSpeechRecognitionUsageDescription;
    expect(typeof value).toBe("string");
    expect(String(value)).toMatch(/on-device/i);
  });
});
