import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { projectId, publicAnonKey } from "../../../utils/supabase/info.tsx";
import { PageViewTracker } from "../../../src/app/components/PageViewTracker.tsx";
import { AnalyticsEvents } from "../../../src/lib/analytics/events.ts";
import {
  getRecipeById,
  getIngredientsForRecipe,
  getInstructionsForRecipe,
} from "../../../src/data/recipeCatalog.ts";

const supabaseUrl = `https://${projectId}.supabase.co`;

function getServerClient() {
  return createClient(supabaseUrl, publicAnonKey);
}

interface RecipeRow {
  id: string;
  title: string;
  description: string | null;
  instructions: string | null;
  image_url: string | null;
  servings: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber_g: number | null;
  author: { display_name: string | null } | null;
}

interface IngredientRow {
  name: string;
  amount: number | null;
  unit: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

async function fetchRecipe(id: string) {
  // Check catalog first
  const catalogRecipe = getRecipeById(id);
  if (catalogRecipe) {
    return {
      recipe: {
        id: catalogRecipe.id,
        title: catalogRecipe.title,
        description: null as string | null,
        image: catalogRecipe.image,
        servings: catalogRecipe.servings,
        calories: catalogRecipe.calories,
        protein: catalogRecipe.protein,
        carbs: catalogRecipe.carbs,
        fat: catalogRecipe.fat,
        fiberG: catalogRecipe.fiberG ?? null,
        authorName: catalogRecipe.creatorName,
      },
      ingredients: getIngredientsForRecipe(id).map((i) => ({
        name: i.name,
        amount: i.amount,
        unit: i.unit,
        calories: i.calories,
        protein: i.protein,
        carbs: i.carbs,
        fat: i.fat,
      })),
      instructions: getInstructionsForRecipe(id),
    };
  }

  // Fetch from Supabase
  const sb = getServerClient();
  const { data: row } = await sb
    .from("recipes")
    .select(
      "id, title, description, instructions, image_url, servings, calories, protein, carbs, fat, fiber_g, author:profiles!author_id(display_name)",
    )
    .eq("id", id)
    .eq("published", true)
    .maybeSingle<RecipeRow>();

  if (!row) return null;

  const { data: ingredientRows } = await sb
    .from("recipe_ingredients")
    .select("name, amount, unit, calories, protein, carbs, fat")
    .eq("recipe_id", id)
    .returns<IngredientRow[]>();

  const instructionSteps = (row.instructions ?? "")
    .split(/\n+/)
    .map((s: string) => s.trim())
    .filter(Boolean);

  return {
    recipe: {
      id: row.id,
      title: row.title,
      description: row.description,
      image: row.image_url ?? "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop",
      servings: row.servings,
      calories: row.calories,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      fiberG: row.fiber_g,
      authorName: row.author?.display_name ?? "Community",
    },
    ingredients: (ingredientRows ?? []).map((i) => ({
      name: i.name,
      amount: i.amount != null ? String(i.amount) : "",
      unit: i.unit ?? "",
      calories: i.calories,
      protein: i.protein,
      carbs: i.carbs,
      fat: i.fat,
    })),
    instructions: instructionSteps,
  };
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchRecipe(id);
  if (!data) return { title: "Recipe Not Found — Platemate" };

  const { recipe } = data;
  return {
    title: `${recipe.title} — Platemate`,
    description: `${recipe.calories} kcal · ${recipe.protein}g protein · ${recipe.carbs}g carbs · ${recipe.fat}g fat${recipe.description ? ` — ${recipe.description}` : ""}`,
    openGraph: {
      title: recipe.title,
      description: `${recipe.calories} kcal · ${recipe.protein}g protein`,
      images: [{ url: recipe.image, width: 800, height: 600 }],
      type: "article",
    },
  };
}

export default async function RecipePage({ params }: Props) {
  const { id } = await params;
  const data = await fetchRecipe(id);
  if (!data) notFound();

  const { recipe, ingredients, instructions } = data;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    image: recipe.image,
    description: recipe.description ?? `${recipe.calories} kcal, ${recipe.protein}g protein`,
    recipeYield: `${recipe.servings} serving${recipe.servings !== 1 ? "s" : ""}`,
    nutrition: {
      "@type": "NutritionInformation",
      calories: `${recipe.calories} calories`,
      proteinContent: `${recipe.protein} g`,
      carbohydrateContent: `${recipe.carbs} g`,
      fatContent: `${recipe.fat} g`,
    },
    recipeIngredient: ingredients.map((i) => [i.amount, i.unit, i.name].filter(Boolean).join(" ")),
    recipeInstructions: instructions.map((step, idx) => ({
      "@type": "HowToStep",
      position: idx + 1,
      text: step,
    })),
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <PageViewTracker event={AnalyticsEvents.recipe_page_viewed} properties={{ recipeId: recipe.id, title: recipe.title }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Nav bar */}
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <a href="/" className="text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Platemate
          </a>
          <a
            href="/login"
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-violet-500/25 transition-all"
          >
            Plan your week free
          </a>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Hero */}
        <div className="rounded-2xl overflow-hidden shadow-xl mb-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={recipe.image}
            alt={recipe.title}
            className="w-full aspect-video object-cover"
          />
        </div>

        <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
          {recipe.title}
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-6">
          By {recipe.authorName} · {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}
        </p>

        {recipe.description && (
          <p className="text-slate-700 dark:text-slate-300 mb-8 leading-relaxed">{recipe.description}</p>
        )}

        {/* Macro cards */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          {[
            { label: "Calories", value: `${recipe.calories}`, unit: "kcal" },
            { label: "Protein", value: `${recipe.protein}`, unit: "g" },
            { label: "Carbs", value: `${recipe.carbs}`, unit: "g" },
            { label: "Fat", value: `${recipe.fat}`, unit: "g" },
          ].map((m) => (
            <div
              key={m.label}
              className="text-center p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm"
            >
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{m.label}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">
                {m.value}
                <span className="text-sm font-normal text-slate-500 ml-0.5">{m.unit}</span>
              </p>
            </div>
          ))}
        </div>

        {/* Ingredients */}
        {ingredients.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Ingredients</h2>
            <ul className="space-y-2">
              {ingredients.map((ing, idx) => (
                <li key={idx} className="flex items-baseline gap-2 text-slate-700 dark:text-slate-300">
                  <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                  <span>
                    <span className="font-medium">{ing.amount} {ing.unit}</span> {ing.name}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Instructions */}
        {instructions.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-8 shadow-sm">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Instructions</h2>
            <ol className="space-y-4">
              {instructions.map((step, idx) => (
                <li key={idx} className="flex gap-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center text-sm font-semibold">
                    {idx + 1}
                  </span>
                  <p className="text-slate-700 dark:text-slate-300 pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* CTA */}
        <div className="text-center py-10 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
            Add this to a meal plan that hits your macros
          </h3>
          <p className="text-slate-600 dark:text-slate-400 mb-6 max-w-md mx-auto">
            Platemate plans your week from recipes like this one — matched to your calorie and protein targets — then generates your shopping list automatically.
          </p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold text-lg hover:shadow-xl hover:shadow-violet-500/30 transition-all"
          >
            Start planning free
          </a>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">No credit card required</p>
        </div>
      </main>
    </div>
  );
}
