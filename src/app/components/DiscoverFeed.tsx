import { useState } from "react";
import { Heart, Bookmark, CheckCircle2, AlertCircle, Search, SlidersHorizontal, X } from "lucide-react";
import { RecipeDetail } from "./RecipeDetail";

interface Recipe {
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
  creatorCalories?: number;
  savedCount: number;
  isSaved: boolean;
}

const mockRecipes: Recipe[] = [
  {
    id: "1",
    creatorName: "Alex Chen",
    creatorImage: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    title: "High-Protein Chicken & Rice Bowl",
    image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop",
    servings: 1,
    calories: 542,
    protein: 48,
    carbs: 52,
    fat: 12,
    isVerified: true,
    savedCount: 1247,
    isSaved: false,
  },
  {
    id: "2",
    creatorName: "Maria Santos",
    creatorImage: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
    title: "Overnight Protein Oats",
    image: "https://images.unsplash.com/photo-1517673132405-a56a62b18caf?w=800&h=600&fit=crop",
    servings: 1,
    calories: 387,
    protein: 32,
    carbs: 48,
    fat: 8,
    isVerified: true,
    creatorCalories: 420,
    savedCount: 892,
    isSaved: false,
  },
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
  },
];

export function DiscoverFeed() {
  const [recipes] = useState<Recipe[]>(mockRecipes);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    verified: false,
    maxCalories: "",
    minProtein: "",
    mealType: "all",
    dietary: "all"
  });

  if (selectedRecipe) {
    return <RecipeDetail recipe={selectedRecipe} onBack={() => setSelectedRecipe(null)} />;
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-6">
      {/* Search and Filters */}
      <div className="mb-8 space-y-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search recipes, ingredients, creators..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-all shadow-sm"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`px-5 py-3.5 rounded-xl border-2 transition-all flex items-center gap-2 font-medium shadow-sm ${
              showFilters
                ? "bg-violet-600 text-white border-violet-600"
                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-700"
            }`}
          >
            <SlidersHorizontal className="w-5 h-5" />
            Filters
          </button>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <div className="backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 shadow-xl">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Meal Type</label>
                <select
                  value={filters.mealType}
                  onChange={(e) => setFilters({ ...filters, mealType: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="all">All Meals</option>
                  <option value="breakfast">Breakfast</option>
                  <option value="lunch">Lunch</option>
                  <option value="dinner">Dinner</option>
                  <option value="snack">Snack</option>
                </select>
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Dietary</label>
                <select
                  value={filters.dietary}
                  onChange={(e) => setFilters({ ...filters, dietary: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                >
                  <option value="all">All Diets</option>
                  <option value="vegan">Vegan</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="keto">Keto</option>
                  <option value="paleo">Paleo</option>
                </select>
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Max Calories</label>
                <input
                  type="number"
                  placeholder="e.g. 500"
                  value={filters.maxCalories}
                  onChange={(e) => setFilters({ ...filters, maxCalories: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Min Protein (g)</label>
                <input
                  type="number"
                  placeholder="e.g. 30"
                  value={filters.minProtein}
                  onChange={(e) => setFilters({ ...filters, minProtein: e.target.value })}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/50"
                />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.verified}
                    onChange={(e) => setFilters({ ...filters, verified: e.target.checked })}
                    className="w-5 h-5 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Verified Only</span>
                </label>
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => setFilters({ verified: false, maxCalories: "", minProtein: "", mealType: "all", dietary: "all" })}
                  className="text-sm text-violet-600 hover:text-violet-700 dark:text-violet-400 dark:hover:text-violet-300 font-medium"
                >
                  Clear All
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-8">
        {recipes.map((recipe) => (
          <article key={recipe.id} className="group bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:scale-[1.01]">
            {/* Creator Header */}
            <div className="px-5 py-4 flex items-center gap-3">
              <div className="relative">
                <img
                  src={recipe.creatorImage}
                  alt={recipe.creatorName}
                  className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-200/50 dark:ring-slate-700/50"
                />
                <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-slate-900"></div>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-slate-900 dark:text-white">{recipe.creatorName}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">2 hours ago</p>
              </div>
              <button className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
                <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                  <circle cx="10" cy="4" r="1.5" />
                  <circle cx="10" cy="10" r="1.5" />
                  <circle cx="10" cy="16" r="1.5" />
                </svg>
              </button>
            </div>

            {/* Recipe Image */}
            <button onClick={() => setSelectedRecipe(recipe)} className="w-full relative overflow-hidden">
              <img src={recipe.image} alt={recipe.title} className="w-full aspect-[4/3] object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>

            {/* Actions */}
            <div className="px-5 py-4 flex items-center gap-4">
              <button className="text-slate-400 hover:text-red-500 transition-all hover:scale-110 active:scale-95">
                <Heart className="w-6 h-6" />
              </button>
              <button
                className={`transition-all hover:scale-110 active:scale-95 ${
                  recipe.isSaved ? "text-violet-600" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                }`}
              >
                <Bookmark className="w-6 h-6" fill={recipe.isSaved ? "currentColor" : "none"} />
              </button>
              <span className="text-sm text-slate-500 dark:text-slate-400 ml-auto flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-violet-500 rounded-full"></span>
                {recipe.savedCount.toLocaleString()} saved
              </span>
            </div>

            {/* Recipe Details */}
            <div className="px-5 pb-5">
              <button onClick={() => setSelectedRecipe(recipe)} className="text-left w-full">
                <h3 className="mb-4 text-slate-900 dark:text-white group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">{recipe.title}</h3>
              </button>

              {/* Verified Macro Display */}
              <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 backdrop-blur-sm rounded-xl p-4 border border-slate-200/50 dark:border-slate-700/50">
                <div className="flex items-center gap-2 mb-3">
                  {recipe.isVerified ? (
                    <>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-950/30 rounded-full">
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                        <span className="text-xs font-medium text-green-700 dark:text-green-400">Verified</span>
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">nutrition per serving</span>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-1.5 px-2.5 py-1 bg-orange-100 dark:bg-orange-950/30 rounded-full">
                        <AlertCircle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                        <span className="text-xs font-medium text-orange-700 dark:text-orange-400">Estimate</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-4 gap-4">
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Calories</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{recipe.calories}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Protein</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{recipe.protein}g</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Carbs</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{recipe.carbs}g</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Fat</p>
                    <p className="text-lg font-bold text-slate-900 dark:text-white">{recipe.fat}g</p>
                  </div>
                </div>

                {/* Creator Discrepancy Warning */}
                {recipe.creatorCalories && Math.abs(recipe.creatorCalories - recipe.calories) / recipe.calories > 0.1 && (
                  <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-start gap-2 px-3 py-2 bg-orange-50 dark:bg-orange-950/20 rounded-lg border border-orange-200/50 dark:border-orange-800/50">
                      <AlertCircle className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                      <p className="text-xs text-orange-700 dark:text-orange-300">
                        Creator stated: {recipe.creatorCalories} kcal (
                        {Math.round(((recipe.creatorCalories - recipe.calories) / recipe.calories) * 100)}% difference)
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
