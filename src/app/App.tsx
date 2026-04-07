import { useState } from "react";
import { Home, BookMarked, Calendar, User, Sparkles, Target, ShoppingCart, Settings as SettingsIcon, ChefHat } from "lucide-react";
import { DiscoverFeed } from "./components/DiscoverFeed.tsx";
import { Library } from "./components/Library.tsx";
import { MealPlanner } from "./components/MealPlanner.tsx";
import { Profile } from "./components/Profile.tsx";
import { NutritionTracker } from "./components/NutritionTracker.tsx";
import { ShoppingList } from "./components/ShoppingList.tsx";
import { Settings } from "./components/Settings.tsx";
import { RecipeUpload } from "./components/RecipeUpload.tsx";

type View = "discover" | "library" | "planner" | "profile" | "tracker" | "shopping" | "settings" | "upload";

export default function App() {
  const [currentView, setCurrentView] = useState<View>("discover");
  const [userTier] = useState<"free" | "base" | "pro">("pro");

  const renderView = () => {
    switch (currentView) {
      case "discover":
        return <DiscoverFeed userTier={userTier} />;
      case "library":
        return <Library userTier={userTier} />;
      case "planner":
        return <MealPlanner userTier={userTier} />;
      case "tracker":
        return <NutritionTracker userTier={userTier} />;
      case "shopping":
        return <ShoppingList userTier={userTier} />;
      case "upload":
        return <RecipeUpload userTier={userTier} />;
      case "settings":
        return <Settings userTier={userTier} />;
      case "profile":
        return <Profile userTier={userTier} />;
      default:
        return <DiscoverFeed userTier={userTier} />;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Header */}
      <header className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-800/50 px-8 py-5 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl shadow-lg shadow-violet-500/20 flex items-center justify-center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="text-white">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="currentColor" opacity="0.3"/>
              <path d="M2 17L12 22L22 17V7L12 12L2 7V17Z" fill="currentColor"/>
            </svg>
          </div>
          <h1 className="tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
            Platemate
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {userTier === "free" && (
            <button className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-300 hover:scale-105">
              Upgrade
            </button>
          )}
          {userTier !== "free" && (
            <div className="px-4 py-2 bg-gradient-to-r from-violet-100 to-indigo-100 dark:from-violet-950/30 dark:to-indigo-950/30 text-violet-700 dark:text-violet-300 rounded-full text-sm capitalize font-medium border border-violet-200/50 dark:border-violet-800/50">
              {userTier}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <nav className="w-72 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border-r border-slate-200/50 dark:border-slate-800/50 flex flex-col shadow-lg">
          <div className="flex-1 py-8 px-4 space-y-2 overflow-y-auto">
            <button
              onClick={() => setCurrentView("discover")}
              className={`w-full px-5 py-3.5 flex items-center gap-3 rounded-xl transition-all duration-200 group ${
                currentView === "discover"
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
              }`}
            >
              <Home className={`w-5 h-5 transition-transform duration-200 ${currentView === "discover" ? "" : "group-hover:scale-110"}`} />
              <span className="font-medium">Discover</span>
            </button>
            <button
              onClick={() => setCurrentView("library")}
              className={`w-full px-5 py-3.5 flex items-center gap-3 rounded-xl transition-all duration-200 group ${
                currentView === "library"
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
              }`}
            >
              <BookMarked className={`w-5 h-5 transition-transform duration-200 ${currentView === "library" ? "" : "group-hover:scale-110"}`} />
              <span className="font-medium">Library</span>
            </button>
            <button
              onClick={() => setCurrentView("planner")}
              className={`w-full px-5 py-3.5 flex items-center gap-3 rounded-xl transition-all duration-200 group relative ${
                currentView === "planner"
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
              }`}
            >
              <Calendar className={`w-5 h-5 transition-transform duration-200 ${currentView === "planner" ? "" : "group-hover:scale-110"}`} />
              <span className="font-medium">Meal Planner</span>
              {(userTier === "base" || userTier === "pro") && (
                <Sparkles className="w-3.5 h-3.5 ml-auto text-yellow-400 animate-pulse" />
              )}
            </button>
            <button
              onClick={() => setCurrentView("tracker")}
              className={`w-full px-5 py-3.5 flex items-center gap-3 rounded-xl transition-all duration-200 group ${
                currentView === "tracker"
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
              }`}
            >
              <Target className={`w-5 h-5 transition-transform duration-200 ${currentView === "tracker" ? "" : "group-hover:scale-110"}`} />
              <span className="font-medium">Tracker</span>
            </button>
            <button
              onClick={() => setCurrentView("shopping")}
              className={`w-full px-5 py-3.5 flex items-center gap-3 rounded-xl transition-all duration-200 group relative ${
                currentView === "shopping"
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
              }`}
            >
              <ShoppingCart className={`w-5 h-5 transition-transform duration-200 ${currentView === "shopping" ? "" : "group-hover:scale-110"}`} />
              <span className="font-medium">Shopping List</span>
              {(userTier === "base" || userTier === "pro") && (
                <Sparkles className="w-3.5 h-3.5 ml-auto text-yellow-400 animate-pulse" />
              )}
            </button>

            {userTier === "pro" && (
              <>
                <div className="py-2">
                  <div className="h-px bg-slate-200 dark:bg-slate-800"></div>
                </div>
                <button
                  onClick={() => setCurrentView("upload")}
                  className={`w-full px-5 py-3.5 flex items-center gap-3 rounded-xl transition-all duration-200 group ${
                    currentView === "upload"
                      ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
                  }`}
                >
                  <ChefHat className={`w-5 h-5 transition-transform duration-200 ${currentView === "upload" ? "" : "group-hover:scale-110"}`} />
                  <span className="font-medium">Create Recipe</span>
                </button>
              </>
            )}
          </div>
          <div className="px-4 pb-6 space-y-2">
            <button
              onClick={() => setCurrentView("settings")}
              className={`w-full px-5 py-3.5 flex items-center gap-3 rounded-xl transition-all duration-200 border border-slate-200/50 dark:border-slate-800/50 group ${
                currentView === "settings"
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
              }`}
            >
              <SettingsIcon className={`w-5 h-5 transition-transform duration-200 ${currentView === "settings" ? "" : "group-hover:scale-110"}`} />
              <span className="font-medium">Settings</span>
            </button>
            <button
              onClick={() => setCurrentView("profile")}
              className={`w-full px-5 py-3.5 flex items-center gap-3 rounded-xl transition-all duration-200 border border-slate-200/50 dark:border-slate-800/50 group ${
                currentView === "profile"
                  ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/20"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/80 dark:hover:bg-slate-800/50"
              }`}
            >
              <User className={`w-5 h-5 transition-transform duration-200 ${currentView === "profile" ? "" : "group-hover:scale-110"}`} />
              <span className="font-medium">Profile</span>
            </button>
          </div>
        </nav>

        {/* Content Area */}
        <main className="flex-1 overflow-auto">{renderView()}</main>
      </div>
    </div>
  );
}
