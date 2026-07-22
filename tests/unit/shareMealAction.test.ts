/**
 * ENG-1642 — `shareMealTextOrLink` (web "Share meal" action body).
 *
 * Mocks `navigator.share` / `navigator.clipboard` + `sonner` + `track`
 * (pattern: `tests/unit/nutritionJournalBulkInsert.test.tsx`'s track/sonner
 * mocking). Pins:
 *
 *  (a) the no-link-attempted text-only path stays byte-identical to
 *      pre-ENG-1642: a share success or an AbortError never touches the
 *      clipboard;
 *  (b) `linkAttempted: true` + a `NotAllowedError` from `navigator.share`
 *      triggers the clipboard rescue — including the create-FAILED case
 *      (`shareUrl: null`) that this PR fixed: a Safari user who lost the
 *      share sheet after a failed link create must still get the meal text
 *      copied, not a silent error toast;
 *  (c) the link path's clipboard fallback (no `navigator.share`) writes
 *      `message\nshareUrl` and toasts "Share link copied";
 *  (d) the equivalent text-only clipboard fallback when there's no
 *      `navigator.share` at all.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const trackCalls: Array<{ event: string; payload?: Record<string, unknown> }> = [];
const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("../../src/lib/analytics/track.ts", () => ({
  track: (event: string, payload?: Record<string, unknown>) => {
    trackCalls.push({ event, payload });
  },
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { shareMealTextOrLink } from "@/lib/share/shareMealAction";

const baseOpts = {
  title: "Chicken salad",
  message: "Chicken salad · 1 serving\n420 kcal · 38p 20c 18f\n\nvia Sloe",
  surface: "today_meal_row_kebab",
};

function stubShare(impl: (...args: unknown[]) => unknown): void {
  Object.defineProperty(navigator, "share", {
    value: vi.fn(impl),
    configurable: true,
    writable: true,
  });
}

function removeShare(): void {
  Object.defineProperty(navigator, "share", {
    value: undefined,
    configurable: true,
    writable: true,
  });
}

function stubClipboard(impl: (text: string) => Promise<void>): void {
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText: vi.fn(impl) },
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  trackCalls.length = 0;
  toastSuccess.mockClear();
  toastError.mockClear();
});

afterEach(() => {
  removeShare();
  Object.defineProperty(navigator, "clipboard", {
    value: undefined,
    configurable: true,
    writable: true,
  });
});

describe("shareMealTextOrLink — text-only path (no link attempted), byte-identical semantics", () => {
  it("navigator.share success -> outcome shared, mode text, no clipboard touched", async () => {
    stubShare(async () => undefined);
    const clipboardWrite = vi.fn();
    stubClipboard(clipboardWrite);

    await shareMealTextOrLink({ ...baseOpts, shareUrl: null, linkAttempted: false });

    expect(navigator.share).toHaveBeenCalledWith({
      title: baseOpts.title,
      text: baseOpts.message,
    });
    expect(clipboardWrite).not.toHaveBeenCalled();
    expect(trackCalls).toEqual([
      { event: "meal_share_invoked", payload: { surface: baseOpts.surface, outcome: "shared", mode: "text" } },
    ]);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("navigator.share AbortError -> outcome dismissed, mode text, NO clipboard rescue", async () => {
    const abort = new Error("cancelled");
    abort.name = "AbortError";
    stubShare(async () => {
      throw abort;
    });
    const clipboardWrite = vi.fn();
    stubClipboard(clipboardWrite);

    await shareMealTextOrLink({ ...baseOpts, shareUrl: null, linkAttempted: false });

    expect(clipboardWrite).not.toHaveBeenCalled();
    expect(trackCalls).toEqual([
      { event: "meal_share_invoked", payload: { surface: baseOpts.surface, outcome: "dismissed", mode: "text" } },
    ]);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("navigator.share generic error (no attempt) -> outcome error, mode text, no clipboard rescue", async () => {
    stubShare(async () => {
      throw new Error("boom");
    });
    const clipboardWrite = vi.fn();
    stubClipboard(clipboardWrite);

    await shareMealTextOrLink({ ...baseOpts, shareUrl: null, linkAttempted: false });

    expect(clipboardWrite).not.toHaveBeenCalled();
    expect(trackCalls).toEqual([
      { event: "meal_share_invoked", payload: { surface: baseOpts.surface, outcome: "error", mode: "text" } },
    ]);
  });
});

describe("shareMealTextOrLink — linkAttempted + NotAllowedError clipboard rescue", () => {
  it("with a shareUrl (link created ok, Safari lost activation) -> copies message+URL, toasts 'Share link copied'", async () => {
    const notAllowed = new Error("nope");
    notAllowed.name = "NotAllowedError";
    stubShare(async () => {
      throw notAllowed;
    });
    const clipboardWrite = vi.fn(async () => undefined);
    stubClipboard(clipboardWrite);

    await shareMealTextOrLink({
      ...baseOpts,
      shareUrl: "https://getsloe.com/m/a1b2c3d4e5f60718293a4b5c6d7e8f90",
      linkAttempted: true,
    });

    expect(clipboardWrite).toHaveBeenCalledWith(
      `${baseOpts.message}\nhttps://getsloe.com/m/a1b2c3d4e5f60718293a4b5c6d7e8f90`,
    );
    expect(toastSuccess).toHaveBeenCalledWith("Share link copied", {
      action: expect.objectContaining({ label: "Manage" }),
    });
    expect(toastError).not.toHaveBeenCalled();
    expect(trackCalls).toEqual([
      { event: "meal_share_invoked", payload: { surface: baseOpts.surface, outcome: "shared", mode: "link" } },
    ]);
  });

  it("WITHOUT a shareUrl (link create FAILED, Safari lost activation) -> still copies the text, toasts 'Meal copied to clipboard' — the regression this PR fixed", async () => {
    const notAllowed = new Error("nope");
    notAllowed.name = "NotAllowedError";
    stubShare(async () => {
      throw notAllowed;
    });
    const clipboardWrite = vi.fn(async () => undefined);
    stubClipboard(clipboardWrite);

    await shareMealTextOrLink({ ...baseOpts, shareUrl: null, linkAttempted: true });

    // No URL to append — shareUrl is null, so only the text is copied.
    expect(clipboardWrite).toHaveBeenCalledWith(baseOpts.message);
    expect(toastSuccess).toHaveBeenCalledWith("Meal copied to clipboard", undefined);
    expect(toastError).not.toHaveBeenCalled();
    expect(trackCalls).toEqual([
      { event: "meal_share_invoked", payload: { surface: baseOpts.surface, outcome: "shared", mode: "text" } },
    ]);
  });

  it("a NotAllowedError WITHOUT linkAttempted does NOT get the rescue — it's a normal error toast path", async () => {
    const notAllowed = new Error("nope");
    notAllowed.name = "NotAllowedError";
    stubShare(async () => {
      throw notAllowed;
    });
    const clipboardWrite = vi.fn();
    stubClipboard(clipboardWrite);

    await shareMealTextOrLink({ ...baseOpts, shareUrl: null, linkAttempted: false });

    expect(clipboardWrite).not.toHaveBeenCalled();
    expect(trackCalls).toEqual([
      { event: "meal_share_invoked", payload: { surface: baseOpts.surface, outcome: "error", mode: "text" } },
    ]);
  });
});

describe("shareMealTextOrLink — clipboard-only environments (no navigator.share)", () => {
  it("link path: writes message+URL and toasts 'Share link copied'", async () => {
    removeShare();
    const clipboardWrite = vi.fn(async () => undefined);
    stubClipboard(clipboardWrite);

    await shareMealTextOrLink({
      ...baseOpts,
      shareUrl: "https://getsloe.com/m/a1b2c3d4e5f60718293a4b5c6d7e8f90",
      linkAttempted: true,
    });

    expect(clipboardWrite).toHaveBeenCalledWith(
      `${baseOpts.message}\nhttps://getsloe.com/m/a1b2c3d4e5f60718293a4b5c6d7e8f90`,
    );
    expect(toastSuccess).toHaveBeenCalledWith("Share link copied", {
      action: expect.objectContaining({ label: "Manage" }),
    });
    expect(trackCalls).toEqual([
      { event: "meal_share_invoked", payload: { surface: baseOpts.surface, outcome: "shared", mode: "link" } },
    ]);
  });

  it("text path: writes the message only and toasts 'Meal copied to clipboard'", async () => {
    removeShare();
    const clipboardWrite = vi.fn(async () => undefined);
    stubClipboard(clipboardWrite);

    await shareMealTextOrLink({ ...baseOpts, shareUrl: null, linkAttempted: false });

    expect(clipboardWrite).toHaveBeenCalledWith(baseOpts.message);
    expect(toastSuccess).toHaveBeenCalledWith("Meal copied to clipboard", undefined);
    expect(trackCalls).toEqual([
      { event: "meal_share_invoked", payload: { surface: baseOpts.surface, outcome: "shared", mode: "text" } },
    ]);
  });

  it("a clipboard write failure toasts an error and tracks outcome 'error'", async () => {
    removeShare();
    const clipboardWrite = vi.fn(async () => {
      throw new Error("denied");
    });
    stubClipboard(clipboardWrite);

    await shareMealTextOrLink({ ...baseOpts, shareUrl: null, linkAttempted: false });

    expect(toastError).toHaveBeenCalledWith("Couldn't copy meal");
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(trackCalls).toEqual([
      { event: "meal_share_invoked", payload: { surface: baseOpts.surface, outcome: "error", mode: "text" } },
    ]);
  });
});
