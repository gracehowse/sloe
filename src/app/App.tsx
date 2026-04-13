"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Home,
  BookMarked,
  Calendar,
  User,
  Bell,
  Sparkles,
  Target,
  ShoppingCart,
  Settings as SettingsIcon,
  ChefHat,
  BookPlus,
  LogOut,
  Menu,
} from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "./components/ui/sheet.tsx";

type View =
  | "discover"
  | "library"
  | "planner"
  | "profile"
  | "tracker"
  | "progress"
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
  const [currentView, setCurrentView] = useState<View>("discover");
  const [settingsScrollToPromo, setSettingsScrollToPromo] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [plannerMobileTab, setPlannerMobileTab] = useState<"plan" | "shop">("plan");

  const normalizedViewParam = useMemo(() => {
    if (!viewParam) return null;
    let v = viewParam.toLowerCase();
    if (v === "upload") v = "create";
    const allowed: View[] = [
      "discover",
      "library",
      "planner",
      "profile",
      "tracker",
      "progress",
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
    p.set("view", "tracker");
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
    if (!params.get("view")) params.set("view", "tracker");
    const q = params.toString();
    router.replace(q ? `/?${q}` : "/?view=tracker", { scroll: false });
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
    if (currentView !== "planner") {
      setPlannerMobileTab("plan");
    }
  }, [currentView]);

  useEffect(() => {
    if (searchParams.get("checkout") !== "success") return;
    void refreshProfileBasics().then(() => {
      const params = new URLSearchParams(searchParams.toString());
      params.delete("checkout");
      if (!params.get("view")) params.set("view", "tracker");
      const q = params.toString();
      router.replace(q ? `/?${q}` : "/?view=tracker", { scroll: false });
    });
  }, [searchParams, router, refreshProfileBasics]);

  const renderView = () => {
    switch (currentView) {
      case "discover":
        return (
          <DiscoverFeed
            userTier={userTier}
            initialOpenRecipeId={deepLinkRecipeId}
            initialCookMode={searchParams.get("cook") === "1"}
            initialPortions={parseFloat(searchParams.get("portions") ?? "") || undefined}
            onConsumedDeepLinkRecipe={deepLinkRecipeId ? clearRecipeQuery : undefined}
            onViewTracker={() => navigateToView("tracker")}
          />
        );
      case "library":
        return (
          <Library userTier={userTier} onUpgrade={openUpgradePromo} onGoDiscover={() => navigateToView("discover")} />
        );
      case "planner":
        return (
          <>
            <div className="md:hidden sticky top-0 z-40 border-b border-slate-200/80 dark:border-slate-800/80 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md px-4 py-2">
              <div className="max-w-6xl mx-auto flex p-1 rounded-xl bg-slate-100/90 dark:bg-slate-800/90 gap-1">
                <button
                  type="button"
                  onClick={() => setPlannerMobileTab("plan")}
                  className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-pm ${
                    plannerMobileTab === "plan"
                      ? "bg-white dark:bg-slate-700 shadow-sm text-violet-700 dark:text-violet-300"
                      : "text-slate-600 dark:text-slate-400"
                  }`}
                >
                  Plan
                </button>
                <button
                  type="button"
                  onClick={() => setPlannerMobileTab("shop")}
                  className={`relative flex-1 py-2.5 rounded-lg text-sm font-semibold transition-pm ${
                    plannerMobileTab === "shop"
                      ? "bg-white dark:bg-slate-700 shadow-sm text-violet-700 dark:text-violet-300"
                      : "text-slate-600 dark:text-slate-400"
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
      case "tracker":
        return <NutritionTracker userTier={userTier} onOpenProgress={() => navigateToView("progress")} />;
      case "progress":
        return <ProgressDashboard />;
      case "shopping":
        return <ShoppingList userTier={userTier} onUpgrade={openUpgradePromo} onNavigate={(view) => navigateToView(view as View)} />;
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
      case "profile":
        return (
          <Profile
            userTier={userTier}
            displayName={displayName}
            onUpgrade={openUpgradePromo}
            onOpenNutrition={() => navigateToView("tracker")}
          />
        );
      default:
        return <DiscoverFeed userTier={userTier} />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-800/50 px-4 sm:px-6 md:px-8 py-3 md:py-5 flex items-center justify-between sticky top-0 z-50 shadow-sm gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 shrink-0 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl shadow-lg shadow-violet-500/20 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.3"/>
              <path d="M2 17L12 22L22 17V7L12 12L2 7V17Z" fill="currentColor"/>
            </svg>
          </div>
          <h1 className="text-base sm:text-lg md:text-xl tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent truncate">
            Platemate
          </h1>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <NotificationsBell
            onOpenRecipe={openRecipeById}
            onOpenAll={() => {
              navigateToView("notifications");
            }}
          />
          <button
            type="button"
            onClick={() => void signOut()}
            className="px-3 sm:px-4 py-2 sm:py-2.5 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all shadow-sm text-slate-700 dark:text-slate-200 inline-flex items-center gap-2"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <nav className="hidden md:flex w-64 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 flex-col">
          {/* Primary nav — core loop */}
          <div className="flex-1 py-6 px-3 space-y-1 overflow-y-auto">
            <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Core</p>
            {([
              { view: "tracker" as const, icon: Target, label: "Tracker", badge: 0 },
              { view: "progress" as const, icon: Sparkles, label: "Progress", badge: 0 },
              { view: "discover" as const, icon: Home, label: "Discover", badge: 0 },
              { view: "library" as const, icon: BookMarked, label: "Library", badge: 0 },
              { view: "planner" as const, icon: Calendar, label: "Planner", badge: 0 },
              { view: "shopping" as const, icon: ShoppingCart, label: "Shopping", badge: shoppingUncheckedCount },
            ]).map(({ view, icon: Icon, label, badge }) => (
              <button
                key={view}
                onClick={() => navigateToView(view)}
                className={`w-full px-3 py-2.5 flex items-center gap-3 rounded-lg transition-colors duration-150 group relative ${
                  currentView === view
                    ? "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-semibold"
                    : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                {currentView === view && (
                  <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-violet-600 dark:bg-violet-400" />
                )}
                <span className="relative inline-flex">
                  <Icon className="w-[18px] h-[18px]" />
                  {badge != null && badge > 0 ? (
                    <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center">
                      {badge > 99 ? "99+" : badge}
                    </span>
                  ) : null}
                </span>
                <span className="text-sm">{label}</span>
              </button>
            ))}

            {/* Secondary nav */}
            <div className="pt-4 pb-1">
              <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">Create</p>
            </div>
            {([
              { view: "create" as const, icon: ChefHat, label: "New recipe" },
              { view: "import" as const, icon: BookPlus, label: "Import" },
            ] as const).map(({ view, icon: Icon, label }) => (
              <button
                key={view}
                onClick={() => navigateToView(view)}
                className={`w-full px-3 py-2 flex items-center gap-3 rounded-lg transition-colors duration-150 text-sm ${
                  currentView === view
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                    : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Footer utility items */}
          <div className="px-3 pb-4 pt-2 border-t border-slate-100 dark:border-slate-800/60 space-y-1">
            {([
              { view: "notifications" as const, icon: Bell, label: "Notifications" },
              { view: "settings" as const, icon: SettingsIcon, label: "Settings" },
              { view: "profile" as const, icon: User, label: "Profile" },
            ] as const).map(({ view, icon: Icon, label }) => (
              <button
                key={view}
                onClick={() => navigateToView(view)}
                className={`w-full px-3 py-2 flex items-center gap-3 rounded-lg transition-colors duration-150 text-sm ${
                  currentView === view
                    ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white font-medium"
                    : "text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-900"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* Content Area */}
        <main className="flex-1 overflow-auto pb-20 md:pb-0">{renderView()}</main>
      </div>

      {/* Bottom tabs (mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200/70 dark:border-slate-800/70 bg-white/80 dark:bg-slate-950/70 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-4xl mx-auto px-1 py-1.5 grid grid-cols-7 gap-0.5">
          <button
            type="button"
            onClick={() => navigateToView("tracker")}
            className={`rounded-lg px-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] leading-tight font-medium ${
              currentView === "tracker"
                ? "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-900/40"
            }`}
          >
            <Target className="w-5 h-5" />
            Track
          </button>
          <button
            type="button"
            onClick={() => navigateToView("progress")}
            className={`rounded-lg px-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] leading-tight font-medium ${
              currentView === "progress"
                ? "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-900/40"
            }`}
          >
            <Sparkles className="w-5 h-5" />
            Progress
          </button>
          <button
            type="button"
            onClick={() => navigateToView("discover")}
            className={`rounded-lg px-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] leading-tight font-medium ${
              currentView === "discover"
                ? "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-900/40"
            }`}
          >
            <Home className="w-5 h-5" />
            Discover
          </button>
          <button
            type="button"
            onClick={() => navigateToView("library")}
            className={`rounded-lg px-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] leading-tight font-medium ${
              currentView === "library"
                ? "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-900/40"
            }`}
          >
            <BookMarked className="w-5 h-5" />
            Library
          </button>
          <button
            type="button"
            onClick={() => navigateToView("planner")}
            className={`rounded-lg px-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] leading-tight font-medium ${
              currentView === "planner"
                ? "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-900/40"
            }`}
          >
            <Calendar className="w-5 h-5" />
            Plan
          </button>
          <button
            type="button"
            onClick={() => {
              navigateToView("shopping");
              setMoreOpen(false);
            }}
            className={`rounded-lg px-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] leading-tight font-medium relative ${
              currentView === "shopping"
                ? "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-900/40"
            }`}
          >
            <span className="relative">
              <ShoppingCart className="w-5 h-5" />
              {shoppingUncheckedCount > 0 ? (
                <span className="absolute -top-1 -right-1.5 min-w-[14px] h-[14px] px-0.5 rounded-full bg-rose-500 text-white text-[8px] font-bold flex items-center justify-center">
                  {shoppingUncheckedCount > 9 ? "9+" : shoppingUncheckedCount}
                </span>
              ) : null}
            </span>
            Shop
          </button>
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={`rounded-lg px-1 py-1.5 flex flex-col items-center justify-center gap-0.5 text-[10px] leading-tight font-medium ${
              ["settings", "profile", "create", "import"].includes(currentView)
                ? "text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-950/40"
                : "text-slate-600 dark:text-slate-300 hover:bg-slate-100/70 dark:hover:bg-slate-900/40"
            }`}
          >
            <Menu className="w-5 h-5" />
            More
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
          <SheetHeader>
            <SheetTitle className="text-slate-900 dark:text-white">More</SheetTitle>
          </SheetHeader>
          <div className="grid gap-2 px-4 pb-6">
            <button
              type="button"
              className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-900"
              onClick={() => {
                navigateToView("notifications");
                setMoreOpen(false);
              }}
            >
              <Bell className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <span className="font-medium text-slate-900 dark:text-white">Notifications</span>
            </button>
            <button
              type="button"
              className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-900"
              onClick={() => {
                navigateToView("settings");
                setMoreOpen(false);
              }}
            >
              <SettingsIcon className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <span className="font-medium text-slate-900 dark:text-white">Settings</span>
            </button>
            <button
              type="button"
              className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-900"
              onClick={() => {
                navigateToView("profile");
                setMoreOpen(false);
              }}
            >
              <User className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <span className="font-medium text-slate-900 dark:text-white">Profile</span>
            </button>
            <button
              type="button"
              className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-900"
              onClick={() => {
                navigateToView("create");
                setMoreOpen(false);
              }}
            >
              <ChefHat className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <span className="font-medium text-slate-900 dark:text-white">Create recipe</span>
            </button>
            <button
              type="button"
              className="w-full text-left px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-900"
              onClick={() => {
                navigateToView("import");
                setMoreOpen(false);
              }}
            >
              <BookPlus className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              <span className="font-medium text-slate-900 dark:text-white">Import recipe</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* First-run guided checklist */}
      <FirstRunChecklist onNavigate={(view) => navigateToView(view as View)} />
    </div>
  );
}
