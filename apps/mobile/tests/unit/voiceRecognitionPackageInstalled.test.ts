/**
 * build-46 hotfix (2026-05-08) — pin both the package install AND
 * the iOS Info.plist usage strings.
 *
 * Apple error 90683 failed two build-46 submissions because the
 * `expo-speech-recognition` package links the iOS Speech framework
 * but its config plugin only handles Android — iOS purpose strings
 * must be declared via `expo.ios.infoPlist` in app.json (which EAS
 * prebuild propagates into the generated Info.plist; the on-disk
 * `apps/mobile/ios/` is gitignored and regenerated each build).
 *
 * If a future agent removes the package, the plugin entry, or the
 * required Info.plist keys, this test surfaces it.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const REPO = resolve(__dirname, "..", "..", "..", "..");

function readJson(rel: string): any {
  return JSON.parse(readFileSync(resolve(REPO, rel), "utf8"));
}

describe("build-45/46 — voice recognition package + plugin + iOS purpose strings", () => {
  const cfg = readJson("apps/mobile/app.json");
  const pkg = readJson("apps/mobile/package.json");

  it("expo-speech-recognition is in apps/mobile/package.json dependencies", () => {
    expect(pkg.dependencies?.["expo-speech-recognition"]).toBeDefined();
  });

  it("expo-speech-recognition is registered as an Expo plugin", () => {
    const plugins: unknown[] = cfg.expo?.plugins ?? [];
    const present = plugins.some(
      (p) =>
        p === "expo-speech-recognition" ||
        (Array.isArray(p) && p[0] === "expo-speech-recognition"),
    );
    expect(present, "expo-speech-recognition plugin must be registered").toBe(true);
  });

  it("ios.infoPlist declares NSSpeechRecognitionUsageDescription with Sloe-branded copy", () => {
    const infoPlist = cfg.expo?.ios?.infoPlist ?? {};
    const v = infoPlist.NSSpeechRecognitionUsageDescription;
    expect(typeof v, "NSSpeechRecognitionUsageDescription must be a string").toBe("string");
    expect(v.length).toBeGreaterThan(20);
    expect(v).toMatch(/Sloe/);
    // Apple boilerplate placeholder must be gone.
    expect(v).not.toMatch(/\$\(PRODUCT_NAME\)/);
  });

  it("ios.infoPlist declares NSMicrophoneUsageDescription with non-default copy", () => {
    const infoPlist = cfg.expo?.ios?.infoPlist ?? {};
    const v = infoPlist.NSMicrophoneUsageDescription;
    expect(typeof v, "NSMicrophoneUsageDescription must be a string").toBe("string");
    expect(v).toMatch(/Sloe/);
    expect(v).not.toMatch(/\$\(PRODUCT_NAME\)/);
  });

  // ENG-1542 — the speech purpose string must not contradict the code.
  // `listenForSpeech()` in apps/mobile/lib/voiceLog.ts does NOT pass
  // `requiresOnDeviceRecognition: true`, so iOS may route audio to Apple's
  // servers. An absolute on-device claim ("Audio stays on your phone") was
  // therefore false. This couples the claim to the code: the string may only
  // promise on-device processing if the code actually forces it.
  it("speech purpose string does not claim on-device unless the code forces it", () => {
    const infoPlist = cfg.expo?.ios?.infoPlist ?? {};
    const purpose: string = infoPlist.NSSpeechRecognitionUsageDescription ?? "";
    const voiceLog = readFileSync(
      resolve(REPO, "apps/mobile/lib/voiceLog.ts"),
      "utf8",
    );
    const forcesOnDevice = /requiresOnDeviceRecognition:\s*true/.test(voiceLog);
    const claimsOnDevice = /on-device|on your phone|stays on your/i.test(purpose);
    if (claimsOnDevice && !forcesOnDevice) {
      throw new Error(
        "NSSpeechRecognitionUsageDescription claims on-device speech, but " +
          "voiceLog.ts does not set requiresOnDeviceRecognition:true — the " +
          "string and the code contradict (ENG-1542).",
      );
    }
    expect(claimsOnDevice && !forcesOnDevice).toBe(false);
  });
});
