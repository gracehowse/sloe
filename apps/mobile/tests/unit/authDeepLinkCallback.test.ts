/**
 * Mobile auth deep-link + PKCE flow (ENG-1474).
 *
 * The `suppr://auth-callback` deep-link handler completes a PKCE email
 * round-trip on mobile — mirroring web's `app/auth/callback/route.ts`.
 * This locks the load-bearing contract:
 *
 *   1. The mobile Supabase client uses `flowType: "pkce"` (matching web)
 *      and keeps `detectSessionInUrl: false` (source-scan of lib/supabase.ts).
 *   2. Every `login.tsx` email round-trip (signUp / signInWithOtp /
 *      resetPasswordForEmail) points its redirect at `suppr://auth-callback`
 *      (source-scan) so GoTrue deep-links back into the app, not Safari.
 *   3. The open-redirect guard rejects absolute / external `next` values and
 *      accepts relative in-app paths like `/onboarding` (direct unit test).
 *   4. `supabase/config.toml` allow-lists `suppr://auth-callback`
 *      (source-scan — GoTrue rejects a `redirectTo` that isn't listed).
 *
 * Source-scans (rather than rendering the deep-link screen) match the repo
 * idiom for auth-config pins (see `loginAuthRedirect.test.ts`,
 * `easUpdateConfig.test.ts`): the exchange itself is a single Supabase call
 * and the routing is a pure guard, both asserted directly below.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  DEFAULT_AUTH_REDIRECT_PATH,
  safeAuthRedirectPath,
} from "../../lib/safeAuthRedirectPath";

// `useAuthCallbackError` imports `useLocalSearchParams` at module scope;
// expo-router's real build ships JSX that vitest can't parse. Only the pure
// `authCallbackErrorMessage` export is exercised here, so a hollow stub is
// enough to let the module load.
vi.mock("expo-router", () => ({ useLocalSearchParams: () => ({}) }));

import {
  authCallbackErrorMessage,
} from "../../lib/useAuthCallbackError";

const MOBILE_ROOT = join(__dirname, "..", "..");
const SUPABASE_LIB = join(MOBILE_ROOT, "lib", "supabase.ts");
const LOGIN_FILE = join(MOBILE_ROOT, "app", "login.tsx");
const CALLBACK_FILE = join(MOBILE_ROOT, "app", "auth-callback.tsx");
const CONFIG_TOML = join(MOBILE_ROOT, "..", "..", "supabase", "config.toml");

describe("mobile supabase client — PKCE (ENG-1474)", () => {
  const src = readFileSync(SUPABASE_LIB, "utf8");

  it("uses flowType: pkce (matching web's browser client)", () => {
    expect(src).toMatch(/flowType:\s*["']pkce["']/);
  });

  it("keeps detectSessionInUrl: false (RN drives the exchange manually)", () => {
    expect(src).toMatch(/detectSessionInUrl:\s*false/);
  });
});

describe("login.tsx email round-trips deep-link back into the app (ENG-1474)", () => {
  const src = readFileSync(LOGIN_FILE, "utf8");

  it("defines the suppr://auth-callback deep link", () => {
    expect(src).toMatch(/AUTH_CALLBACK_DEEP_LINK\s*=\s*["']suppr:\/\/auth-callback["']/);
  });

  it("passes emailRedirectTo on signUp", () => {
    // The signUp call carries options.emailRedirectTo = the deep link.
    expect(src).toMatch(/signUp\(\{[\s\S]*?emailRedirectTo:\s*AUTH_CALLBACK_DEEP_LINK/);
  });

  it("passes emailRedirectTo on the magic-link signInWithOtp", () => {
    expect(src).toMatch(/signInWithOtp\(\{[\s\S]*?emailRedirectTo:\s*AUTH_CALLBACK_DEEP_LINK/);
  });

  it("passes redirectTo on resetPasswordForEmail, with next=/reset-password (ENG-1483)", () => {
    // Without `next`, auth-callback fell back to `/(tabs)` and a
    // just-recovered user had no way to actually set a new password.
    expect(src).toMatch(
      /resetPasswordForEmail\([\s\S]*?redirectTo:\s*`\$\{AUTH_CALLBACK_DEEP_LINK\}\?next=\$\{encodeURIComponent\(["']\/reset-password["']\)\}`/,
    );
  });

  it("wires the auth-callback error hook into its message state", () => {
    // login delegates `?error=` surfacing to the extracted hook, seeding
    // its existing `setMessage` idiom.
    expect(src).toMatch(/useAuthCallbackError\(setMessage\)/);
  });
});

describe("authCallbackErrorMessage — maps forwarded error params (ENG-1474)", () => {
  it("returns null when no error code is present", () => {
    expect(authCallbackErrorMessage(undefined, undefined)).toBeNull();
    expect(authCallbackErrorMessage(undefined, "some detail")).toBeNull();
  });

  it("prefers a non-empty error_description", () => {
    expect(authCallbackErrorMessage("oauth", "Code has expired")).toBe("Code has expired");
  });

  it("falls back to a friendly default when only the code is present", () => {
    expect(authCallbackErrorMessage("oauth", undefined)).toBe(
      "That sign-in link didn't work. Try again below.",
    );
    expect(authCallbackErrorMessage("oauth", "   ")).toBe(
      "That sign-in link didn't work. Try again below.",
    );
  });
});

describe("auth-callback screen exchanges the code and guards next (ENG-1474)", () => {
  const src = readFileSync(CALLBACK_FILE, "utf8");

  it("exchanges the code for a session", () => {
    expect(src).toMatch(/exchangeCodeForSession\(code\)/);
  });

  it("routes the next destination through the open-redirect guard", () => {
    expect(src).toMatch(/safeAuthRedirectPath\(next\)/);
  });

  it("forwards a missing / failed code to /login with an error", () => {
    expect(src).toMatch(/\/login\?error=oauth/);
  });
});

describe("reset-password screen — recovery landing (ENG-1483)", () => {
  const src = readFileSync(join(MOBILE_ROOT, "app", "reset-password.tsx"), "utf8");

  it("updates the password via supabase.auth.updateUser", () => {
    expect(src).toMatch(/supabase\.auth\.updateUser\(\{\s*password\s*\}\)/);
  });

  it("redirects to /login on success", () => {
    expect(src).toMatch(/router\.replace\(["']\/login["']\)/);
  });
});

describe("safeAuthRedirectPath — open-redirect guard (ENG-1474)", () => {
  it("accepts a relative in-app path (/onboarding)", () => {
    expect(safeAuthRedirectPath("/onboarding")).toBe("/onboarding");
  });

  it("accepts /reset-password — the ENG-1483 recovery-form destination", () => {
    expect(safeAuthRedirectPath("/reset-password")).toBe("/reset-password");
  });

  it("accepts the tabs home path", () => {
    expect(safeAuthRedirectPath("/(tabs)")).toBe("/(tabs)");
  });

  it("defaults empty / missing next to the tabs home", () => {
    expect(safeAuthRedirectPath(undefined)).toBe(DEFAULT_AUTH_REDIRECT_PATH);
    expect(safeAuthRedirectPath(null)).toBe(DEFAULT_AUTH_REDIRECT_PATH);
    expect(safeAuthRedirectPath("")).toBe(DEFAULT_AUTH_REDIRECT_PATH);
    expect(safeAuthRedirectPath("   ")).toBe(DEFAULT_AUTH_REDIRECT_PATH);
  });

  it("rejects an absolute https URL", () => {
    expect(safeAuthRedirectPath("https://evil.com")).toBe(DEFAULT_AUTH_REDIRECT_PATH);
  });

  it("rejects a custom-scheme URL (suppr:// / javascript:)", () => {
    expect(safeAuthRedirectPath("suppr://paywall")).toBe(DEFAULT_AUTH_REDIRECT_PATH);
    expect(safeAuthRedirectPath("javascript:alert(1)")).toBe(DEFAULT_AUTH_REDIRECT_PATH);
  });

  it("rejects a protocol-relative //host (the classic startsWith('/') bypass)", () => {
    expect(safeAuthRedirectPath("//evil.com")).toBe(DEFAULT_AUTH_REDIRECT_PATH);
  });

  it("rejects a backslash trick (/\\evil.com)", () => {
    expect(safeAuthRedirectPath("/\\evil.com")).toBe(DEFAULT_AUTH_REDIRECT_PATH);
  });

  it("rejects a bare path with no leading slash", () => {
    expect(safeAuthRedirectPath("onboarding")).toBe(DEFAULT_AUTH_REDIRECT_PATH);
  });
});

describe("supabase/config.toml allow-lists the mobile deep link (ENG-1474)", () => {
  const src = readFileSync(CONFIG_TOML, "utf8");

  it("contains suppr://auth-callback in additional_redirect_urls", () => {
    const line = src
      .split("\n")
      .find((l) => l.startsWith("additional_redirect_urls"));
    expect(line).toBeTruthy();
    expect(line).toContain("suppr://auth-callback");
  });

  it("keeps enable_confirmations = false (confirm-after-value posture, not flipped by ENG-1474)", () => {
    expect(src).toMatch(/enable_confirmations\s*=\s*false/);
  });
});
