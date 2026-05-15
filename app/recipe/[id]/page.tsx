import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { projectId, publicAnonKey } from "../../../utils/supabase/info.tsx";
import { PageViewTracker } from "../../../src/app/components/PageViewTracker.tsx";
import { AnalyticsEvents } from "../../../src/lib/analytics/events.ts";
import { normaliseInstructions } from "../../../src/lib/recipes/normaliseInstructions.ts";
import { RecipeHeroFallback } from "../../../src/app/components/suppr/RecipeHeroFallback.tsx";

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
  sugar_g: number | null;
  sodium_mg: number | null;
  verified_confidence: number | null;
  source_name: string | null;
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
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
}

async function fetchRecipe(id: string) {
  // Fetch from Supabase. 2026-05-15: recipe + ingredients fire in
  // parallel (saves ~50–150ms TTFB per public-share view — meaningful
  // on the recipe-import-from-Reel viral surface). The ingredients
  // query is harmlessly wasted on 404s (returns []).
  const sb = getServerClient();
  const [{ data: row }, { data: ingredientRows }] = await Promise.all([
    sb
      .from("recipes")
      .select(
        "id, title, description, instructions, image_url, servings, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, verified_confidence, source_name, author:profiles!author_id(display_name)",
      )
      .eq("id", id)
      .eq("published", true)
      .maybeSingle<RecipeRow>(),
    sb
      .from("recipe_ingredients")
      .select("name, amount, unit, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg")
      .eq("recipe_id", id)
      .returns<IngredientRow[]>(),
  ]);

  if (!row) return null;

  // Shared normaliser protects against historic `\n` / `/n` rows typed
  // into the Create Recipe form before build 10 landed the placeholder fix
  // (TestFlight `AO4NtyNB`).
  const instructionSteps = normaliseInstructions(row.instructions)
    .split(/\n+/)
    .map((s: string) => s.trim())
    .filter(Boolean);

  return {
    recipe: {
      id: row.id,
      title: row.title,
      description: row.description,
      // Audit C1 (2026-05-05): when no image, return null so the
      // page renders a gradient fallback block instead of an Unsplash
      // stock photo of stranger food. The caller (page render below)
      // branches on null vs string. The OpenGraph image (line ~124)
      // also takes a null-safe fallback below.
      image: row.image_url ?? null,
      servings: row.servings,
      calories: row.calories,
      protein: row.protein,
      carbs: row.carbs,
      fat: row.fat,
      fiberG: row.fiber_g,
      sugarG: row.sugar_g,
      sodiumMg: row.sodium_mg,
      authorName: row.author?.display_name ?? "Community",
      verifiedConfidence: row.verified_confidence,
      sourceName: row.source_name,
    },
    ingredients: (ingredientRows ?? []).map((i) => ({
      name: i.name,
      amount: i.amount != null ? String(i.amount) : "",
      unit: i.unit ?? "",
      calories: i.calories,
      protein: i.protein,
      carbs: i.carbs,
      fat: i.fat,
      fiberG: i.fiber_g,
      sugarG: i.sugar_g,
      sodiumMg: i.sodium_mg,
    })),
    instructions: instructionSteps,
  };
}

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const data = await fetchRecipe(id);
  if (!data) return { title: "Recipe Not Found — Suppr" };

  const { recipe } = data;
  return {
    title: `${recipe.title} — Suppr`,
    description: `${recipe.calories} kcal · ${recipe.protein}g protein · ${recipe.carbs}g carbs · ${recipe.fat}g fat${recipe.description ? ` — ${recipe.description}` : ""}`,
    openGraph: {
      title: recipe.title,
      description: `${recipe.calories} kcal · ${recipe.protein}g protein`,
      // OpenGraph still needs a URL — only fall back to a generic
      // brand image when no recipe image is available, never the
      // stranger-food Unsplash stock.
      images: recipe.image
        ? [{ url: recipe.image, width: 800, height: 600 }]
        : [{ url: "https://suppr.club/og-default.png", width: 1200, height: 630 }],
      type: "article",
    },
  };
}

export default async function RecipePage({ params }: Props) {
  const { id } = await params;
  const data = await fetchRecipe(id);
  if (!data) notFound();

  const { recipe, ingredients, instructions } = data;

  const confidenceTier =
    recipe.verifiedConfidence != null
      ? recipe.verifiedConfidence >= 0.75
        ? "high"
        : recipe.verifiedConfidence >= 0.5
          ? "medium"
          : "low"
      : null;

  const confidenceLabel = {
    high: "Verified",
    medium: "Mostly verified",
    low: "Estimated",
  } as const;

  const confidenceColor = {
    high: "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800",
    medium: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800",
    low: "text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800",
  } as const;

  const macroCards = [
    { label: "Calories", value: `${Math.round(recipe.calories)}`, unit: "kcal" },
    { label: "Protein", value: `${Math.round(recipe.protein)}`, unit: "g" },
    { label: "Carbs", value: `${Math.round(recipe.carbs)}`, unit: "g" },
    { label: "Fat", value: `${Math.round(recipe.fat)}`, unit: "g" },
    ...(recipe.fiberG != null && recipe.fiberG > 0
      ? [{ label: "Fibre", value: `${Math.round(recipe.fiberG)}`, unit: "g" as const }]
      : []),
    ...(recipe.sugarG != null && recipe.sugarG > 0
      ? [{ label: "Sugar", value: `${recipe.sugarG}`, unit: "g" as const }]
      : []),
    ...(recipe.sodiumMg != null && recipe.sodiumMg > 0
      ? [{ label: "Sodium", value: `${recipe.sodiumMg}`, unit: "mg" as const }]
      : []),
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Recipe",
    name: recipe.title,
    // JSON-LD: omit image when no real recipe photo (don't lie with
    // stock imagery in structured data either).
    ...(recipe.image ? { image: recipe.image } : {}),
    description: recipe.description ?? `${recipe.calories} kcal, ${recipe.protein}g protein`,
    recipeYield: `${recipe.servings} serving${recipe.servings !== 1 ? "s" : ""}`,
    nutrition: {
      "@type": "NutritionInformation",
      calories: `${recipe.calories} calories`,
      proteinContent: `${recipe.protein} g`,
      carbohydrateContent: `${recipe.carbs} g`,
      fatContent: `${recipe.fat} g`,
      ...(recipe.fiberG ? { fiberContent: `${recipe.fiberG} g` } : {}),
      ...(recipe.sugarG != null && recipe.sugarG > 0 ? { sugarContent: `${recipe.sugarG} g` } : {}),
      ...(recipe.sodiumMg != null && recipe.sodiumMg > 0 ? { sodiumContent: `${recipe.sodiumMg} mg` } : {}),
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
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* Nav bar */}
      <header className="sticky top-0 z-10 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800 px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-lg font-bold bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text text-transparent">
            Suppr
          </Link>
          <Link
            href="/login"
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white text-sm font-semibold hover:shadow-lg hover:shadow-violet-500/25 transition-all"
          >
            Plan your week free
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Hero — audit C1 (2026-05-05): when there's no recipe
            photo, render a deterministic gradient block at half
            height instead of the stranger-food Unsplash stock. This
            mirrors the mobile RecipeHeroFallback. Photo case stays
            full aspect-video. */}
        {recipe.image ? (
          <div className="rounded-2xl overflow-hidden shadow-xl mb-8">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={recipe.image}
              alt={recipe.title}
              className="w-full aspect-video object-cover"
            />
          </div>
        ) : (
          // B7 (2026-05-11): swapped the hardcoded gradient + "No
          // photo" caption for the canonical RecipeHeroFallback so
          // detail-page placeholders match Library cards (same
          // deterministic per-recipe gradient + glyph). Aspect ratio
          // matches the photo case via aspect-video.
          <div
            className="relative rounded-2xl overflow-hidden shadow-xl mb-8 aspect-video"
            aria-label={`${recipe.title} — no photo available`}
          >
            <RecipeHeroFallback
              id={recipe.id}
              title={recipe.title}
              iconSize={48}
            />
          </div>
        )}

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
        <div className="grid gap-3 mb-4 grid-cols-2 sm:grid-cols-3 md:grid-cols-4" role="list" aria-label="Nutrition per serving">
          {macroCards.map((m) => (
            <div
              key={m.label}
              role="listitem"
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

        {/* Nutrition confidence badge */}
        {confidenceTier && (
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium mb-8 ${confidenceColor[confidenceTier]}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              confidenceTier === "high" ? "bg-green-500" : confidenceTier === "medium" ? "bg-amber-500" : "bg-red-500"
            }`} />
            Nutrition: {confidenceLabel[confidenceTier]}
            {recipe.verifiedConfidence != null && (
              <span className="opacity-60">({Math.round(recipe.verifiedConfidence * 100)}%)</span>
            )}
          </div>
        )}
        {!confidenceTier && (
          <p className="text-xs text-slate-500 dark:text-slate-400 mb-8">
            Nutrition values are from the recipe source and have not been independently verified.
          </p>
        )}

        {/* Ingredients */}
        {ingredients.length > 0 && (
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-6 mb-6 shadow-sm">
            <h2 className="font-semibold text-slate-900 dark:text-white mb-4">Ingredients</h2>
            <ul className="space-y-2">
              {ingredients.map((ing, idx) => {
                const microBits: string[] = [];
                if ((ing.fiberG ?? 0) > 0) microBits.push(`Fibre ${ing.fiberG}g`);
                if ((ing.sugarG ?? 0) > 0) microBits.push(`Sugar ${ing.sugarG}g`);
                if ((ing.sodiumMg ?? 0) > 0) microBits.push(`Sodium ${ing.sodiumMg}mg`);
                return (
                  <li key={idx} className="flex items-baseline gap-2 text-slate-700 dark:text-slate-300">
                    <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0 mt-1.5" />
                    <span>
                      <span className="font-medium">{ing.amount} {ing.unit}</span> {ing.name}
                      {microBits.length > 0 && (
                        <span className="block text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                          {microBits.join(" · ")}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
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
            Suppr plans your week from recipes like this one — matched to your calorie and protein targets — then generates your shopping list automatically.
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
