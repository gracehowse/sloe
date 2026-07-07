/**
 * ENG-1378 — one auth-gate alert, one voice.
 *
 * Before `authAlertCopy.ts`, "sign in to do X" existed as 5+
 * independently-typed variants (different titles, different sentence
 * shapes — "Sign in to X." vs "You need to be signed in to X.") across
 * household-settings.tsx, TodayScreen.tsx, QuickAddPanel.tsx,
 * planner.tsx, barcode.tsx, cook.tsx, and create-recipe.tsx. This pins
 * the templated helper's output shape so a future edit to one call site
 * can't silently drift the sentence back apart from the others.
 */
import { Alert } from "react-native";
import { describe, expect, it, vi } from "vitest";

import { signInToAlert, signInToMessage, showSignInAlert } from "@/lib/authAlertCopy";

describe("signInToAlert", () => {
  it("always titles the alert 'Sign in' (never 'Sign in needed' or similar)", () => {
    expect(signInToAlert("save favourites").title).toBe("Sign in");
    expect(signInToAlert("create a recipe").title).toBe("Sign in");
  });

  it("renders 'Sign in to {action}.' — never the 'You need to be signed in to X' phrasing", () => {
    expect(signInToAlert("save favourites").message).toBe("Sign in to save favourites.");
    expect(signInToAlert("log food to your tracker").message).toBe(
      "Sign in to log food to your tracker.",
    );
  });

  it("appends exactly one trailing period regardless of action phrasing", () => {
    const { message } = signInToAlert("scan a recipe photo");
    expect(message.endsWith(".")).toBe(true);
    expect(message.endsWith("..")).toBe(false);
  });
});

describe("signInToMessage", () => {
  it("returns the bare message string, identical to signInToAlert(...).message", () => {
    expect(signInToMessage("manage your household")).toBe(
      signInToAlert("manage your household").message,
    );
    expect(signInToMessage("manage your household")).toBe("Sign in to manage your household.");
  });
});

describe("showSignInAlert", () => {
  it("fires Alert.alert with the templated title + message for the given action", () => {
    const spy = vi.spyOn(Alert, "alert").mockImplementation(() => {});
    showSignInAlert("save a usual meal");
    expect(spy).toHaveBeenCalledWith("Sign in", "Sign in to save a usual meal.");
    spy.mockRestore();
  });

  it("never fires with an unearned '!' — voice-contract no-self-defence rule", () => {
    const spy = vi.spyOn(Alert, "alert").mockImplementation(() => {});
    showSignInAlert("log food to your tracker");
    const [, message] = spy.mock.calls[0];
    expect(message).not.toContain("!");
    spy.mockRestore();
  });
});
