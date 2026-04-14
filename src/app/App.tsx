"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Icons } from "./components/ui/icons";
import dynamic from "next/dynamic";
import { DiscoverFeed } from "./components/DiscoverFeed.tsx";
import { NotificationsBell } from "./components/NotificationsBell.tsx";
import { Library } from "./components/Library.tsx";
import { AppLoadingSkeleton } from "./components/AppLoadingSkeleton.tsx";

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
const Settings = dynamic(
  () => import("./components/Settings.tsx").then((m) => ({ default: m.Settings })),
  { ssr: false, loading: () => <AppLoadingSkeleton label="Loading settings..." /> },
);
const RecipeUpload = dynamic(
  () => import("./components/RecipeUpload.tsx").then((m) => ({ default: m.RecipeUpload })),
  { ssr: false, loading: () => <AppLoadingSkeleton label="Loading recipe editor..." /> },
);
import { useAppData } from "../context/AppDataContext.tsx";
import { FirstRunChecklist } from "./components/FirstRunChecklist.tsx";

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
  | "import";

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
    const p = new URLSearchParams(searchParams.toString());
    p.set("view", "today");
    router.replace(`/?${p.toString()}`, { scroll: false });
  }, [searchParams, router]);

  const navigateToView = useCallback(
    (view: View) => {
      setCurrentView(view);
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", view);
      // Keep deep-linked recipe query if present.
      const q = params.toString();
      router.replace(q ? `/?${q}` : "/", { scroll: false });
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
    router.replace(q ? `/?${q}` : "/?view=today", { scroll: false });
  }, [router, searchParams]);

  const openRecipeById = useCallback(
    (recipeId: string, opts?: { cook?: boolean }) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("view", "discover");
      params.set("recipe", recipeId);
      if (opts?.cook) params.set("cook", "1");
      const q = params.toString();
      router.replace(q ? `/?${q}` : "/", { scroll: false });
      setCurrentView("discover");
    },
    [router, searchParams],
  );

  const shoppingUncheckedCount = useMemo(
    () => shoppingItems.filter((i) => !i.checked).length,
    [shoppingItems],
  );

  const clearSettingsScrollToPromo = useCallback(() => setSettingsScrollToPromo(false), []);

  const openUpgradePromo = useCallback(() => {
    setSettingsScrollToPromo(true);
    navigateToView("settings");
  }, []);

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
      router.replace(q ? `/?${q}` : "/?view=today", { scroll: false });
    });
  }, [searchParams, router, refreshProfileBasics]);

  const renderView = () => {
    switch (currentView) {
      case "today":
        return <NutritionTracker userTier={userTier} onOpenProgress={() => navigateToView("progress")} />;
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
              <MealPlanner
                userTier={userTier}
                onUpgrade={openUpgradePromo}
                onNavigate={(view) => navigateToView(view)}
                onOpenRecipe={openRecipeById}
                onCookRecipe={(id, portion) => {
                  const params = new URLSearchParams(searchParams.toString());
                  params.set("view", "discover");
                  params.set("recipe", id);
                  params.set("cook", "1");
                  if (portion && portion !== 1) params.set("portions", String(portion));
                  router.replace(`/?${params.toString()}`, { scroll: false });
                  setCurrentView("discover");
                }}
              />
            ) : (
              <ShoppingList userTier={userTier} onUpgrade={openUpgradePromo} onNavigate={(view) => navigateToView(view as View)} />
            )}
          </>
        );
      case "progress":
        return <ProgressDashboard />;
      case "profile":
        return (
          <Profile
            userTier={userTier}
            displayName={displayName}
            onUpgrade={openUpgradePromo}
            onOpenNutrition={() => navigateToView("today")}
          />
        );
      case "library":
        return (
          <Library userTier={userTier} onUpgrade={openUpgradePromo} onGoDiscover={() => navigateToView("discover")} />
        );
      case "shopping":
        return <ShoppingList userTier={userTier} onUpgrade={openUpgradePromo} onNavigate={(view) => navigateToView(view as View)} />;
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
          <RecipeUpload
            userTier={userTier}
            onUpgrade={openUpgradePromo}
            mode="create"
            onSwitchToImport={() => navigateToView("import")}
          />
        );
      case "import":
        return (
          <RecipeUpload
            userTier={userTier}
            onUpgrade={openUpgradePromo}
            mode="import"
            onSwitchToCreate={() => navigateToView("create")}
          />
        );
      default:
        return <NutritionTracker userTier={userTier} onOpenProgress={() => navigateToView("progress")} />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="px-5 py-3 flex items-center justify-between sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border">
        <h1 className="text-lg font-bold text-foreground tracking-tight">Platemate</h1>
        <NotificationsBell
          onOpenRecipe={openRecipeById}
          onOpenAll={() => {
            navigateToView("notifications");
          }}
        />
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-auto pb-20">{renderView()}</main>

      {/* Bottom tabs */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="flex">
          <button
            type="button"
            onClick={() => navigateToView("today")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
              currentView === "today" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icons.home className="w-5 h-5" />
            Today
          </button>
          <button
            type="button"
            onClick={() => navigateToView("discover")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
              currentView === "discover" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icons.discover className="w-5 h-5" />
            Discover
          </button>
          <button
            type="button"
            onClick={() => navigateToView("plan")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
              currentView === "plan" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icons.plan className="w-5 h-5" />
            Plan
          </button>
          <button
            type="button"
            onClick={() => navigateToView("progress")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
              currentView === "progress" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icons.sparkles className="w-5 h-5" />
            Progress
          </button>
          <button
            type="button"
            onClick={() => navigateToView("profile")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${
              currentView === "profile" ? "text-primary" : "text-muted-foreground"
            }`}
          >
            <Icons.user className="w-5 h-5" />
            Profile
          </button>
        </div>
      </nav>


      {/* First-run guided checklist */}
      <FirstRunChecklist onNavigate={(view) => navigateToView(view as View)} />
    </div>
  );
}
