// @vitest-environment jsdom
/**
 * OnboardingNudgeBanner + useNextNudge — post-launch nudge queue
 * regression pin (2026-04-30 follow-up to the 15→12 onboarding shrink).
 *
 * Pins the user-visible contract of the Today nudge queue:
 *   1. Priority order — when no nudge has been dismissed, the
 *      `permissions` banner renders first.
 *   2. Cooldown — a "Maybe later" tap on `permissions` writes a
 *      timestamp; with the cooldown still in flight the queue
 *      advances to `import` (next priority).
 *   3. Permanent removal — a primary-action tap on `permissions` is
 *      treated as the user having answered the OS prompt; the banner
 *      drops from the queue forever (the `removed` flag is written),
 *      not just for the cooldown window.
 *   4. Routing — primary action on `import` calls `router.push`
 *      with `/import-shared`; on `recipes` it calls
 *      `router.push("/(tabs)/library")`.
 *   5. Health permission API — primary action on `permissions` calls
 *      the same `requestHealthPermissions` helper as the onboarding
 *      step (no parallel implementation, no local-flag fallback).
 *   6. "Maybe later" path — does NOT fire any of the OS or routing
 *      handlers; only writes the timestamp.
 *
 * The hook hydrates dismissal state from AsyncStorage on mount;
 * each test seeds the in-memory store via the shim's `setItem` BEFORE
 * rendering, so the hook reads the seeded value during hydration.
 */
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, waitFor } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

void React;

// --- Theme + auth + router mocks ----------------------------------------

vi.mock("@/hooks/use-theme-colors", () => ({
  useThemeColors: () => ({
    text: "#000",
    textSecondary: "#555",
    textTertiary: "#888",
    background: "#fff",
    card: "#f7f7f7",
    border: "#eee",
    cardBorder: "#eee",
    inputBg: "#f0f0f0",
  }),
}));

vi.mock("@/context/auth", () => ({
  useAuth: () => ({
    session: { user: { id: "test-user-id" } },
  }),
}));

const routerPush = vi.fn();
const routerReplace = vi.fn();
vi.mock("expo-router", () => ({
  useRouter: () => ({ push: routerPush, replace: routerReplace, back: vi.fn() }),
}));

// --- OS-permission spies — the nudge banner must reuse the same helpers
//     as `apps/mobile/components/onboarding/steps/permissions.tsx`. We
//     spy on the imports so a regression that introduces a parallel
//     implementation (e.g. local AsyncStorage flag) trips the test.
const requestHealthPermissionsSpy = vi.fn(async () => ({
  ok: true as const,
  bodySyncReady: true,
  dietaryImportReady: true,
  userMessage: "ok",
}));
vi.mock("@/lib/healthSync", () => ({
  requestHealthPermissions: () => requestHealthPermissionsSpy(),
}));

const markNotificationsPromptDismissedSpy = vi.fn(async () => {});
const registerExpoPushTokenForUserSpy = vi.fn(
  async (_userId: string | null) => ({
    ok: true as const,
    token: "ExpoPushToken[stub]",
  }),
);
vi.mock("@/lib/expoPushToken", () => ({
  markNotificationsPromptDismissed: () => markNotificationsPromptDismissedSpy(),
  registerExpoPushTokenForUser: (id: string | null) =>
    registerExpoPushTokenForUserSpy(id),
}));

// expo-notifications is loaded via dynamic `import("expo-notifications")`
// inside the banner. We register a fake module on the resolver via
// `vi.mock` so the dynamic import resolves to our stub.
const notifGetSpy = vi.fn(async () => ({ status: "undetermined" as const }));
const notifRequestSpy = vi.fn(async () => ({ status: "granted" as const }));
vi.mock("expo-notifications", () => ({
  getPermissionsAsync: notifGetSpy,
  requestPermissionsAsync: notifRequestSpy,
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: vi.fn(async () => {}),
}));

// --- System under test --------------------------------------------------
// Imported after `vi.mock` calls so the mocks are registered before the
// banner's transitive deps (auth, theme, healthSync, expoPushToken,
// expo-router) resolve. The hoisting that vitest does on `vi.mock`
// keeps this safe.

// eslint-disable-next-line import/first
import {
  OnboardingNudgeBanner,
  ONBOARDING_NUDGES,
  nudgeLastDismissedKey,
  nudgeRemovedKey,
} from "../../components/today/onboarding-nudges";

// --- Helpers ------------------------------------------------------------

async function clearNudgeStorage() {
  for (const n of ONBOARDING_NUDGES) {
    await AsyncStorage.removeItem(nudgeLastDismissedKey(n.id));
    await AsyncStorage.removeItem(nudgeRemovedKey(n.id));
  }
}

async function seedDismissed(
  id: (typeof ONBOARDING_NUDGES)[number]["id"],
  isoTimestamp: string,
) {
  await AsyncStorage.setItem(nudgeLastDismissedKey(id), isoTimestamp);
}

async function seedRemoved(id: (typeof ONBOARDING_NUDGES)[number]["id"]) {
  await AsyncStorage.setItem(nudgeRemovedKey(id), "true");
}

beforeEach(async () => {
  routerPush.mockClear();
  routerReplace.mockClear();
  requestHealthPermissionsSpy.mockClear();
  markNotificationsPromptDismissedSpy.mockClear();
  registerExpoPushTokenForUserSpy.mockClear();
  notifGetSpy.mockClear();
  notifRequestSpy.mockClear();
  await clearNudgeStorage();
});

afterEach(async () => {
  await clearNudgeStorage();
});

describe("OnboardingNudgeBanner (post-launch nudge queue)", () => {
  it("renders the permissions nudge first when no dismissals exist", async () => {
    const { findByText } = render(<OnboardingNudgeBanner />);
    expect(await findByText("Connect Apple Health?")).toBeTruthy();
  });

  it("declares nudges in the documented priority order", () => {
    expect(ONBOARDING_NUDGES.map((n) => n.id)).toEqual([
      "permissions",
      "import",
      "recipes",
    ]);
  });

  it("advances to the import nudge when permissions is on cooldown but not removed", async () => {
    // Cooldown for permissions is 7 days — seed a dismissal 1 day ago.
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await seedDismissed("permissions", oneDayAgo);

    const { findByText, queryByText } = render(<OnboardingNudgeBanner />);
    expect(await findByText("Import recipes from anywhere")).toBeTruthy();
    expect(queryByText("Connect Apple Health?")).toBeNull();
  });

  it("advances to recipes when both permissions and import are within cooldown", async () => {
    const recent = new Date(Date.now() - 60 * 1000).toISOString();
    await seedDismissed("permissions", recent);
    await seedDismissed("import", recent);

    const { findByText } = render(<OnboardingNudgeBanner />);
    expect(await findByText("Seed your week with a few recipes")).toBeTruthy();
  });

  it("renders nothing when every nudge is on cooldown", async () => {
    const recent = new Date(Date.now() - 60 * 1000).toISOString();
    await seedDismissed("permissions", recent);
    await seedDismissed("import", recent);
    await seedDismissed("recipes", recent);

    const { queryByText } = render(<OnboardingNudgeBanner />);
    // Wait one tick for the hook to hydrate, then assert nothing rendered.
    await waitFor(() => {
      expect(queryByText("Connect Apple Health?")).toBeNull();
      expect(queryByText("Import recipes from anywhere")).toBeNull();
      expect(queryByText("Seed your week with a few recipes")).toBeNull();
    });
  });

  it("re-shows a nudge after its cooldown has elapsed", async () => {
    // Permissions cooldown is 7 days; seed a dismissal 8 days ago.
    const eightDaysAgo = new Date(
      Date.now() - 8 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await seedDismissed("permissions", eightDaysAgo);

    const { findByText } = render(<OnboardingNudgeBanner />);
    expect(await findByText("Connect Apple Health?")).toBeTruthy();
  });

  it("'Maybe later' on permissions writes a timestamp and queues import next", async () => {
    const view = render(<OnboardingNudgeBanner />);
    const laterBtn = await view.findByLabelText(
      "Maybe later — Connect Apple Health?",
    );

    await act(async () => {
      fireEvent.press(laterBtn);
    });

    // The selector re-runs after the dismissal write; the import nudge
    // is the next eligible one.
    expect(await view.findByText("Import recipes from anywhere")).toBeTruthy();

    // Cooldown timestamp written; permanent flag NOT written ("later"
    // is reversible after cooldown).
    const ts = await AsyncStorage.getItem(nudgeLastDismissedKey("permissions"));
    expect(ts).toBeTruthy();
    expect(Number.isFinite(Date.parse(ts!))).toBe(true);
    const removed = await AsyncStorage.getItem(nudgeRemovedKey("permissions"));
    expect(removed).toBeNull();

    // OS prompts must NOT have fired — "later" is the silent path.
    expect(requestHealthPermissionsSpy).not.toHaveBeenCalled();
    expect(notifRequestSpy).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("primary action on permissions calls the real HealthKit + Notifications APIs and drops the nudge permanently", async () => {
    const view = render(<OnboardingNudgeBanner />);
    const primary = await view.findByLabelText(
      "Connect — Connect Apple Health?",
    );

    await act(async () => {
      fireEvent.press(primary);
    });

    // Real OS APIs were called — exact wiring as
    // apps/mobile/components/onboarding/steps/permissions.tsx.
    await waitFor(() => {
      expect(requestHealthPermissionsSpy).toHaveBeenCalledTimes(1);
    });
    expect(notifGetSpy).toHaveBeenCalled();
    // status starts undetermined → request is fired
    expect(notifRequestSpy).toHaveBeenCalled();
    // grant succeeded in the stub → push token registered
    expect(registerExpoPushTokenForUserSpy).toHaveBeenCalledWith("test-user-id");
    // dismissal flag persisted so the standalone /notifications-prompt
    // never re-asks
    expect(markNotificationsPromptDismissedSpy).toHaveBeenCalled();

    // Permanent removal flag written (catalogue's `removeOnAction: true`).
    await waitFor(async () => {
      const removed = await AsyncStorage.getItem(
        nudgeRemovedKey("permissions"),
      );
      expect(removed).toBe("true");
    });

    // Queue advances to import.
    expect(await view.findByText("Import recipes from anywhere")).toBeTruthy();
  });

  it("primary action on import routes to /import-shared and stays in the queue (cooldown only)", async () => {
    // Seed permissions as already removed so import is the head.
    await seedRemoved("permissions");

    const view = render(<OnboardingNudgeBanner />);
    const primary = await view.findByLabelText(
      "Try it — Import recipes from anywhere",
    );

    await act(async () => {
      fireEvent.press(primary);
    });

    expect(routerPush).toHaveBeenCalledWith("/import-shared");
    // import has `removeOnAction: false` — only the timestamp is written.
    await waitFor(async () => {
      const ts = await AsyncStorage.getItem(nudgeLastDismissedKey("import"));
      expect(ts).toBeTruthy();
    });
    const removed = await AsyncStorage.getItem(nudgeRemovedKey("import"));
    expect(removed).toBeNull();
  });

  it("primary action on recipes routes to the Library tab", async () => {
    await seedRemoved("permissions");
    const recent = new Date(Date.now() - 60 * 1000).toISOString();
    await seedDismissed("import", recent);

    const view = render(<OnboardingNudgeBanner />);
    const primary = await view.findByLabelText(
      "Browse — Seed your week with a few recipes",
    );

    await act(async () => {
      fireEvent.press(primary);
    });

    expect(routerPush).toHaveBeenCalledWith("/(tabs)/library");
    const removed = await AsyncStorage.getItem(nudgeRemovedKey("recipes"));
    expect(removed).toBeNull();
  });

  it("permanently-removed permissions never reappears even after years pass", async () => {
    await seedRemoved("permissions");
    // Even with no dismissal timestamp at all, the removed flag wins.
    const view = render(<OnboardingNudgeBanner />);
    expect(await view.findByText("Import recipes from anywhere")).toBeTruthy();
    expect(view.queryByText("Connect Apple Health?")).toBeNull();
  });

  it("a corrupt dismissal timestamp is treated as 'never dismissed' (banner shows)", async () => {
    await AsyncStorage.setItem(
      nudgeLastDismissedKey("permissions"),
      "not-a-real-iso-string",
    );
    const view = render(<OnboardingNudgeBanner />);
    expect(await view.findByText("Connect Apple Health?")).toBeTruthy();
  });
});
