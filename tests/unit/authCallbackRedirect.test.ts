/**
 * ENG-729 — the post-auth `next` redirect must not allow an open-redirect.
 * The naive `next.startsWith("/")` guard passed `//evil.com` (protocol-relative)
 * and backslash tricks. `safeAuthRedirectPath` rejects all non-same-origin forms.
 *
 * (Helper lives in its own module, not the route file — exporting it from a
 * Next route module breaks `next build`.)
 */
import { describe, expect, it } from "vitest";
import { safeAuthRedirectPath } from "@/lib/auth/safeRedirectPath";

describe("safeAuthRedirectPath", () => {
  it("allows same-origin relative paths", () => {
    expect(safeAuthRedirectPath("/")).toBe("/");
    expect(safeAuthRedirectPath("/today?meal=breakfast")).toBe("/today?meal=breakfast");
  });

  it("falls back for absolute URLs and protocol-relative redirects", () => {
    expect(safeAuthRedirectPath("https://evil.example/phish")).toBe("/");
    expect(safeAuthRedirectPath("//evil.example/phish")).toBe("/");
  });

  it("falls back for backslash variants that URL parsers treat as external", () => {
    expect(safeAuthRedirectPath("\\\\evil.example/phish")).toBe("/");
    expect(safeAuthRedirectPath("/\\evil.example/phish")).toBe("/");
  });

  it("falls back for empty / nullish input", () => {
    expect(safeAuthRedirectPath("")).toBe("/");
    expect(safeAuthRedirectPath(null)).toBe("/");
    expect(safeAuthRedirectPath(undefined)).toBe("/");
  });
});
