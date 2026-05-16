import { describe, it, expect, vi, beforeEach } from "vitest";

const captureExceptionMock = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  captureException: (...args: unknown[]) => captureExceptionMock(...args),
}));

import { captureRouteError } from "../../src/lib/observability/captureRouteError";

describe("captureRouteError (ENG-518)", () => {
  beforeEach(() => {
    captureExceptionMock.mockReset();
  });

  it("forwards the error to Sentry.captureException with a route tag", () => {
    const err = new Error("boom");
    captureRouteError(err, "/api/test");
    expect(captureExceptionMock).toHaveBeenCalledTimes(1);
    const [forwardedErr, ctx] = captureExceptionMock.mock.calls[0];
    expect(forwardedErr).toBe(err);
    expect(ctx).toMatchObject({ tags: { route: "/api/test" } });
  });

  it("includes extra payload when provided", () => {
    captureRouteError(new Error("boom"), "/api/test", { provider: "usda", status: 502 });
    const ctx = captureExceptionMock.mock.calls[0][1];
    expect(ctx).toMatchObject({
      tags: { route: "/api/test" },
      extra: { provider: "usda", status: 502 },
    });
  });

  it("omits the extra key when no extra is passed (cleaner Sentry payload)", () => {
    captureRouteError(new Error("boom"), "/api/test");
    const ctx = captureExceptionMock.mock.calls[0][1];
    expect(ctx).not.toHaveProperty("extra");
  });

  it("does not throw when Sentry itself throws (best-effort guarantee)", () => {
    captureExceptionMock.mockImplementation(() => {
      throw new Error("sentry init failed");
    });
    expect(() => captureRouteError(new Error("boom"), "/api/test")).not.toThrow();
  });
});
