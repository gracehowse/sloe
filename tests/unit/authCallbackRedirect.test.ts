import { describe, expect, it } from "vitest";

import { safeAuthRedirectPath } from "../../app/auth/callback/route";

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
});
