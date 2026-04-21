"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { AnalyticsEvents, type PaywallViewedFrom } from "../lib/analytics/events.ts";
import { track } from "../lib/analytics/track.ts";
import { Icons } from "./components/ui/icons";
import dynamic from "next/dynamic";
import { DiscoverFeed } from "./components/DiscoverFeed.tsx";
import { NotificationsBell } from "./components/NotificationsBell.tsx";
import { Library } from "./components/Library.tsx";
import { AppLoadingSkeleton } from "./components/AppLoadingSkeleton.tsx";
import { DesktopSidebar } from "./components/suppr/desktop-sidebar.tsx";

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
const HouseholdPanel = dynamic(
  () => import("./components/HouseholdPanel.tsx").then((m) => ({ default: m.HouseholdPanel })),
  { ssr: false },
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

export default function App() {
  const {
    profileTier: userTier,
    profileDisplayName: displayName,
    authEmail,
    signOut,
    refreshProfileBasics,
    shoppingItems,
  } = useAppData();
  const searchParams = useSearchParams();
  const router = useRouter();
  const deepLinkRecipeId = searchParams.get("recipe");
  const viewParam = searchParams.get("view");
  const [currentView, setCurrentView] = useState<View>("today");
  const [settingsScrollToPromo, setSettingsScrollToPromo] = useState(false);
  const [plannerMobileTab, setPlannerMobileTab] = useState<"plan" | "shop">("plan");
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

  // URL → state (deep links, refresh)
  useEffect(() => {
    if (normalizedViewParam && normalizedViewParam !== currentView) {
      setCurrentView(normalizedViewParam);
    }
  }, [normalizedViewParam, currentView]);

  useEffect(() => {
    if (searchParams.get("view")) return;
    // Shared recipe links use ?recipe= without view; don't stomp them with view=today.
    if (searchParams.get("recipe")?.trim()) return;
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", "today");
    router.replace(`/home?${p.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const recipeDeepLinkId = searchParams.get("recipe")?.trim() ?? "";
  useEffect(() => {
    if (!recipeDeepLinkId) return;
    setCurrentView("discover");
    const v = searchParams.get("view");
    if (v !== "discover") {
      const p = new URLSearchParams(searchParams.toString());
      p.set("view", "discover");
      router.replace(`/home?${p.toString()}`, { scroll: false });
    }
  }, [recipeDeepLinkId, searchParams, router]);

  const navigateToView = useCallback(
    (view: View) => {
      setCurrentView(view);
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", view);
      if (view !== "progress") {
        params.delete("metric");
      }
      // Keep deep-linked recipe query if present.
      const q = params.toString();
      router.replace(q ? `/home?${q}` : "/", { scroll: false });
    },
    [router, searchParams],
  );

  const clearRecipeQuery = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("recipe");
    params.delete("cook");
    params.delete("portions");
    if (!params.get("view")) params.set("view", "today");
    const q = params.toString();
    router.replace(q ? `/home?${q}` : "/home?view=today", { scroll: false });
  }, [router, searchParams]);

  const openRecipeById = useCallback(
    (recipeId: string, opts?: { cook?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", "discover");
      params.set("recipe", recipeId);
      if (opts?.cook) params.set("cook", "1");
      const q = params.toString();
      router.replace(q ? `/home?${q}` : "/", { scroll: false });
      setCurrentView("discover");
    },
    [router, searchParams],
  );

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
      if (!params.get("view")) params.set("view", "today");
      const q = params.toString();
      router.replace(q ? `/home?${q}` : "/home?view=today", { scroll: false });
    });
  }, [searchParams, router, refreshProfileBasics]);

  const renderView = () => {
    switch (currentView) {
      case "today":
        return <FeatureErrorBoundary feature="Nutrition Tracker"><NutritionTracker userTier={userTier} onOpenProgress={() => navigateToView("progress")} /></FeatureErrorBoundary>;
      case "discover":
        return (
          <DiscoverFeed
            userTier={userTier}
            initialOpenRecipeId={deepLinkRecipeId}
            initialCookMode={searchParams.get("cook") === "1"}
            initialPortions={parseFloat(searchParams.get("portions") ?? "") || undefined}
            onConsumedDeepLinkRecipe={deepLinkRecipeId ? clearRecipeQuery : undefined}
            onViewTracker={() => navigateToView("today")}
          />
        );
      case "plan":
        return (
          <>
            <div className="md:hidden sticky top-0 z-40 border-b border-border bg-card/95 backdrop-blur-md px-4 py-2">
              <div className="max-w-6xl mx-auto flex p-1 rounded-xl bg-muted/90 gap-1">
                <button
                  type="button"
                  onClick={() => setPlannerMobileTab("plan")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-pm ${
                    plannerMobileTab === "plan"
                      ? "bg-card shadow-sm text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  Plan
                </button>
                <button
                  type="button"
                  onClick={() => setPlannerMobileTab("shop")}
                  className={`relative flex-1 py-2.5 rounded-lg text-sm font-semibold transition-pm ${
                    plannerMobileTab === "shop"
                      ? "bg-card shadow-sm text-primary"
                      : "text-muted-foreground"
                  }`}
                >
                  Shop
                  {shoppingUncheckedCount > 0 ? (
                    <span className="absolute -top-0.5 right-2 min-w-[1rem] h-4 px-1 rounded-full bg-rose-500 text-white text-[10px] font-bold leading-4 text-center">
                      {shoppingUncheckedCount > 99 ? "99+" : shoppingUncheckedCount}
                    </span>
                  ) : null}
                </button>
              </div>
            </div>
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
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("view", "discover");
                  params.set("recipe", id);
                  params.set("cook", "1");
                  if (portion && portion !== 1) params.set("portions", String(portion));
                  router.replace(`/home?${params.toString()}`, { scroll: false });
                  setCurrentView("discover");
                }}
              /></FeatureErrorBoundary>
            ) : (
              <FeatureErrorBoundary feature="Shopping List"><ShoppingList userTier={userTier} onUpgrade={() => openUpgradePromo("shopping_list")} onNavigate={(view) => navigateToView(view as View)} /></FeatureErrorBoundary>
            )}
          </>
        );
      case "progress":
        return <FeatureErrorBoundary feature="Progress"><ProgressDashboard /></FeatureErrorBoundary>;
      case "profile":
        return (
          <Profile
            userTier={userTier}
            displayName={displayName}
            // Round-3 (2026-04-19): Profile upsell row fires with
            // `from: "profile"` so F2 can slice which tab surfaced the
            // upgrade intent.
            onUpgrade={() => openUpgradePromo("profile")}
            onOpenNutrition={() => navigateToView("today")}
          />
        );
      case "library":
        return (
          <Library userTier={userTier} onUpgrade={() => openUpgradePromo("recipes_library")} onGoDiscover={() => navigateToView("discover")} />
        );
      case "shopping":
        return <ShoppingList userTier={userTier} onUpgrade={() => openUpgradePromo("shopping_list")} onNavigate={(view) => navigateToView(view as View)} />;
      case "settings":
        return (
          <Settings
            userTier={userTier}
            authEmail={authEmail}
            scrollToPromoOnOpen={settingsScrollToPromo}
            onScrollToPromoConsumed={clearSettingsScrollToPromo}
          />
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
        return <FeatureErrorBoundary feature="Nutrition Tracker"><NutritionTracker userTier={userTier} onOpenProgress={() => navigateToView("progress")} /></FeatureErrorBoundary>;
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
      />

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header — full top bar on mobile-web (brand + Library + bell);
            on desktop the sidebar owns the brand so the header collapses
            to a slim row with just the notifications bell pinned right.
            Skipping the border on desktop keeps the canvas continuous
            from the sidebar boundary. */}
        <header className="flex items-center justify-between sticky top-0 z-40 bg-background/95 backdrop-blur-sm px-5 py-3 border-b border-border md:py-2 md:border-b-0">
          <h1 className="text-lg font-bold text-foreground tracking-tight md:hidden">Suppr</h1>
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

        {/* Bottom tabs — mobile-web only. Below `lg` the web feels like
            the native mobile app; from `lg` up the sidebar takes over. */}
        <nav
          aria-label="Main navigation"
          className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)] md:hidden"
        >
          <div className="flex" role="tablist">
            {([
              { view: "today" as const, icon: <Icons.home className="w-5 h-5" />, label: "Today" },
              { view: "discover" as const, icon: <Icons.discover className="w-5 h-5" />, label: "Discover" },
              { view: "plan" as const, icon: <Icons.plan className="w-5 h-5" />, label: "Plan" },
              { view: "progress" as const, icon: <Icons.sparkles className="w-5 h-5" />, label: "Progress" },
              { view: "profile" as const, icon: <Icons.user className="w-5 h-5" />, label: "Profile" },
            ] as const).map((tab) => (
              <button
                key={tab.view}
                type="button"
                role="tab"
                aria-selected={currentView === tab.view}
                aria-current={currentView === tab.view ? "page" : undefined}
                onClick={() => navigateToView(tab.view)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
                  currentView === tab.view ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
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
