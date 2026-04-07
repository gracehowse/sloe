import { useState } from "react";
import { ArrowLeft, Bookmark, Share2, CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

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

interface Ingredient {
  name: string;
  amount: string;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  isVerified: boolean;
  source: "Open Food Facts" | "Nutritionix" | "USDA";
}

interface RecipeDetailProps {
  recipe: Recipe;
  onBack: () => void;
}

const mockIngredients: Ingredient[] = [
  {
    name: "Chicken breast, skinless",
    amount: "200",
    unit: "g",
    calories: 330,
    protein: 62,
    carbs: 0,
    fat: 7,
    isVerified: true,
    source: "USDA",
  },
  {
    name: "White rice, cooked",
    amount: "150",
    unit: "g",
    calories: 195,
    protein: 4,
    carbs: 43,
    fat: 0,
    isVerified: true,
    source: "Open Food Facts",
  },
  {
    name: "Olive oil",
    amount: "5",
    unit: "ml",
    calories: 45,
    protein: 0,
    carbs: 0,
    fat: 5,
    isVerified: true,
    source: "USDA",
  },
];

export function RecipeDetail({ recipe, onBack }: RecipeDetailProps) {
  const [isSaved, setIsSaved] = useState(recipe.isSaved);
  const [servings, setServings] = useState(recipe.servings);
  const [showIngredients, setShowIngredients] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);

  const scaledMacros = {
    calories: Math.round((recipe.calories * servings) / recipe.servings),
    protein: Math.round((recipe.protein * servings) / recipe.servings),
    carbs: Math.round((recipe.carbs * servings) / recipe.servings),
    fat: Math.round((recipe.fat * servings) / recipe.servings),
  };

  const ingredientTotal = mockIngredients.reduce(
    (acc, ing) => ({
      calories: acc.calories + ing.calories,
      protein: acc.protein + ing.protein,
      carbs: acc.carbs + ing.carbs,
      fat: acc.fat + ing.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );

  const macroAccuracy = Math.abs(ingredientTotal.calories - recipe.calories);

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="sticky top-0 backdrop-blur-xl bg-white/80 dark:bg-slate-900/80 border-b border-slate-200/50 dark:border-slate-800/50 px-6 py-4 flex items-center gap-4 z-10 shadow-sm">
        <button onClick={onBack} className="p-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="flex-1 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">{recipe.title}</h2>
        <button
          onClick={() => setIsSaved(!isSaved)}
          className={`p-2.5 rounded-xl transition-all ${
            isSaved
              ? "text-violet-600 bg-violet-100 dark:bg-violet-950/30 shadow-lg shadow-violet-500/20"
              : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
        >
          <Bookmark className="w-5 h-5" fill={isSaved ? "currentColor" : "none"} />
        </button>
        <button className="p-2.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all">
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      <div className="px-6 py-8 space-y-8">
        {/* Hero Image */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl group">
          <img src={recipe.image} alt={recipe.title} className="w-full aspect-video object-cover group-hover:scale-105 transition-transform duration-500" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
        </div>

        {/* Creator Info */}
        <div className="flex items-center gap-4 p-6 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl rounded-2xl border border-slate-200/50 dark:border-slate-800/50 shadow-lg">
          <img src={recipe.creatorImage} alt={recipe.creatorName} className="w-14 h-14 rounded-full object-cover ring-2 ring-violet-500/20" />
          <div className="flex-1">
            <p className="font-semibold text-slate-900 dark:text-white">{recipe.creatorName}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{recipe.savedCount.toLocaleString()} saves · 2.4k followers</p>
          </div>
          <button className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:shadow-violet-500/25 transition-all duration-300 hover:scale-105">
            Follow
          </button>
        </div>

        {/* Servings Selector */}
        <div className="bg-gradient-to-br from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 backdrop-blur-sm rounded-2xl p-5 flex items-center justify-between border border-slate-200/50 dark:border-slate-700/50 shadow-lg">
          <span className="font-semibold text-slate-900 dark:text-white">Servings</span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setServings(Math.max(1, servings - 1))}
              className="w-9 h-9 rounded-xl bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all flex items-center justify-center shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
            >
              −
            </button>
            <span className="w-10 text-center font-bold text-lg text-slate-900 dark:text-white">{servings}</span>
            <button
              onClick={() => setServings(servings + 1)}
              className="w-9 h-9 rounded-xl bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-600 transition-all flex items-center justify-center shadow-sm hover:shadow-md hover:scale-105 active:scale-95"
            >
              +
            </button>
          </div>
        </div>

        {/* Verified Macros */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl overflow-hidden shadow-xl">
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 px-6 py-4 flex items-center gap-3 border-b border-green-200/50 dark:border-green-800/50">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-xl">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <span className="font-semibold text-slate-900 dark:text-white flex-1">Verified Nutrition</span>
            {macroAccuracy <= 1 && (
              <span className="px-3 py-1.5 text-xs font-semibold text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-950/50 rounded-full border border-green-200/50 dark:border-green-800/50">
                ±{macroAccuracy} kcal accuracy
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 divide-x divide-slate-200 dark:divide-slate-800">
            <div className="px-6 py-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <p className="text-3xl font-bold bg-gradient-to-br from-violet-600 to-indigo-600 bg-clip-text text-transparent mb-1">{scaledMacros.calories}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Calories</p>
            </div>
            <div className="px-6 py-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{scaledMacros.protein}g</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Protein</p>
            </div>
            <div className="px-6 py-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{scaledMacros.carbs}g</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Carbs</p>
            </div>
            <div className="px-6 py-6 text-center hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <p className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{scaledMacros.fat}g</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">Fat</p>
            </div>
          </div>

          {/* Creator Discrepancy */}
          {recipe.creatorCalories &&
            Math.abs(recipe.creatorCalories - recipe.calories) / recipe.calories > 0.1 && (
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 border-t border-orange-200 dark:border-orange-900 px-6 py-4 flex items-start gap-3">
                <div className="p-1.5 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                  <AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-orange-900 dark:text-orange-200">
                    Creator stated {recipe.creatorCalories} kcal (
                    {Math.round(((recipe.creatorCalories - recipe.calories) / recipe.calories) * 100)}% difference)
                  </p>
                  <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                    Verified value calculated from ingredient data
                  </p>
                </div>
              </div>
            )}
        </div>

        {/* Ingredients Section */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl overflow-hidden shadow-xl">
          <button
            onClick={() => setShowIngredients(!showIngredients)}
            className="w-full bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 px-6 py-4 flex items-center justify-between hover:from-slate-100 hover:to-slate-200/50 dark:hover:from-slate-800/70 dark:hover:to-slate-800/50 transition-all"
          >
            <span className="font-semibold text-slate-900 dark:text-white">Ingredients</span>
            {showIngredients ? (
              <ChevronUp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            )}
          </button>
          {showIngredients && (
            <div className="divide-y divide-slate-200 dark:divide-slate-800">
              {mockIngredients.map((ingredient, index) => (
                <div key={index} className="px-6 py-4 flex items-start justify-between hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 dark:text-white">{ingredient.name}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {(parseFloat(ingredient.amount) * servings) / recipe.servings} {ingredient.unit}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 dark:bg-green-950/30 rounded-full">
                        <CheckCircle2 className="w-3 h-3 text-green-600 dark:text-green-400" />
                        <span className="text-xs font-medium text-green-700 dark:text-green-400">{ingredient.source}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right ml-4">
                    <p className="font-semibold text-slate-900 dark:text-white">{Math.round((ingredient.calories * servings) / recipe.servings)} kcal</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                      P: {Math.round((ingredient.protein * servings) / recipe.servings)}g · C:{" "}
                      {Math.round((ingredient.carbs * servings) / recipe.servings)}g · F:{" "}
                      {Math.round((ingredient.fat * servings) / recipe.servings)}g
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Instructions Section */}
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 rounded-2xl overflow-hidden shadow-xl">
          <button
            onClick={() => setShowInstructions(!showInstructions)}
            className="w-full bg-gradient-to-r from-slate-50 to-slate-100/50 dark:from-slate-800/50 dark:to-slate-800/30 px-6 py-4 flex items-center justify-between hover:from-slate-100 hover:to-slate-200/50 dark:hover:from-slate-800/70 dark:hover:to-slate-800/50 transition-all"
          >
            <span className="font-semibold text-slate-900 dark:text-white">Instructions</span>
            {showInstructions ? (
              <ChevronUp className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            )}
          </button>
          {showInstructions && (
            <div className="px-6 py-6 space-y-5">
              <div className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold shadow-lg shadow-violet-500/20">
                  1
                </span>
                <p className="text-slate-700 dark:text-slate-300 pt-1">Season chicken breast with salt and pepper. Heat olive oil in a pan over medium-high heat.</p>
              </div>
              <div className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold shadow-lg shadow-violet-500/20">
                  2
                </span>
                <p className="text-slate-700 dark:text-slate-300 pt-1">Cook chicken for 6-7 minutes per side until golden brown and cooked through. Let rest for 5 minutes.</p>
              </div>
              <div className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold shadow-lg shadow-violet-500/20">
                  3
                </span>
                <p className="text-slate-700 dark:text-slate-300 pt-1">While chicken rests, prepare rice according to package instructions.</p>
              </div>
              <div className="flex gap-4">
                <span className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold shadow-lg shadow-violet-500/20">
                  4
                </span>
                <p className="text-slate-700 dark:text-slate-300 pt-1">Slice chicken and serve over rice. Enjoy immediately.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
