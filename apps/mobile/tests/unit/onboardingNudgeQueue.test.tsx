// @vitest-environment jsdom
/**
 * OnboardingNudgeBanner + useNextNudge — post-launch nudge queue
 * regression pin.
 *
 * Pins the user-visible contract of the Today nudge queue:
 *   1. Priority order — wave-2 (2026-04-30 audit-vs-competitors) the
 *      catalogue is declared **import → recipes → permissions** so the
 *      first-time user is asked to seed a library before being asked
 *      for HealthKit. Cal AI defers HK until after the first food log
 *      for the same reason: the OS-prompt blow-rate goes way down once
 *      the user has felt the value.
 *   2. Eligibility — each nudge carries a runtime predicate so we
 *      surface the right one at the right moment, not just the highest
 *      priority that happens to be eligible by cooldown alone:
 *        • `import`      — only while libraryCount < 3
 *        • `recipes`     — only while libraryCount < 5
 *        • `permissions` — only after lifetimeMealCount >= 3 AND OS
 *                          notifications status is "undetermined"
 *   3. Cooldown — a "Maybe later" tap writes a timestamp; with the
 *      cooldown still in flight the queue advances to the next eligible.
 *   4. Permanent removal — a primary-action tap on `permissions` is
 *      treated as the user having answered the OS prompt; the banner
 *      drops from the queue forever (the `removed` flag is written),
 *      not just for the cooldown window.
 *   5. Routing — primary action on `import` calls `router.push` with
 *      `/import-shared`; on `recipes` it calls
 *      `router.push("/(tabs)/library")`.
 *   6. Health permission API — primary action on `permissions` calls
 *      the same `requestHealthPermissions` helper as the onboarding
 *      step (no parallel implementation, no local-flag fallback).
 *   7. "Maybe later" path — does NOT fire any of the OS or routing
 *      handlers; only writes the timestamp.
 *   8. OS-already-answered gate — when `Notifications.getPermissionsAsync`
 *      returns `granted` or `denied`, the permissions nudge is skipped
 *      regardless of cooldown / lifetime count. The OS answer wins.
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
type NotifPermStatus = "granted" | "denied" | "undetermined";
const notifGetSpy = vi.fn(
  async (): Promise<{ status: NotifPermStatus }> => ({ status: "undetermined" }),
);
const notifRequestSpy = vi.fn(
  async (): Promise<{ status: NotifPermStatus }> => ({ status: "granted" }),
);
vi.mock("expo-notifications", () => ({
  getPermissionsAsync: notifGetSpy,
  requestPermissionsAsync: notifRequestSpy,
  AndroidImportance: { DEFAULT: 3 },
  setNotificationChannelAsync: vi.fn(async () => {}),
}));

// Supabase mock — the banner queries `nutrition_entries` for the user's
// lifetime meal count to gate the permissions nudge. Tests can override
// the count by setting `mockLifetimeMealCount` before rendering.
let mockLifetimeMealCount = 0;
vi.mock("@/lib/supabase", () => {
  const builder = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockImplementation(function (this: typeof builder) {
      // The query chain is: .from("nutrition_entries").select("id", { count, head }).eq("user_id", id)
      // Resolve the eq() with the configured count, no error.
      return Promise.resolve({ count: mockLifetimeMealCount, error: null });
    }),
  };
  return {
    supabase: {
      from: vi.fn(() => builder),
    },
  };
});

// --- System under test --------------------------------------------------
// Imported after `vi.mock` calls so the mocks are registered before the
// banner's transitive deps (auth, theme, healthSync, expoPushToken,
// expo-router, supabase) resolve. The hoisting that vitest does on
// `vi.mock` keeps this safe.

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

/**
 * Default props for the banner — represent a brand-new user with zero
 * library + zero lifetime logs. Override per test for the eligibility
 * gates this suite cares about.
 */
function defaultProps() {
  return {
    mealsTodayCount: 1,
    libraryCount: 0,
  };
}

beforeEach(async () => {
  routerPush.mockClear();
  routerReplace.mockClear();
  requestHealthPermissionsSpy.mockClear();
  markNotificationsPromptDismissedSpy.mockClear();
  registerExpoPushTokenForUserSpy.mockClear();
  notifGetSpy.mockClear();
  notifGetSpy.mockResolvedValue({ status: "undetermined" });
  notifRequestSpy.mockClear();
  notifRequestSpy.mockResolvedValue({ status: "granted" });
  mockLifetimeMealCount = 0;
  await clearNudgeStorage();
});

afterEach(async () => {
  await clearNudgeStorage();
});

describe("OnboardingNudgeBanner (post-launch nudge queue)", () => {
  it("renders the import nudge first when the library is empty", async () => {
    // Wave-2: import is the highest-priority nudge for a fresh user
    // (libraryCount < 3 → eligible). Permissions is skipped because
    // lifetimeMealCount defaults to 0 (< 3).
    const { findByText } = render(<OnboardingNudgeBanner {...defaultProps()} />);
    expect(await findByText("Import recipes from anywhere")).toBeTruthy();
  });

  it("declares nudges in the documented priority order (import, recipes, permissions)", () => {
    expect(ONBOARDING_NUDGES.map((n) => n.id)).toEqual([
      "import",
      "recipes",
      "permissions",
    ]);
  });

  it("advances to recipes when import is on cooldown but library is still small", async () => {
    // Cooldown for import is 7 days — seed a dismissal 1 day ago.
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    await seedDismissed("import", oneDayAgo);

    const { findByText, queryByText } = render(
      <OnboardingNudgeBanner {...defaultProps()} libraryCount={2} />,
    );
    expect(await findByText("Seed your week with a few recipes")).toBeTruthy();
    expect(queryByText("Import recipes from anywhere")).toBeNull();
  });

  it("falls through to permissions only after lifetimeMealCount >= 3 and library is stocked", async () => {
    // libraryCount >= 5 disqualifies both import + recipes; lifetime
    // count >= 3 + undetermined OS status make permissions eligible.
    mockLifetimeMealCount = 5;
    const { findByText } = render(
      <OnboardingNudgeBanner {...defaultProps()} libraryCount={5} />,
    );
    expect(await findByText("Connect Apple Health?")).toBeTruthy();
  });

  it("hides the permissions nudge when lifetimeMealCount < 3 even if library is stocked", async () => {
    // Library disqualifies import + recipes; permissions wants >= 3
    // lifetime entries — we have 2.
    mockLifetimeMealCount = 2;
    const { queryByText } = render(
      <OnboardingNudgeBanner {...defaultProps()} libraryCount={5} />,
    );
    await waitFor(() => {
      expect(queryByText("Connect Apple Health?")).toBeNull();
      expect(queryByText("Import recipes from anywhere")).toBeNull();
      expect(queryByText("Seed your week with a few recipes")).toBeNull();
    });
  });

  it("hides the permissions nudge when OS already returned 'granted'", async () => {
    // The OS has answered — re-asking is noise. Even with a stocked
    // library + plenty of lifetime entries, the nudge must not surface.
    notifGetSpy.mockResolvedValue({ status: "granted" });
    mockLifetimeMealCount = 10;
    const { queryByText } = render(
      <OnboardingNudgeBanner {...defaultProps()} libraryCount={10} />,
    );
    await waitFor(() => {
      expect(queryByText("Connect Apple Health?")).toBeNull();
    });
  });

  it("hides the permissions nudge when OS already returned 'denied'", async () => {
    notifGetSpy.mockResolvedValue({ status: "denied" });
    mockLifetimeMealCount = 10;
    const { queryByText } = render(
      <OnboardingNudgeBanner {...defaultProps()} libraryCount={10} />,
    );
    await waitFor(() => {
      expect(queryByText("Connect Apple Health?")).toBeNull();
    });
  });

  it("hides the import nudge once the library is past the threshold", async () => {
    // libraryCount >= 3 disqualifies import.
    const { queryByText, findByText } = render(
      <OnboardingNudgeBanner {...defaultProps()} libraryCount={3} />,
    );
    // Library is still under the recipes-nudge threshold (5), so the
    // recipes nudge is the next eligible one.
    expect(await findByText("Seed your week with a few recipes")).toBeTruthy();
    expect(queryByText("Import recipes from anywhere")).toBeNull();
  });

  it("renders nothing when every nudge is on cooldown and library is small", async () => {
    const recent = new Date(Date.now() - 60 * 1000).toISOString();
    await seedDismissed("import", recent);
    await seedDismissed("recipes", recent);
    // permissions is already ineligible (lifetimeMealCount = 0 default)

    const { queryByText } = render(<OnboardingNudgeBanner {...defaultProps()} />);
    await waitFor(() => {
      expect(queryByText("Connect Apple Health?")).toBeNull();
      expect(queryByText("Import recipes from anywhere")).toBeNull();
      expect(queryByText("Seed your week with a few recipes")).toBeNull();
    });
  });

  it("re-shows a nudge after its cooldown has elapsed", async () => {
    // Import cooldown is 7 days; seed a dismissal 8 days ago.
    const eightDaysAgo = new Date(
      Date.now() - 8 * 24 * 60 * 60 * 1000,
    ).toISOString();
    await seedDismissed("import", eightDaysAgo);

    const { findByText } = render(<OnboardingNudgeBanner {...defaultProps()} />);
    expect(await findByText("Import recipes from anywhere")).toBeTruthy();
  });

  it("'Maybe later' on import writes a timestamp and queues recipes next", async () => {
    const view = render(<OnboardingNudgeBanner {...defaultProps()} />);
    const laterBtn = await view.findByLabelText(
      "Maybe later — Import recipes from anywhere",
    );

    await act(async () => {
      fireEvent.press(laterBtn);
    });

    // The selector re-runs after the dismissal write; recipes is the
    // next eligible one (libraryCount < 5 default).
    expect(await view.findByText("Seed your week with a few recipes")).toBeTruthy();

    // Cooldown timestamp written; permanent flag NOT written ("later"
    // is reversible after cooldown).
    const ts = await AsyncStorage.getItem(nudgeLastDismissedKey("import"));
    expect(ts).toBeTruthy();
    expect(Number.isFinite(Date.parse(ts!))).toBe(true);
    const removed = await AsyncStorage.getItem(nudgeRemovedKey("import"));
    expect(removed).toBeNull();

    // OS prompts must NOT have fired — "later" is the silent path.
    expect(requestHealthPermissionsSpy).not.toHaveBeenCalled();
    expect(notifRequestSpy).not.toHaveBeenCalled();
    expect(routerPush).not.toHaveBeenCalled();
  });

  it("primary action on permissions calls the real HealthKit + Notifications APIs and drops the nudge permanently", async () => {
    // Make permissions the head of the queue: stocked library + felt-
    // value lifetime count + still-undetermined OS status.
    mockLifetimeMealCount = 5;
    const view = render(
      <OnboardingNudgeBanner {...defaultProps()} libraryCount={10} />,
    );
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
  });

  it("primary action on import routes to /import-shared and stays in the queue (cooldown only)", async () => {
    const view = render(<OnboardingNudgeBanner {...defaultProps()} />);
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
    // Library at 3 → import disqualified, recipes still eligible (< 5).
    const view = render(
      <OnboardingNudgeBanner {...defaultProps()} libraryCount={3} />,
    );
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

  it("permanently-removed permissions never reappears even after the OS returns to undetermined", async () => {
    // Even if some external state would re-qualify permissions, the
    // removed flag wins.
    await seedRemoved("permissions");
    mockLifetimeMealCount = 100;
    const view = render(
      <OnboardingNudgeBanner {...defaultProps()} libraryCount={50} />,
    );
    await waitFor(() => {
      expect(view.queryByText("Connect Apple Health?")).toBeNull();
    });
  });

  it("a corrupt dismissal timestamp is treated as 'never dismissed' (banner shows)", async () => {
    await AsyncStorage.setItem(
      nudgeLastDismissedKey("import"),
      "not-a-real-iso-string",
    );
    const view = render(<OnboardingNudgeBanner {...defaultProps()} />);
    expect(await view.findByText("Import recipes from anywhere")).toBeTruthy();
  });
});
