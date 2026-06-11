// @vitest-environment jsdom
/**
 * Mobile `WhatsNewScreen` render test (F-0, 2026-04-19).
 *
 * Pins the user-visible contract of the What's new screen that
 * testers see when they:
 *   1. tap Settings → About → "What's new", or
 *   2. get auto-surfaced after a build-number bump.
 *
 * Mirrors the data shape of the web page at `/whats-new` so the
 * two surfaces can't drift independently — both read from the same
 * `src/lib/changelog/entries.ts`.
 *
 * Coverage:
 *   1. The screen renders the latest entry's build header line
 *      (`Build N (V #N)`).
 *   2. The release date renders correctly (TZ-safe local parse — see
 *      gap 1 in the 2026-06-09 premium-bar audit).
 *   3. Every category heading for the latest entry is present as a
 *      kind chip (kind chip IA — gap 5 in the audit).
 *   4. The tester attribution footer renders when set.
 *   5. The native-header "Done" button is installed via
 *      `navigation.setOptions` (with `headerTitleStyle` in serif)
 *      and pops via `useSafeBack`.
 *   6. `formatReleaseDate` parses ISO dates as local calendar dates —
 *      never shifts back a day in UTC-west timezones (gap 1).
 */
import * as React from "react";
import { describe, expect, it, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react-native";

import {
  getLatestChangelog,
  groupChangelogItems,
  changelogKindLabel,
} from "@suppr/shared/changelog/entries";
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

  it("renders the correct date for 2026-05-12 regardless of UTC-west timezone (gap 1 — TZ bug fix)", () => {
    // Reproduce the original bug: TZ=America/Los_Angeles rendered '11 May 2026'
    // for releaseDate '2026-05-12' because new Date('2026-05-12') is UTC midnight.
    // The fix parses using new Date(y, m-1, d) which respects local time.
    //
    // We test the SSOT function directly by importing it — but since it's
    // not exported from the module, we verify the output via the rendered
    // whats-new-date element for the known build-49 entry (releaseDate
    // '2026-05-12'). The expected en-GB string is '12 May 2026'.
    //
    // CI runs in UTC where old and new code both gave '12 May 2026' — the bug
    // only surfaces west of UTC. To guarantee the fix is in the code path we
    // use a deterministic simulation: we temporarily override Date's constructor
    // to check that the parsing does NOT call new Date('2026-05-12') (the UTC
    // path) and DOES call new Date(2026, 4, 12) (the local path).
    // Capture the REAL constructor BEFORE spying — calling `new Date(...)` inside
    // the mock would otherwise re-enter the mock and recurse infinitely.
    const RealDate = global.Date;
    const dateSpy = vi.spyOn(global, "Date").mockImplementation((...args) => {
      // @ts-expect-error — we're intercepting all overloads
      return new (RealDate as never)(...args);
    });
    // Preserve statics the render path may touch (Date.now/UTC/parse).
    Object.assign(global.Date, {
      now: RealDate.now,
      UTC: RealDate.UTC,
      parse: RealDate.parse,
    });

    render(<WhatsNewScreen />);

    // Verify the local-calendar-date path was used: new Date(y, m-1, d)
    // is called with THREE numeric arguments, not a string.
    const callsWithThreeNumericArgs = dateSpy.mock.calls.filter((rawArgs) => {
      // mock.calls is typed against Date's single-arg overload; the local
      // path passes three numeric args, so widen to read indices 1/2.
      const args = rawArgs as unknown[];
      return (
        args.length === 3 &&
        typeof args[0] === "number" &&
        typeof args[1] === "number" &&
        typeof args[2] === "number"
      );
    });
    expect(callsWithThreeNumericArgs.length).toBeGreaterThan(0);

    // Verify the UTC-string path was NOT used for any YYYY-MM-DD pattern
    // (the only remaining use of single-string Date() is the fallback branch
    // for non-ISO strings, which should not fire for valid entries).
    const callsWithISOString = dateSpy.mock.calls.filter(
      (args) =>
        args.length === 1 &&
        typeof args[0] === "string" &&
        /^\d{4}-\d{2}-\d{2}$/.test(String(args[0])),
    );
    expect(callsWithISOString.length).toBe(0);

    dateSpy.mockRestore();
  });

  it("renders a kind chip for every category present in the latest entry", () => {
    const latest = getLatestChangelog();
    const groups = groupChangelogItems(latest);
    // At least one group — build 49 has three.
    expect(groups.length).toBeGreaterThan(0);

    const { getByTestId, queryByTestId, getByText } = render(<WhatsNewScreen />);
    for (const group of groups) {
      // Kind chips are View containers with testID. The chip contains a
      // Text child with the human label — use getByText to assert the label.
      const chip = getByTestId(`whats-new-section-${group.kind}`);
      expect(chip).toBeDefined();
      // The chip label text must be present in the rendered tree.
      expect(getByText(changelogKindLabel(group.kind))).toBeDefined();
    }
    // Kinds not present in the entry must NOT emit a chip.
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

  it("renders a 'Done' button that pops via useSafeBack", () => {
    // Re-pinned: headers census 2026-06-10. The screen moved off the native
    // stack header (centred system-font title + `setOptions` headerRight) onto
    // the canonical PushScreenHeader. The "Done" dismissal survives as the
    // header's `rightSlot`. We now assert the rendered button + its press
    // behaviour directly instead of inspecting native `setOptions`.
    backSpy.mockClear();
    canGoBackSpy.mockReturnValue(true);

    const { getByLabelText } = render(<WhatsNewScreen />);
    fireEvent.press(getByLabelText("Done"));
    expect(backSpy).toHaveBeenCalledTimes(1);
  });

  it("renders a serif Newsreader nav title (gap 2 — typography)", () => {
    // Re-pinned: headers census 2026-06-10. The title now renders via
    // PushScreenHeader using `Type.navTitle` (Newsreader serif 18/22) instead of
    // a native `headerTitleStyle`. Assert the rendered title text carries a
    // Newsreader family in its resolved style.
    const { getByText } = render(<WhatsNewScreen />);
    const titleEl = getByText("What's new");
    const flat = Array.isArray(titleEl.props.style)
      ? Object.assign({}, ...titleEl.props.style.flat(Infinity))
      : titleEl.props.style;
    expect(String(flat?.fontFamily ?? "")).toMatch(/Newsreader/);
  });
});
