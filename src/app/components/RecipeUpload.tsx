import { useState } from "react";
import { Upload, Plus, X, ChefHat, Camera, AlertCircle } from "lucide-react";

interface RecipeUploadProps {
  userTier: "free" | "base" | "pro";
}

interface Ingredient {
  id: string;
  name: string;
  amount: string;
  unit: string;
}

export function RecipeUpload({ userTier }: RecipeUploadProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState(1);
  const [prepTime, setPrepTime] = useState(15);
  const [cookTime, setCookTime] = useState(30);
  const [ingredients, setIngredients] = useState<Ingredient[]>([
    { id: "1", name: "", amount: "", unit: "g" }
  ]);
  const [instructions, setInstructions] = useState("");
  const [mealType, setMealType] = useState("lunch");
  const [dietary, setDietary] = useState<string[]>([]);

  const isPaidUser = userTier === "base" || userTier === "pro";
  const isCreator = userTier === "pro"; // Only Pro users can create recipes

  const addIngredient = () => {
    setIngredients([...ingredients, { id: Date.now().toString(), name: "", amount: "", unit: "g" }]);
  };

  const removeIngredient = (id: string) => {
    setIngredients(ingredients.filter(ing => ing.id !== id));
  };

  const updateIngredient = (id: string, field: keyof Ingredient, value: string) => {
    setIngredients(ingredients.map(ing => ing.id === id ? { ...ing, [field]: value } : ing));
  };

  if (!isCreator) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="relative inline-block mb-8">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-3xl blur-2xl opacity-30 animate-pulse"></div>
          <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-600 flex items-center justify-center shadow-2xl shadow-violet-500/50">
            <ChefHat className="w-12 h-12 text-white" />
          </div>
        </div>
        <h1 className="mb-4 bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">Recipe Creator</h1>
        <p className="text-slate-600 dark:text-slate-400 mb-10 max-w-2xl mx-auto text-lg">
          Share your recipes with the Platemate community. Pro subscribers can upload recipes with automatically verified nutrition data.
        </p>

        <div className="backdrop-blur-xl bg-white/60 dark:bg-slate-900/60 border border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-8 mb-10 text-left max-w-2xl mx-auto shadow-2xl">
          <h3 className="mb-6 text-slate-900 dark:text-white">Pro Creator Features</h3>
          <ul className="space-y-3 text-slate-600 dark:text-slate-400">
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-violet-600 dark:text-violet-400 text-sm">✓</span>
              </div>
              <span>Automatic nutrition verification using our database of 500k+ ingredients</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-violet-600 dark:text-violet-400 text-sm">✓</span>
              </div>
              <span>Recipe analytics showing saves, views, and user ratings</span>
            </li>
            <li className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-950/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-violet-600 dark:text-violet-400 text-sm">✓</span>
              </div>
              <span>Build your following and share your culinary expertise</span>
            </li>
          </ul>
        </div>

        <button className="px-8 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-2xl hover:shadow-violet-500/30 transition-all duration-300 hover:scale-105 inline-flex items-center gap-2 text-lg font-semibold">
          Upgrade to Pro
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <h1 className="bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">Create Recipe</h1>
        </div>
        <p className="text-slate-600 dark:text-slate-400">Share your recipe with verified nutrition data</p>
      </div>

      {/* Image Upload */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 mb-6 shadow-lg">
        <label className="block mb-3 text-sm font-medium text-slate-700 dark:text-slate-300">Recipe Photo</label>
        <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-12 text-center hover:border-violet-400 dark:hover:border-violet-600 transition-all cursor-pointer bg-slate-50 dark:bg-slate-800/50">
          <Camera className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 dark:text-slate-400 mb-2">Click to upload or drag and drop</p>
          <p className="text-sm text-slate-500 dark:text-slate-500">PNG, JPG up to 10MB</p>
        </div>
      </div>

      {/* Basic Info */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 mb-6 shadow-lg">
        <h3 className="text-slate-900 dark:text-white mb-6">Basic Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Recipe Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., High-Protein Chicken & Rice Bowl"
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
          <div>
            <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your recipe..."
              rows={3}
              className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Servings</label>
              <input
                type="number"
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Prep (min)</label>
              <input
                type="number"
                value={prepTime}
                onChange={(e) => setPrepTime(Number(e.target.value))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Cook (min)</label>
              <input
                type="number"
                value={cookTime}
                onChange={(e) => setCookTime(Number(e.target.value))}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Meal Type</label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Dietary Tags</label>
              <div className="flex flex-wrap gap-2">
                {["vegetarian", "vegan", "gluten-free", "keto"].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setDietary(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-all capitalize ${
                      dietary.includes(tag)
                        ? "bg-violet-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Ingredients */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 mb-6 shadow-lg">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-slate-900 dark:text-white">Ingredients</h3>
          <button
            onClick={addIngredient}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-all flex items-center gap-2 text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            Add Ingredient
          </button>
        </div>
        <div className="bg-violet-50 dark:bg-violet-950/20 rounded-xl p-4 mb-6 border border-violet-200 dark:border-violet-800">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-violet-600 dark:text-violet-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-violet-800 dark:text-violet-300">
              As you add ingredients, we'll automatically calculate nutrition data from our verified database. Unrecognized ingredients will be flagged for manual entry.
            </p>
          </div>
        </div>
        <div className="space-y-3">
          {ingredients.map((ingredient) => (
            <div key={ingredient.id} className="grid grid-cols-12 gap-3">
              <input
                type="text"
                value={ingredient.name}
                onChange={(e) => updateIngredient(ingredient.id, "name", e.target.value)}
                placeholder="Ingredient name"
                className="col-span-6 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
              <input
                type="text"
                value={ingredient.amount}
                onChange={(e) => updateIngredient(ingredient.id, "amount", e.target.value)}
                placeholder="Amount"
                className="col-span-3 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              />
              <select
                value={ingredient.unit}
                onChange={(e) => updateIngredient(ingredient.id, "unit", e.target.value)}
                className="col-span-2 px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
              >
                <option value="g">g</option>
                <option value="kg">kg</option>
                <option value="ml">ml</option>
                <option value="cup">cup</option>
                <option value="tbsp">tbsp</option>
                <option value="tsp">tsp</option>
                <option value="oz">oz</option>
                <option value="lb">lb</option>
              </select>
              <button
                onClick={() => removeIngredient(ingredient.id)}
                className="col-span-1 flex items-center justify-center text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Instructions */}
      <div className="backdrop-blur-xl bg-white/70 dark:bg-slate-900/70 border-2 border-slate-200/50 dark:border-slate-800/50 rounded-2xl p-6 mb-6 shadow-lg">
        <h3 className="text-slate-900 dark:text-white mb-4">Cooking Instructions</h3>
        <textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="1. First step...&#10;2. Second step...&#10;3. Third step..."
          rows={10}
          className="w-full px-4 py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-500/50"
        />
      </div>

      {/* Actions */}
      <div className="flex gap-4">
        <button className="flex-1 px-6 py-4 border-2 border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-all text-slate-700 dark:text-slate-300 font-medium">
          Save as Draft
        </button>
        <button className="flex-1 px-6 py-4 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-xl hover:shadow-2xl hover:shadow-violet-500/30 transition-all duration-300 hover:scale-[1.02] font-semibold flex items-center justify-center gap-2">
          <Upload className="w-5 h-5" />
          Publish Recipe
        </button>
      </div>
    </div>
  );
}
