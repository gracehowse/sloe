import { describe, expect, it } from "vitest";

import {
  FIRST_LOG_LOCAL_KEY,
  firstLogTimestamp,
  shouldMarkFirstLog,
} from "../../src/lib/analytics/firstLog";

describe("firstLog analytics helpers", () => {
  it("formats first_log_at as ISO-8601", () => {
    expect(firstLogTimestamp(new Date("2026-05-29T12:00:00.000Z"))).toBe(
      "2026-05-29T12:00:00.000Z",
    );
  });

  it("marks first log only when the local marker is unset", () => {
    expect(shouldMarkFirstLog(null)).toBe(true);
    expect(shouldMarkFirstLog(undefined)).toBe(true);
    expect(shouldMarkFirstLog(false)).toBe(true);
    expect(shouldMarkFirstLog("already-set")).toBe(false);
  });

  it("exports a stable localStorage key", () => {
    expect(FIRST_LOG_LOCAL_KEY).toBe("suppr:analytics:first_log_at_set");
  });
});
