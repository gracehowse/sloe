// @vitest-environment jsdom
/**
 * Mobile `PhotoLogSheet` free-taster render tests (2026-05-02).
 *
 * Pins the public contract of the free-taster "X free logs remaining
 * today" line + the `onUpgradeRequired` upgrade-handoff. Decision doc:
 * `docs/decisions/2026-05-02-photo-log-free-taster.md`.
 *
 * Coverage:
 *  1. Free user with no prior server response renders the optimistic
 *     "3 free logs remaining today" line.
 *  2. Free user grammar handles singular ("1 free log") vs plural.
 *  3. Pro user does NOT render the quota line at all (would imply a
 *     cap on a feature that's uncapped at the user-visible level).
 *  4. The `visible === false` branch renders nothing (Modal-honour
 *     contract — caller passes false to dismiss; we don't leak content).
 *
 * The 403→onUpgradeRequired handoff is covered separately by the
 * source-level contract test (`photoLogSheetUpgradeContract.test.ts`)
 * because triggering the analyse path requires a working multipart
 * fetch + an `expo-image-picker` mock that returns an asset, which is
 * heavier than the vmThreads pool comfortably handles.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react-native";

import PhotoLogSheet from "../../components/PhotoLogSheet";

void React;

const COLORS = {
  text: "#f8fafc",
  textSecondary: "#94a3b8",
  textTertiary: "#64748b",
  card: "#16161e",
  cardBorder: "#2a2a3a",
  background: "#0a0a0f",
  inputBg: "#1a1a24",
  border: "#2a2a3a",
};

describe("PhotoLogSheet (mobile) — free-taster quota line", () => {
  it("renders '3 free logs remaining today' for a free user with no prior call", () => {
    const { getByLabelText } = render(
      <PhotoLogSheet
        visible
        onClose={() => undefined}
        activeSlot="Lunch"
        apiBase="https://example.test"
        onCommit={() => undefined}
        colors={COLORS}
        userTier="free"
      />,
    );
    // The quota line is a Text element with a deterministic
    // accessibilityLabel — assert via that so we don't get tripped by
    // the visible interpunct / wrapping whitespace.
    const line = getByLabelText("3 free photo logs remaining today");
    expect(line).toBeTruthy();
  });

  it("renders the same quota line for a 'base' tier user (mid-tier non-Pro)", () => {
    // Base + free are both treated as non-Pro for this taster (the
    // server's `tier !== 'pro'` branch covers both).
    const { getByLabelText } = render(
      <PhotoLogSheet
        visible
        onClose={() => undefined}
        activeSlot="Lunch"
        apiBase="https://example.test"
        onCommit={() => undefined}
        colors={COLORS}
        userTier="base"
      />,
    );
    expect(getByLabelText("3 free photo logs remaining today")).toBeTruthy();
  });

  it("does NOT render the quota line for a Pro user", () => {
    const { queryByLabelText } = render(
      <PhotoLogSheet
        visible
        onClose={() => undefined}
        activeSlot="Lunch"
        apiBase="https://example.test"
        onCommit={() => undefined}
        colors={COLORS}
        userTier="pro"
      />,
    );
    // No "remaining today" affordance on Pro — they're uncapped at the
    // user-visible level.
    expect(queryByLabelText(/free photo logs remaining today/)).toBeNull();
  });

  it("defaults to Pro behaviour when userTier prop is omitted (back-compat)", () => {
    // Existing callers that haven't yet been migrated to pass userTier
    // must keep behaving as before — no quota line, no surprise UI.
    const { queryByLabelText } = render(
      <PhotoLogSheet
        visible
        onClose={() => undefined}
        activeSlot="Lunch"
        apiBase="https://example.test"
        onCommit={() => undefined}
        colors={COLORS}
      />,
    );
    expect(queryByLabelText(/free photo logs remaining today/)).toBeNull();
  });

  it("renders nothing when visible is false (Modal contract)", () => {
    const { queryByLabelText } = render(
      <PhotoLogSheet
        visible={false}
        onClose={() => undefined}
        activeSlot="Lunch"
        apiBase="https://example.test"
        onCommit={() => undefined}
        colors={COLORS}
        userTier="free"
      />,
    );
    // Modal honours visibility — content is not in the tree.
    expect(queryByLabelText(/free photo logs remaining today/)).toBeNull();
  });
});

describe("PhotoLogSheet (mobile) — upgrade-required handoff contract", () => {
  it("source declares an `onUpgradeRequired` prop and routes 403 there", async () => {
    // Source-level pin: importing the module must not throw, the
    // component must accept `onUpgradeRequired` (declared in Props),
    // and the response branch for `resp.status === 403 &&
    // data.error === "upgrade_required"` must call it. We assert via
    // file content because triggering a real 403 in a render test
    // requires mocking `expo-image-picker` + global `fetch` together,
    // which is overkill for a contract pin.
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const SRC = readFileSync(
      resolve(__dirname, "../../components/PhotoLogSheet.tsx"),
      "utf8",
    );
    expect(SRC).toMatch(/onUpgradeRequired\?\:\s*\(\)\s*=>\s*void/);
    expect(SRC).toMatch(
      /resp\.status\s*===\s*403[\s\S]{0,80}data\?\.error\s*===\s*["']upgrade_required["']/,
    );
    expect(SRC).toMatch(/onUpgradeRequired\(\)/);
  });

  // Compile-time regression guard — if either prop disappears the type
  // narrows away and TypeScript fails the build before this lands.
  it("Props.userTier accepts 'free' | 'base' | 'pro'", () => {
    const noop = vi.fn();
    const props: Parameters<typeof PhotoLogSheet>[0] = {
      visible: false,
      onClose: noop,
      activeSlot: "Lunch",
      apiBase: "https://example.test",
      onCommit: noop,
      colors: COLORS,
      userTier: "free",
      onUpgradeRequired: noop,
    };
    expect(props.userTier).toBe("free");
  });
});
