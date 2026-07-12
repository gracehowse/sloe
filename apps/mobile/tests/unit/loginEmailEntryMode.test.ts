/**
 * ENG-1514 — fresh-install email auth defaults + root-login close + safe-area.
 *
 * Contract under test:
 *  1. `emailEntryDefaultsToSignUp` (lib/hasSignedInBefore.ts): the email form
 *     defaults to CREATE on a session-less fresh install; `?intent=signin`
 *     (onboarding welcome's "I already have an account") or the device's
 *     has-signed-in-before marker flips the default to sign-in.
 *  2. The marker is written by the auth provider whenever a session is
 *     observed, and deliberately survives sign-out (NOT in the
 *     clearUserScopedStorage wipe list — no user data, default-flip only).
 *  3. login.tsx wires the default at the chooser → email transition, gates
 *     the ✕ behind `router.canGoBack()`, and pins the safe-area inset on the
 *     non-scrolling wrapper (source-assertion style, matching the sibling
 *     loginChooserFigma.test.ts).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// expo-router's real build ships JSX vitest can't parse — mock the single
// hook the lib imports (same pattern as authDeepLinkCallback.test.ts).
vi.mock("expo-router", () => ({ useLocalSearchParams: () => ({}) }));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  HAS_SIGNED_IN_BEFORE_KEY,
  emailEntryDefaultsToSignUp,
  markHasSignedInBefore,
} from "@/lib/hasSignedInBefore";

const LOGIN_SRC = readFileSync(join(__dirname, "..", "..", "app", "login.tsx"), "utf8");
const AUTH_SRC = readFileSync(join(__dirname, "..", "..", "context", "auth.tsx"), "utf8");
const WIPE_SRC = readFileSync(
  join(__dirname, "..", "..", "lib", "clearUserScopedStorage.ts"),
  "utf8",
);
const WELCOME_SRC = readFileSync(
  join(__dirname, "..", "..", "components", "onboarding", "steps", "welcome.tsx"),
  "utf8",
);

describe("emailEntryDefaultsToSignUp — mode decision (ENG-1514)", () => {
  it("defaults to CREATE on a fresh install (no intent, no marker)", () => {
    expect(emailEntryDefaultsToSignUp(undefined, false)).toBe(true);
  });

  it("defaults to sign-in when the device has seen a session", () => {
    expect(emailEntryDefaultsToSignUp(undefined, true)).toBe(false);
  });

  it('defaults to sign-in for ?intent=signin (welcome "I already have an account")', () => {
    expect(emailEntryDefaultsToSignUp("signin", false)).toBe(false);
    expect(emailEntryDefaultsToSignUp(["signin"], false)).toBe(false);
  });

  it("ignores unknown intents", () => {
    expect(emailEntryDefaultsToSignUp("otherthing", false)).toBe(true);
  });
});

describe("has-signed-in-before marker", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("markHasSignedInBefore writes the device marker", async () => {
    markHasSignedInBefore();
    await new Promise((r) => setTimeout(r, 0));
    expect(await AsyncStorage.getItem(HAS_SIGNED_IN_BEFORE_KEY)).toBe("1");
  });

  it("is written by the auth provider when a session is observed", () => {
    expect(AUTH_SRC).toMatch(/markHasSignedInBefore\(\)/);
  });

  it("survives sign-out — deliberately NOT in the user-scoped wipe list", () => {
    expect(WIPE_SRC).not.toMatch(/has_signed_in_before/);
  });
});

describe("login.tsx wiring (ENG-1514)", () => {
  it("applies the entry default at the chooser → email transition", () => {
    expect(LOGIN_SRC).toMatch(/useEmailEntrySignUpDefault/);
    expect(LOGIN_SRC).toMatch(/setIsSignUp\(emailEntrySignUp\); setView\("email"\)/);
  });

  it("keeps the Already-have-an-account toggle copy", () => {
    expect(LOGIN_SRC).toMatch(/Already have an account\? Sign in/);
  });

  it("resets to sign-in-neutral state when backing out to the chooser", () => {
    // Guards the chooser Apple button from the isSignUp terms gate after a
    // create-default email visit.
    expect(LOGIN_SRC).toMatch(/setView\("chooser"\); setIsSignUp\(false\)/);
  });

  it("gates the ✕ behind router.canGoBack() and pops instead of opening Safari", () => {
    expect(LOGIN_SRC).toMatch(/router\.canGoBack\(\) &&/);
    expect(LOGIN_SRC).toMatch(/onPress={\(\) => router\.back\(\)}/);
    expect(LOGIN_SRC).not.toMatch(/login-close[\s\S]{0,300}Linking\.openURL/);
  });

  it("pins the safe-area inset on the non-scrolling wrapper, not the scroll content", () => {
    expect(LOGIN_SRC).toMatch(/<KeyboardSafeView\s+style={{ paddingTop: insets\.top/);
    expect(LOGIN_SRC).not.toMatch(
      /contentContainerStyle={\[styles\.container, { paddingTop: insets\.top }\]}/,
    );
  });

  it("welcome's I-already-have-an-account passes intent=signin", () => {
    expect(WELCOME_SRC).toMatch(/pathname: "\/login", params: { intent: "signin" }/);
  });
});
