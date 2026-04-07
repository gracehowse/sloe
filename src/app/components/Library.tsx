import { useState } from "react";
import { Search, Filter, Lock, AlertCircle } from "lucide-react";
import { RecipeDetail } from "./RecipeDetail";

interface LibraryProps {
  userTier: "free" | "base" | "pro";
}

interface SavedRecipe {
  id: string;
  creatorName: string;
  creatorImage: string;
  title: string;
  image: string;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isVerified: boolean;
  savedCount: number;
  isSaved: boolean;
  savedAt: Date;
}

const mockSavedRecipes: SavedRecipe[] = [
  {
    id: "3",
    creatorName: "Jordan Kim",
    creatorImage: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
    title: "Grilled Salmon with Roasted Vegetables",
    image: "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop",
    servings: 1,
    calories: 468,
    protein: 42,
    carbs: 28,
    fat: 20,
    isVerified: true,
    savedCount: 2103,
    isSaved: true,
    savedAt: new Date("2026-04-05"),
  },
  {
    id: "4",
    creatorName: "Emma Wilson",
    creatorImage: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    title: "Greek Yogurt Parfait",
    image: "https://images.unsplash.com/photo-1488477181946-6428a0291777?w=800&h=600&fit=crop",
    servings: 1,
    calories: 285,
    protein: 24,
    carbs: 38,
    fat: 6,
    isVerified: true,
    savedCount: 756,
    isSaved: true,
    savedAt: new Date("2026-04-03"),
  },
];

export function Library({ userTier }: LibraryProps) {
  const [savedRecipes] = useState<SavedRecipe[]>(mockSavedRecipes);
  const [selectedRecipe, setSelectedRecipe] = useState<SavedRecipe | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const FREE_TIER_LIMIT = 10;
  const savedCount = savedRecipes.length;
  const limitReached = userTier === "free" && savedCount >= FREE_TIER_LIMIT;

  if (selectedRecipe) {
    return <RecipeDetail recipe={selectedRecipe} onBack={() => setSelectedRecipe(null)} />;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">Library</h1>
          {userTier === "free" && (
            <div
              className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 border ${
                limitReached
                  ? "bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-800"
                  : savedCount >= FREE_TIER_LIMIT * 0.8
                  ? "bg-orange-50 text-orange-700 dark:bg-orange-950/20 dark:text-orange-400 border-orange-200 dark:border-orange-800"
                  : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700"
              }`}
            >
              {savedCount} / {FREE_TIER_LIMIT} recipes
              {limitReached && <Lock className="w-3.5 h-3.5" />}
            </div>
          )}
        </div>

        {/* Free Tier Upgrade Prompt */}
        {userTier === "free" && savedCount >= FREE_TIER_LIMIT * 0.8 && (
          <div
            className={`backdrop-blur-xl rounded-2xl p-6 flex items-start gap-4 border shadow-lg ${
              limitReached
                ? "bg-red-50/80 dark:bg-red-950/30 border-red-200/50 dark:border-red-800/50"
                : "bg-orange-50/80 border-orange-200/50 dark:bg-orange-950/30 dark:border-orange-800/50"
            }`}
          >
            <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${limitReached ? "bg-red-100 dark:bg-red-900/30" : "bg-orange-100 dark:bg-orange-900/30"}`}>
              <AlertCircle className={`w-6 h-6 ${limitReached ? "text-red-600 dark:text-red-400" : "text-orange-600 dark:text-orange-400"}`} />
            </div>
            <div className="flex-1">
              <p className={`font-semibold text-lg ${limitReached ? "text-red-900 dark:text-red-200" : "text-orange-900 dark:text-orange-200"}`}>
                {limitReached ? "Recipe limit reached" : `${FREE_TIER_LIMIT - savedCount} recipes remaining`}
              </p>
              <p className={`text-sm mt-1 ${limitReached ? "text-red-700 dark:text-red-300" : "text-orange-700 dark:text-orange-300"}`}>
                {limitReached
                  ? "Remove a recipe or upgrade to save more"
                  : "Upgrade to Base or Pro for unlimited recipe storage"}
              </p>
            </div>
            <button className="px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-xl hover:shadow-violet-500/30 transition-all duration-300 hover:scale-105 whitespace-nowrap font-semibold">
              Upgrade
            </button>
          </div>
        )}

        {/* Search and Filter */}
        <div className="flex gap-3 mt-6">
          <div className="flex-1 relative group">
            <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-violet-600 transition-colors" />
            <input
              type="text"
              placeholder="Search recipes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 shadow-sm transition-all"
            />
          </div>
          <button className="px-5 py-3 backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 shadow-sm">
            <Filter className="w-5 h-5" />
            <span className="font-medium">Filter</span>
          </button>
        </div>
      </div>

      {/* Empty State */}
      {savedRecipes.length === 0 && (
        <div className="text-center py-24">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center mx-auto mb-6">
            <Lock className="w-10 h-10 text-slate-400" />
          </div>
          <h3 className="mb-3 text-slate-900 dark:text-white">No saved recipes</h3>
          <p className="text-slate-600 dark:text-slate-400 mb-8">Browse the Discover feed to save your first recipe</p>
        </div>
      )}

      {/* Recipe Grid */}
      {savedRecipes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {savedRecipes.map((recipe) => (
            <button
              key={recipe.id}
              onClick={() => setSelectedRecipe(recipe)}
              className="group backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl overflow-hidden hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 text-left shadow-lg"
            >
              <div className="relative overflow-hidden">
                <img src={recipe.image} alt={recipe.title} className="w-full aspect-[4/3] object-cover group-hover:scale-110 transition-transform duration-500" />
                <div className="absolute top-3 right-3 px-3 py-1.5 bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm rounded-lg text-sm font-semibold shadow-lg">
                  {recipe.calories} kcal
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </div>
              <div className="p-5">
                <h4 className="mb-3 text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{recipe.title}</h4>
                <div className="flex items-center gap-2 mb-4">
                  <img
                    src={recipe.creatorImage}
                    alt={recipe.creatorName}
                    className="w-6 h-6 rounded-full object-cover ring-2 ring-slate-200/50 dark:ring-slate-700/50"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-400 font-medium">{recipe.creatorName}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 font-medium">P: {recipe.protein}g</span>
                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 font-medium">C: {recipe.carbs}g</span>
                  <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-slate-700 dark:text-slate-300 font-medium">F: {recipe.fat}g</span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
