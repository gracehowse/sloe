// @vitest-environment jsdom
/**
 * Mobile `WhatsNewScreen` render test (F-0, 2026-04-19).
 *
 * Pins the user-visible contract of the What's new screen that
 * testers see when they:
 *   1. tap Settings → About → "What's new in Suppr", or
 *   2. get auto-surfaced after a build-number bump.
 *
 * Mirrors the data shape of the web page at `/whats-new` so the
 * two surfaces can't drift independently — both read from the same
 * `src/lib/changelog/entries.ts`.
 *
 * Coverage:
 *   1. The screen renders the latest entry's build header line
 *      (`Build N (V #N)`).
 *   2. The release date renders (in some locale form).
 *   3. Every category heading for the latest entry is present.
 *   4. The tester attribution footer renders when set.
 *   5. The native-header "Done" button is installed via
 *      `navigation.setOptions` and pops via `useSafeBack`.
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import {
  getLatestChangelog,
  groupChangelogItems,
  changelogKindLabel,
} from "../../../../src/lib/changelog/entries";
import WhatsNewScreen from "../../app/whats-new";

void React;

// Mock expo-router: `useNavigation` lets us capture `setOptions`
// so we can assert the native-header button the screen installs.
const setOptionsSpy = vi.fn();
const canGoBackSpy = vi.fn(() => true);
const backSpy = vi.fn();
const replaceSpy = vi.fn();

vi.mock("expo-router", () => ({
  useNavigation: () => ({
    setOptions: setOptionsSpy,
    canGoBack: canGoBackSpy,
  }),
  useRouter: () => ({
    back: backSpy,
    replace: replaceSpy,
  }),
}));

// We rely on the `@react-navigation/native` hook `useNavigation`
// inside `useSafeBack` — mock it to match the spies above.
vi.mock("@react-navigation/native", () => ({
  useNavigation: () => ({
    canGoBack: canGoBackSpy,
  }),
}));

describe("WhatsNewScreen (mobile) — F-0 'What's new' surface", () => {
  it("renders the latest entry's build header line", () => {
    const latest = getLatestChangelog();
    const { getByTestId } = render(<WhatsNewScreen />);
    const title = getByTestId("whats-new-title");
    // The header reads `Build N (V #N)` — identical to the web page.
    expect(title.props.children).toBe(
      `Build ${latest.buildNumber} (${latest.appVersion} #${latest.buildNumber})`,
    );
  });

  it("renders the release date", () => {
    const { getByTestId } = render(<WhatsNewScreen />);
    const dateEl = getByTestId("whats-new-date");
    // The exact locale string depends on the test runner; we just
    // pin that something renders and it's not the placeholder.
    const rendered = String(dateEl.props.children);
    expect(rendered.length).toBeGreaterThan(0);
    expect(rendered).not.toBe("Invalid Date");
  });

  it("renders a section heading for every category present in the latest entry", () => {
    const latest = getLatestChangelog();
    const groups = groupChangelogItems(latest);
    // At least one group — build 10 has three.
    expect(groups.length).toBeGreaterThan(0);

    const { getByTestId, queryByTestId } = render(<WhatsNewScreen />);
    for (const group of groups) {
      const section = getByTestId(`whats-new-section-${group.kind}`);
      expect(section.props.children).toBe(changelogKindLabel(group.kind));
    }
    // Kinds not present in the entry must NOT emit a headless
    // section (the renderer filters empties).
    const allKinds = ["new", "fixed", "coming_soon"] as const;
    const present = new Set(groups.map((g) => g.kind));
    for (const kind of allKinds) {
      if (!present.has(kind)) {
        expect(queryByTestId(`whats-new-section-${kind}`)).toBeNull();
      }
    }
  });

  it("renders the tester attribution footer when the entry provides one", () => {
    const latest = getLatestChangelog();
    const { getByTestId, queryByTestId } = render(<WhatsNewScreen />);
    if (latest.testerAttribution) {
      const footer = getByTestId("whats-new-attribution");
      expect(footer.props.children).toBe(latest.testerAttribution);
      // Privacy rule: we never expose individual tester handles /
      // emails — the footer is always a count.
      expect(footer.props.children).toMatch(/\d+ testers?\./);
      expect(String(footer.props.children)).not.toMatch(/@/);
    } else {
      expect(queryByTestId("whats-new-attribution")).toBeNull();
    }
  });

  it("installs a 'Done' button in the native header that pops via useSafeBack", () => {
    setOptionsSpy.mockClear();
    backSpy.mockClear();
    canGoBackSpy.mockReturnValue(true);

    render(<WhatsNewScreen />);
    // The screen calls setOptions at least once with a title and a
    // headerRight factory.
    expect(setOptionsSpy).toHaveBeenCalled();
    const lastCall = setOptionsSpy.mock.calls[setOptionsSpy.mock.calls.length - 1];
    const opts = lastCall[0] as {
      title?: string;
      headerRight?: () => React.ReactElement;
    };
    expect(opts.title).toBe("What's new");
    expect(typeof opts.headerRight).toBe("function");

    // Render the headerRight in isolation and tap it — it must call
    // the navigation's `back` (the stack is not empty in this test).
    const { getByLabelText } = render(opts.headerRight!());
    fireEvent.press(getByLabelText("Done"));
    expect(backSpy).toHaveBeenCalledTimes(1);
  });
});
