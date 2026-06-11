"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
// ENG-1044 — canonical primary-nav glyph set, locked to the native iOS
// tab bar: Today=Calendar, Plan=BookOpen, Recipes=Utensils,
// Progress=BarChart3. (Was Sun / BookOpen / CalendarDays / LineChart,
// which both diverged from native AND collided — BookOpen meant Recipes
// here but Plan on native.)
import { Plus, Calendar, BookOpen, Utensils, BarChart3 } from "lucide-react";
import { useFeatureFlagEnabled } from "posthog-js/react";
import { canonicalNavOrderEnabled } from "../lib/navigation/primaryNav.ts";
import { AnalyticsEvents, type PaywallViewedFrom } from "../lib/analytics/events.ts";
import { track } from "../lib/analytics/track.ts";
import { Icons } from "./components/ui/icons";
import { SupprPlateWordmark } from "./components/ui/suppr-mark";
import dynamic from "next/dynamic";
import { DiscoverFeed } from "./components/DiscoverFeed.tsx";
import { NotificationsBell } from "./components/NotificationsBell.tsx";
import { Library } from "./components/Library.tsx";
import { AppLoadingSkeleton } from "./components/AppLoadingSkeleton.tsx";
import { DesktopSidebar, resolvePrimaryFromView, type SidebarView } from "./components/suppr/desktop-sidebar.tsx";
import { SubTabPill } from "./components/ui/sub-tab-pill.tsx";
import { RecipesTabChrome } from "./components/suppr/recipes-tab-chrome.tsx";
import { PlanTabChrome } from "./components/suppr/plan-tab-chrome.tsx";

const NotificationsCenter = dynamic(
  () => import("./components/NotificationsCenter.tsx").then((m) => ({ default: m.NotificationsCenter })),
  { ssr: false, loading: () => <AppLoadingSkeleton label="Loading notifications..." /> },
);
const MealPlanner = dynamic(
  () => import("./components/MealPlanner.tsx").then((m) => ({ default: m.MealPlanner })),
  { ssr: false, loading: () => <AppLoadingSkeleton label="Loading planner..." /> },
);
const Profile = dynamic(
  () => import("./components/Profile.tsx").then((m) => ({ default: m.Profile })),
  { ssr: false, loading: () => <AppLoadingSkeleton label="Loading profile..." /> },
);
const NutritionTracker = dynamic(
  () => import("./components/NutritionTracker.tsx").then((m) => ({ default: m.NutritionTracker })),
  { ssr: false, loading: () => <AppLoadingSkeleton label="Loading tracker..." /> },
);
const ProgressDashboard = dynamic(
  () => import("./components/ProgressDashboard.tsx").then((m) => ({ default: m.ProgressDashboard })),
  { ssr: false, loading: () => <AppLoadingSkeleton label="Loading progress..." /> },
);
const ShoppingList = dynamic(
  () => import("./components/ShoppingList.tsx").then((m) => ({ default: m.ShoppingList })),
  { ssr: false, loading: () => <AppLoadingSkeleton label="Loading shopping list..." /> },
);
const Targets = dynamic(
  () => import("./components/Targets.tsx").then((m) => ({ default: m.Targets })),
  { ssr: false, loading: () => <AppLoadingSkeleton label="Loading targets..." /> },
);
const Settings = dynamic(
  () => import("./components/Settings.tsx").then((m) => ({ default: m.Settings })),
  { ssr: false, loading: () => <AppLoadingSkeleton label="Loading settings..." /> },
);
const RecipeUpload = dynamic(
  () => import("./components/RecipeUpload.tsx").then((m) => ({ default: m.RecipeUpload })),
  { ssr: false, loading: () => <AppLoadingSkeleton label="Loading recipe editor..." /> },
);
const UpgradePaywallDialog = dynamic(
  () =>
    import("./components/suppr/upgrade-paywall-dialog.tsx").then((m) => ({
      default: m.UpgradePaywallDialog,
    })),
  { ssr: false },
);
import { useAppData } from "../context/AppDataContext.tsx";
import { FirstRunChecklist } from "./components/FirstRunChecklist.tsx";
import { FeatureErrorBoundary } from "./components/FeatureErrorBoundary.tsx";

type View =
  | "today"
  | "discover"
  | "plan"
  | "progress"
  | "profile"
  | "library"
  | "shopping"
  | "settings"
  | "notifications"
  | "create"
  | "import"
  | "targets";

/**
 * RecipesSubTabPill / YouSubTabPill — pre-2026-04-28 these were two
 * inline pill components (~80 LOC of near-clone JSX) sitting at the
 * top of `App.tsx`. The teardown's F5 finding called this out:
 * "the implementation isn't a sub-tab system; it's two custom pill
 * components and listener hacks that defeat the tab framework's
 * defaults". Both are now thin callers of the shared
 * `<SubTabPill>` primitive in `./components/ui/sub-tab-pill.tsx`,
 * which mirrors the mobile primitive at byte-identical contract.
 *
 * The `md:hidden sticky top-0 z-40 border-b border-border bg-card/95
 * backdrop-blur-md` wrapper preserves the sticky-header behaviour
 * the old inline components carried — kept here in the host so the
 * primitive stays generic.
 */
function YouSubTabPill({
  currentView,
  onNavigate,
}: {
  currentView: "progress" | "settings";
  onNavigate: (view: "progress" | "settings") => void;
}) {
  return (
    <div className="md:hidden sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md">
      <SubTabPill
        items={[
          { id: "progress", label: "Progress" },
          { id: "settings", label: "Settings" },
        ]}
        activeId={currentView}
        onSelect={onNavigate}
        accessibilityLabel="You sections"
      />
    </div>
  );
}

export default function App() {
  const {
    profileTier: userTier,
    profileDisplayName: displayName,
    authEmail,
    refreshProfileBasics,
    shoppingItems,
  } = useAppData();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const deepLinkRecipeId = searchParams.get("recipe");
  const viewParam = searchParams.get("view");
  // 2026-05-12 (premium-bar audit refuse-to-pass #2 — real per-tab
  // web URLs): derive the canonical view from the pathname when the
  // user types or bookmarks `/today`, `/library`, `/plan`, etc.
  // `?view=` stays supported as a legacy alias so old links still
  // route to the right tab. The pathname-derived view ALWAYS wins
  // over `?view=` because the path is the user-facing canonical
  // identifier.
  const pathDerivedView = useMemo<View | null>(() => {
    if (!pathname) return null;
    const seg = pathname.replace(/^\/+|\/+$/g, "").split("/")[0];
    const pathMap: Record<string, View> = {
      today: "today",
      recipes: "library",
      library: "library",
      discover: "discover",
      plan: "plan",
      planner: "plan",
      progress: "progress",
      shopping: "shopping",
      settings: "settings",
      notifications: "notifications",
      targets: "targets",
      create: "create",
      import: "import",
      profile: "profile",
    };
    return pathMap[seg] ?? null;
  }, [pathname]);
  const [currentView, setCurrentView] = useState<View>("today");
  const [settingsScrollToPromo, setSettingsScrollToPromo] = useState(false);
  const [plannerMobileTab, setPlannerMobileTab] = useState<"plan" | "shop">("plan");

  // ENG-1017 / ENG-1044 — canonical Plan-first tab order for mobile-web
  // bottom nav (matches native iOS). Defaults ON while PostHog loads.
  const navPlanFirst = canonicalNavOrderEnabled(
    useFeatureFlagEnabled("nav-tab-order-plan-first"),
  );
  // Upgrade-paywall dialog (2026-04-20 Claude Design port). When
  // `upgradePaywallFrom` is non-null the `<UpgradePaywallDialog>`
  // renders with that attribution. Opened via `openUpgradeDialog()`,
  // closed via the dialog's internal dismiss paths.
  const [upgradePaywallFrom, setUpgradePaywallFrom] = useState<PaywallViewedFrom | null>(null);

  const normalizedViewParam = useMemo(() => {
    if (!viewParam) return null;
    let v = viewParam.toLowerCase();
    if (v === "upload") v = "create";
    if (v === "tracker") v = "today";
    if (v === "planner") v = "plan";
    const allowed: View[] = [
      "today",
      "discover",
      "plan",
      "progress",
      "profile",
      "library",
      "shopping",
      "settings",
      "notifications",
      "create",
      "import",
      "targets",
    ];
    return (allowed as string[]).includes(v) ? (v as View) : null;
  }, [viewParam]);

  // URL → state. Precedence: pathname-derived view > ?view= legacy
  // alias. Re-runs on either input change so deep links + back/forward
  // navigation update the current tab correctly.
  useEffect(() => {
    const resolved = pathDerivedView ?? normalizedViewParam;
    if (resolved && resolved !== currentView) {
      setCurrentView(resolved);
    }
  }, [pathDerivedView, normalizedViewParam, currentView]);

  // 2026-05-12 (premium-bar audit refuse-to-pass #2): the previous
  // /home fallback that auto-pushed `?view=today` is gone — the
  // canonical landing is now `/today`. /home renders the SPA shell
  // for legacy URLs but the redirect to populate `?view=today` is
  // no longer fired. Pages that mount HomePageClient under a
  // canonical path (/today, /library, /plan, etc.) supply the view
  // via pathname; /home with no params resolves to "today" via the
  // useState initial value.
  useEffect(() => {
    if (pathname !== "/home") return;
    if (searchParams.get("view")) return;
    // Shared recipe links use ?recipe= without view; don't stomp them with view=today.
    if (searchParams.get("recipe")?.trim()) return;
    // No-op on legacy /home — let the initial currentView ("today")
    // stand. We don't push a redirect so the URL bar stays /home
    // for users on the legacy entry point.
  }, [pathname, searchParams]);

  const recipeDeepLinkId = searchParams.get("recipe")?.trim() ?? "";
  useEffect(() => {
    if (!recipeDeepLinkId) return;
    setCurrentView("discover");
    if (pathname?.startsWith("/discover")) return;
    const p = new URLSearchParams(searchParams.toString());
    p.delete("view");
    const q = p.toString();
    router.replace(q ? `/discover?${q}` : "/discover", { scroll: false });
  }, [recipeDeepLinkId, pathname, searchParams, router]);

  // 2026-05-12 (premium-bar audit refuse-to-pass #2): nav now pushes
  // path-based URLs so the browser bar shows `/today`, `/library`,
  // `/discover`, etc. instead of `/home?view=X`. Deep-linked recipe
  // queries are preserved on top of the canonical path. Legacy
  // `/home?view=` URLs continue to resolve (the App still reads
  // `?view=` as a fallback alias), but new navigation always lands
  // on the canonical path.
  const PATH_FOR_VIEW: Record<View, string> = useMemo(
    () => ({
      today: "/today",
      library: "/library",
      discover: "/discover",
      plan: "/plan",
      progress: "/progress",
      shopping: "/shopping",
      settings: "/settings",
      notifications: "/notifications",
      profile: "/profile",
      create: "/create",
      import: "/import",
      targets: "/targets",
    }),
    [],
  );
  const navigateToView = useCallback(
    (view: View) => {
      setCurrentView(view);
      const path = PATH_FOR_VIEW[view] ?? "/today";
      // 2026-05-12 (premium-bar audit refuse-to-pass #2): in-app tab
      // switching uses the History API directly so Next's router
      // doesn't unmount + remount HomePageClient on every tab change
      // (each canonical path is its own `page.tsx` rendering
      // HomePageClient — `router.replace` would trigger a full
      // remount + re-fetch of user data). The history-based path
      // change keeps the SPA mounted; deep links + back/forward
      // (which DO fire Next's pathname change) still trigger the
      // path→view useEffect at the top of this component to land
      // on the right tab. Belt-and-braces: fall back to router.replace
      // when window.history is unavailable (SSR / edge cases).
      if (
        typeof window !== "undefined" &&
        window.history &&
        typeof window.history.replaceState === "function"
      ) {
        const params = new URLSearchParams(window.location.search);
        params.delete("view");
        if (view !== "progress") {
          params.delete("metric");
        }
        const q = params.toString();
        window.history.replaceState({}, "", q ? `${path}?${q}` : path);
      } else {
        router.replace(path, { scroll: false });
      }
    },
    [PATH_FOR_VIEW, router],
  );

  // 2026-05-12 (premium-bar audit refuse-to-pass #2): clearRecipeQuery
  // now lands on the canonical path-based URL (`/today` etc.) instead
  // of `/home?view=today`. The view is derived from the destination
  // path; legacy `?view=` is no longer added.
  const clearRecipeQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("recipe");
    params.delete("cook");
    params.delete("portions");
    params.delete("view");
    const q = params.toString();
    // Default destination is /today. If we're already on a canonical
    // path (e.g. /discover with a recipe open), keep that path and
    // just strip the recipe params.
    const currentPath = pathname && pathname !== "/home" ? pathname : "/today";
    router.replace(q ? `${currentPath}?${q}` : currentPath, { scroll: false });
  }, [pathname, router, searchParams]);

  const openRecipeById = useCallback(
    (recipeId: string, opts?: { cook?: boolean; portions?: number }) => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("view");
      params.set("recipe", recipeId);
      if (opts?.cook) params.set("cook", "1");
      if (opts?.portions != null && opts.portions !== 1) {
        params.set("portions", String(opts.portions));
      }
      const q = params.toString();
      router.replace(q ? `/discover?${q}` : "/discover", { scroll: false });
      setCurrentView("discover");
    },
    [router, searchParams],
  );

  /**
   * openLogSheetFromTabBar — handler for the centered raised Plus
   * button that lives between the Recipes and Plan tabs in the
   * mobile-web bottom `<nav>`.
   *
   * 2026-04-30 (web mobile-web parity with mobile commit `6633d2d`):
   * the side `<LogFab>` (right:18 / bottom:100) is replaced by a
   * centered raised tab-bar button matching the new mobile pattern
   * (`<SupprTabBar>` + `<LogTabBarButton>`). The 4-tab IA from
   * D-2026-04-27-02 is preserved — the raised button is purely a UI
   * element, not a 5th view.
   *
   * Behaviour mirrors mobile's `router.push({ pathname: "/(tabs)",
   *  params: { openLog: "1" } })`: navigate to Today and stamp
   * `?openLog=1` on the URL. `<NutritionTracker>` consumes the param
   * via `useSearchParams`, opens the canonical `<LogSheet>`, and
   * clears the param so a back-nav doesn't re-open the sheet.
   *
   * Routing the trigger through the URL (vs a CustomEvent or shared
   * state) means the raised button works from any tab — even when
   * `<NutritionTracker>` is not yet mounted (Plan / You / Recipes).
   * The `view=today` switch unmounts the current view and mounts
   * NutritionTracker, which then sees `openLog=1` on first render
   * and opens the sheet.
   *
   * Desktop (≥ md) does not render the raised button per
   * D-2026-04-27-11 (web is the long-form companion; daily logging
   * is a phone activity), so this handler only fires from
   * mobile-web. The raised button itself is gated by `md:hidden` on
   * the host `<nav>` block.
   *
   * Analytics: the legacy `<LogFab>` did not fire any tracking event
   * of its own (open-of-LogSheet is captured downstream by the
   * LogSheet's own analytics), so there is no event to migrate.
   */
  const openLogSheetFromTabBar = useCallback(() => {
    setCurrentView("today");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("view");
    params.set("openLog", "1");
    const q = params.toString();
    router.replace(q ? `/today?${q}` : "/today?openLog=1", { scroll: false });
  }, [router, searchParams]);

  const shoppingUncheckedCount = useMemo(
    () => shoppingItems.filter((i) => !i.checked).length,
    [shoppingItems],
  );

  const clearSettingsScrollToPromo = useCallback(() => setSettingsScrollToPromo(false), []);

  // Debounce guard for the Settings-promo paywall_viewed emit (2026-04-19):
  // a parent render loop can trigger `openUpgradePromo` twice within a tick
  // if the button is a child of a component that re-renders on the same
  // state change. 500ms is long enough to collapse those re-render bursts
  // without swallowing a deliberate second tap (which is a valid funnel
  // signal a few seconds later).
  const upgradePromoTrackedAtRef = useRef<number>(0);
  // Round-3 (2026-04-19, analytics-engineer spec): `from` is a REQUIRED
  // non-optional argument so TypeScript fails compile if any new call
  // site forgets to attribute the surface. Previously every upgrade
  // entry point (Library, Profile, Shopping List, Recipe create/import,
  // Meal Planner) collapsed into a single `from: "meal_planner"` emit
  // that broke the F2 funnel slice. `gateReason` is optional free-text
  // context (e.g. "over 10 saves", "multi-day plan") that rides along
  // for deeper slicing when a call site has it.
  const openUpgradePromo = useCallback(
    (from: PaywallViewedFrom, gateReason?: string) => {
      const now = Date.now();
      if (now - upgradePromoTrackedAtRef.current > 500) {
        upgradePromoTrackedAtRef.current = now;
        // Canonical `paywall_viewed` contract (L6 G9 + 2026-04-19 round-2):
        // every emit carries `{ from, tier, surface, platform }`. The
        // Settings promo panel is the in-app upsell surface (vs the
        // `/pricing` route), so `surface: "promo_panel"` stays pinned.
        // `gate_reason` rides along only when the caller set it —
        // omitted entirely otherwise so the property doesn't pollute
        // PostHog with explicit `undefined` values.
        const payload: Record<string, unknown> = {
          from,
          tier: "pro",
          surface: "promo_panel",
          platform: "web",
        };
        if (gateReason !== undefined) {
          payload.gate_reason = gateReason;
        }
        track(AnalyticsEvents.paywall_viewed, payload);
      }
      setSettingsScrollToPromo(true);
      navigateToView("settings");
    },
    [navigateToView],
  );

  useEffect(() => {
    if (currentView !== "settings") {
      setSettingsScrollToPromo(false);
    }
  }, [currentView]);

  useEffect(() => {
    if (currentView !== "plan") {
      setPlannerMobileTab("plan");
    }
  }, [currentView]);

  useEffect(() => {
    if (searchParams.get("checkout") !== "success") return;
    void refreshProfileBasics().then(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("checkout");
      params.delete("view");
      const q = params.toString();
      router.replace(q ? `/today?${q}` : "/today", { scroll: false });
    });
  }, [searchParams, router, refreshProfileBasics]);

  const renderView = () => {
    switch (currentView) {
      case "today":
        return (
          <FeatureErrorBoundary feature="Nutrition Tracker">
            <NutritionTracker
              userTier={userTier}
              onOpenProgress={() => navigateToView("progress")}
              onOpenSettings={() => navigateToView("settings")}
            />
          </FeatureErrorBoundary>
        );
      case "discover":
        return (
          <>
            <RecipesTabChrome activeId="discover" onSelect={navigateToView} />
            <DiscoverFeed
              userTier={userTier}
              initialOpenRecipeId={deepLinkRecipeId}
              initialCookMode={searchParams.get("cook") === "1"}
              initialPortions={parseFloat(searchParams.get("portions") ?? "") || undefined}
              onConsumedDeepLinkRecipe={deepLinkRecipeId ? clearRecipeQuery : undefined}
              onViewTracker={() => navigateToView("today")}
            />
          </>
        );
      case "plan":
        return (
          <>
            <PlanTabChrome
              activeId={plannerMobileTab === "shop" ? "shopping" : "plan"}
              title={plannerMobileTab === "shop" ? "Shopping list" : "Meal plan"}
              shoppingUncheckedCount={shoppingUncheckedCount}
              onSelect={(id) => setPlannerMobileTab(id === "shopping" ? "shop" : "plan")}
            />
            {plannerMobileTab === "plan" ? (
              <FeatureErrorBoundary feature="Meal Planner"><MealPlanner
                userTier={userTier}
                // Round-3 (2026-04-19): attribute `paywall_viewed.from`
                // to the originating surface. Meal Planner's upgrade
                // gate is the Base-tier multi-day planner.
                onUpgrade={() => openUpgradePromo("meal_planner")}
                onNavigate={(view) => navigateToView(view)}
                onOpenRecipe={openRecipeById}
                onCookRecipe={(id, portion) => {
                  openRecipeById(id, {
                    cook: true,
                    ...(portion && portion !== 1 ? { portions: portion } : {}),
                  });
                }}
              /></FeatureErrorBoundary>
            ) : (
              <FeatureErrorBoundary feature="Shopping List"><ShoppingList userTier={userTier} onUpgrade={() => openUpgradePromo("shopping_list")} onNavigate={(view) => navigateToView(view as View)} /></FeatureErrorBoundary>
            )}
          </>
        );
      case "progress":
        return (
          <FeatureErrorBoundary feature="Progress">
            <ProgressDashboard />
          </FeatureErrorBoundary>
        );
      case "profile":
        // Group G IA Batch C (2026-04-29): /profile is now a drill-down
        // from the Settings header card's "Edit profile" link, not a
        // primary sub-tab. The mobile-web pill renders with Settings
        // highlighted so the user understands they are inside the
        // Settings flow; tapping Progress or Settings navigates back
        // up the IA tree.
        return (
          <>
            <Profile
              userTier={userTier}
              displayName={displayName}
              // Round-3 (2026-04-19): Profile upsell row fires with
              // `from: "profile"` so F2 can slice which tab surfaced the
              // upgrade intent.
              onUpgrade={() => openUpgradePromo("profile")}
              onOpenNutrition={() => navigateToView("today")}
            />
          </>
        );
      case "library":
        return (
          <>
            <RecipesTabChrome activeId="library" onSelect={navigateToView} />
            <Library userTier={userTier} onUpgrade={() => openUpgradePromo("recipes_library")} onGoDiscover={() => navigateToView("discover")} />
          </>
        );
      case "shopping":
        return <ShoppingList userTier={userTier} onUpgrade={() => openUpgradePromo("shopping_list")} onNavigate={(view) => navigateToView(view as View)} />;
      case "settings":
        return (
          <>
            <Settings
              userTier={userTier}
              authEmail={authEmail}
              scrollToPromoOnOpen={settingsScrollToPromo}
              onScrollToPromoConsumed={clearSettingsScrollToPromo}
            />
          </>
        );
      case "notifications":
        return <NotificationsCenter onOpenRecipe={openRecipeById} />;
      case "create":
        return (
          <FeatureErrorBoundary feature="Recipe Editor">
            <RecipeUpload
              userTier={userTier}
              // Round-3 (2026-04-19): mode is known at the wrap site so
              // the `from` attribution is unambiguous — `recipe_create`
              // vs `recipe_import` splits on the mode prop below.
              onUpgrade={() => openUpgradePromo("recipe_create")}
              mode="create"
              onSwitchToImport={() => navigateToView("import")}
            />
          </FeatureErrorBoundary>
        );
      case "import":
        return (
          <FeatureErrorBoundary feature="Recipe Import">
            <RecipeUpload
              userTier={userTier}
              onUpgrade={() => openUpgradePromo("recipe_import")}
              mode="import"
              onSwitchToCreate={() => navigateToView("create")}
            />
          </FeatureErrorBoundary>
        );
      case "targets":
        return (
          <FeatureErrorBoundary feature="Targets">
            <Targets
              onBack={() => navigateToView("today")}
              onEdit={() => navigateToView("profile")}
            />
          </FeatureErrorBoundary>
        );
      default:
        return (
          <FeatureErrorBoundary feature="Nutrition Tracker">
            <NutritionTracker
              userTier={userTier}
              onOpenProgress={() => navigateToView("progress")}
              onOpenSettings={() => navigateToView("settings")}
            />
          </FeatureErrorBoundary>
        );
    }
  };

  return (
    <div className="h-screen flex bg-background">
      {/* Skip link for keyboard navigation */}
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:z-[100] focus:top-2 focus:left-2 focus:px-4 focus:py-2 focus:bg-primary focus:text-white focus:rounded-lg">
        Skip to content
      </a>

      {/* Desktop sidebar (>= lg). Hidden on mobile-web where the bottom
          tab bar keeps the mobile-app feel (decision 2026-04-18). */}
      <DesktopSidebar
        currentView={currentView}
        onNavigate={(view) => navigateToView(view as View)}
        shoppingUncheckedCount={shoppingUncheckedCount}
        displayName={displayName}
        authEmail={authEmail}
        userTier={userTier}
      />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header — full top bar on mobile-web (brand + Library + bell);
            on desktop the sidebar owns the brand so the header collapses
            to a slim row with just the notifications bell pinned right.
            Skipping the border on desktop keeps the canvas continuous
            from the sidebar boundary. */}
        <header className="flex items-center justify-between sticky top-0 z-40 bg-background/95 backdrop-blur-sm px-pm-5 py-4 border-b border-border md:py-3 md:border-b-0">
          <div className="md:hidden">
            <SupprPlateWordmark size={22} />
          </div>
          <div className="hidden md:block" aria-hidden />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigateToView("library")}
              className="w-10 h-10 rounded-lg flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-muted/80 transition-colors md:hidden"
              aria-label="Recipe library"
              title="Library"
            >
              <Icons.recipe className="w-5 h-5" />
            </button>
            <NotificationsBell
              onOpenRecipe={openRecipeById}
              onOpenAll={() => {
                navigateToView("notifications");
              }}
            />
          </div>
        </header>

        {/* Content Area — reserve space for fixed bottom tabs on
            mobile-web; on desktop the bottom tabs are hidden so no
            reservation is needed. */}
        <main id="main-content" className="flex-1 overflow-auto pb-20 md:pb-0" role="main">
          {renderView()}
        </main>

        {/* Bottom tabs — mobile-web only. Below `md` the web feels like
            the native mobile app; from `md` up the sidebar takes over.
            Phase 2 / B1.1 (2026-04-27): collapsed 5 → 4 tabs to mirror
            the new mobile structure (Today / Recipes / Plan / You).
            Each primary entry maps to its default leaf view; the
            highlighted state is computed from `resolvePrimaryFromView`
            so being on /library still highlights "Recipes".

            2026-04-30 (parity with mobile commit `6633d2d`): a
            centered raised Plus button is injected between Recipes
            (visible-index 1) and Plan (visible-index 2) — the
            canonical Log entry point, replacing the side `<LogFab>`
            (right:18 / bottom:100) on mobile-web. Mirrors the mobile
            `<SupprTabBar>` + `<LogTabBarButton>` pattern so the two
            platforms look and behave the same. Desktop (≥ md) does
            not render the bottom nav at all (sidebar takes over),
            so the raised button is mobile-web only — consistent with
            D-2026-04-27-11 ("daily logging is a phone activity"). */}
        <nav
          aria-label="Main navigation"
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <div className="flex" role="tablist">
            {/* ENG-1044 — canonical primary-nav glyph set + order, locked
                to the native iOS tab bar (Today=Calendar, Plan=BookOpen,
                Recipes=Utensils, Progress=BarChart3). The order is
                flag-gated: Plan-first when `navPlanFirst` (matches native),
                else the legacy Recipes-first order while the change ramps.
                The raised Log button always lands in the centre (after the
                2nd tab) regardless of order, mirroring `<SupprTabBar>`. */}
            {(navPlanFirst
              ? ([
                  { primary: "today" as const, defaultLeaf: "today" as const, icon: <Calendar className="w-5 h-5" strokeWidth={2} />, label: "Today" },
                  { primary: "plan" as const, defaultLeaf: "plan" as const, icon: <BookOpen className="w-5 h-5" strokeWidth={2} />, label: "Plan" },
                  { primary: "recipes" as const, defaultLeaf: "library" as const, icon: <Utensils className="w-5 h-5" strokeWidth={2} />, label: "Recipes" },
                  { primary: "you" as const, defaultLeaf: "progress" as const, icon: <BarChart3 className="w-5 h-5" strokeWidth={2} />, label: "Progress" },
                ] as const)
              : ([
                  { primary: "today" as const, defaultLeaf: "today" as const, icon: <Calendar className="w-5 h-5" strokeWidth={2} />, label: "Today" },
                  { primary: "recipes" as const, defaultLeaf: "library" as const, icon: <Utensils className="w-5 h-5" strokeWidth={2} />, label: "Recipes" },
                  { primary: "plan" as const, defaultLeaf: "plan" as const, icon: <BookOpen className="w-5 h-5" strokeWidth={2} />, label: "Plan" },
                  { primary: "you" as const, defaultLeaf: "progress" as const, icon: <BarChart3 className="w-5 h-5" strokeWidth={2} />, label: "Progress" },
                ] as const)
            ).map((tab, tabIndex) => {
              const activePrimary = resolvePrimaryFromView(currentView as SidebarView);
              const isActive = activePrimary === tab.primary;
              // Inject the raised Log button in the CENTRE — after the 2nd
              // visible tab (index 1) regardless of order — mirroring the
              // mobile `<SupprTabBar>` raised-button slot.
              const showLogButtonAfterThis = tabIndex === 1;
              return (
                <Fragment key={tab.primary}>
                  <button
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => navigateToView(tab.defaultLeaf as View)}
                    className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                      isActive ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {tab.icon}
                    {tab.label}
                  </button>
                  {showLogButtonAfterThis ? (
                    /* Centered raised Log button — fills a 5th slot in
                       the bar via `flex-1` so the four real tabs flow
                       around it on equal-width terms. The inner
                       `<button>` is positioned with `relative` +
                       `-top-4` so it visually projects 16px above the
                       bar fill line. SLOE (2026-06-07): the fill is plum
                       (`--sidebar-primary`, the Sloe nav/brand-chrome token —
                       #3B2A4D light / #815E91 dark) so the FAB reads as nav
                       chrome, not "just another clay content CTA" — matching
                       the mobile `<LogTabBarButton>` (`colors.navPrimary`,
                       same plum). The drop-shadow is re-tinted to the same
                       plum; the previous `bg-primary` clay fill + a stale
                       retired-brand-blue glow had drifted off the Sloe
                       palette. */
                    <div
                      className="flex-1 flex items-center justify-center"
                      role="presentation"
                    >
                      <button
                        type="button"
                        onClick={openLogSheetFromTabBar}
                        aria-label="Log a meal"
                        title="Log a meal"
                        data-testid="mobile-web-tab-log-button"
                        className={[
                          "relative -top-4",
                          "w-14 h-14 rounded-full",
                          "bg-[var(--sidebar-primary)] text-[var(--sidebar-primary-foreground)]",
                          "grid place-items-center",
                          "shadow-[0_4px_16px_rgba(59,42,77,0.32)]",
                          "transition-transform duration-150 active:scale-[0.94]",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sidebar-primary)] focus-visible:ring-offset-2",
                        ].join(" ")}
                      >
                        <Plus className="h-6 w-6" strokeWidth={2.5} aria-hidden />
                      </button>
                    </div>
                  ) : null}
                </Fragment>
              );
            })}
          </div>
        </nav>
      </div>

      {/* First-run guided checklist */}
      <FirstRunChecklist onNavigate={(view) => navigateToView(view as View)} />

      {/* Claude Design 2026-04-20 upgrade paywall dialog. Lifts the
          in-app "Upgrade" flow from a /pricing redirect into a modal
          that starts Stripe checkout inline. Rendered at the root so
          any surface can open it via `openUpgradeDialog(from)` (added
          below) without remounting the dialog tree. */}
      {/* Pro users are guarded out — the dialog pitches the NEXT tier
          up; a Pro subscriber has no next tier. D12 §6.2. */}
      {upgradePaywallFrom && userTier !== "pro" ? (
        <UpgradePaywallDialog
          open={upgradePaywallFrom !== null}
          from={upgradePaywallFrom}
          userTier={userTier}
          onOpenChange={(next) => {
            if (!next) setUpgradePaywallFrom(null);
          }}
        />
      ) : null}
    </div>
  );
}
