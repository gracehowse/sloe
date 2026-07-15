import { describe, it, expect } from "vitest";

import {
  classifySignUpResult,
  isRealSignUp,
  type SignUpOutcome,
} from "../../src/lib/auth/signUpResult";

/**
 * ENG-1537 — the two web signup call sites (login + onboarding) share this
 * classifier so they can't drift (the ENG-1512 residual was a two-site
 * divergence). Guards the anti-enumeration contract: an already-registered
 * confirmed email must not be told "account created" or attributed a signup,
 * yet must be indistinguishable in COPY from a genuine new signup.
 */
describe("classifySignUpResult (ENG-1537)", () => {
  it("live session → signed_in (confirmations OFF, the prod path)", () => {
    expect(
      classifySignUpResult({ user: { identities: [{}] }, session: { access_token: "x" } }),
    ).toBe("signed_in");
  });

  it("new email + no session → confirm_pending (real confirmation link sent)", () => {
    expect(
      classifySignUpResult({ user: { identities: [{ id: "i1" }] }, session: null }),
    ).toBe("confirm_pending");
  });

  it("already-registered email → existing_obfuscated (identities: [], no session)", () => {
    expect(
      classifySignUpResult({ user: { identities: [] }, session: null }),
    ).toBe("existing_obfuscated");
  });

  it("defensively treats missing identities as confirm_pending (not obfuscated)", () => {
    expect(classifySignUpResult({ user: {}, session: null })).toBe("confirm_pending");
    expect(
      classifySignUpResult({ user: { identities: null }, session: null }),
    ).toBe("confirm_pending");
  });

  it("a session wins even if identities is empty (never mis-flag a signed-in user)", () => {
    expect(
      classifySignUpResult({ user: { identities: [] }, session: { access_token: "x" } }),
    ).toBe("signed_in");
  });
});

describe("isRealSignUp — analytics attribution (ENG-1537)", () => {
  it("attributes signed_in and confirm_pending, NOT existing_obfuscated", () => {
    expect(isRealSignUp("signed_in")).toBe(true);
    expect(isRealSignUp("confirm_pending")).toBe(true);
    expect(isRealSignUp("existing_obfuscated")).toBe(false);
  });
});

describe("enumeration safety — copy parity between new and existing (ENG-1537)", () => {
  it("both no-session outcomes render the SAME (non-signed_in) UI branch", () => {
    // The sites key their confirm interstitial / neutral message on
    // `outcome !== "signed_in"`, so a new email and an obfuscated-existing one
    // are indistinguishable in copy — only isRealSignUp (analytics) differs.
    const newEmail: SignUpOutcome = classifySignUpResult({
      user: { identities: [{ id: "i1" }] },
      session: null,
    });
    const existing: SignUpOutcome = classifySignUpResult({
      user: { identities: [] },
      session: null,
    });
    expect(newEmail).not.toBe("signed_in");
    expect(existing).not.toBe("signed_in");
    // …but analytics attribution diverges (the whole point of the fix).
    expect(isRealSignUp(newEmail)).toBe(true);
    expect(isRealSignUp(existing)).toBe(false);
  });
});
