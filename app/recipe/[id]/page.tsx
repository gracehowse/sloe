import { createClient } from "@supabase/supabase-js";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { supabasePublicAnonKey, supabasePublicUrl } from "../../../utils/supabase/publicConfig.ts";
import { PageViewTracker } from "../../../src/app/components/PageViewTracker.tsx";
import { AnalyticsEvents } from "../../../src/lib/analytics/events.ts";
import { normaliseInstructions } from "../../../src/lib/recipes/normaliseInstructions.ts";
import { RecipeHeroFallback } from "../../../src/app/components/suppr/RecipeHeroFallback.tsx";

function getServerClient() {
  return createClient(supabasePublicUrl(), supabasePublicAnonKey());
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
  creator_id: string | null;
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
        "id, title, description, instructions, image_url, servings, calories, protein, carbs, fat, fiber_g, sugar_g, sodium_mg, verified_confidence, source_name, creator_id, author:profiles!author_id(display_name)",
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
      creatorId: row.creator_id,
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

  // Sloe confidence tokens — sage (high) / amber (medium) / brick (low). The
  // `-solid` text variants clear AA on their soft tints; dot colours are set
  // inline at the render site from the matching `--confidence-*` token.
  const confidenceColor = {
    high: "text-success-solid bg-success-soft border-success/30",
    medium: "text-warning-solid bg-warning-soft border-warning/30",
    low: "text-destructive-solid bg-destructive-soft border-destructive/30",
  } as const;

  // Figma 332:2 macro strip — flat 4-up (CAL / PRO / CARB / FAT) in one cream
  // card. The four core macros are the strip; fibre/sugar/sodium (when present)
  // continue below the strip as a secondary chip row so no nutrition VALUE is
  // dropped from the page (the strip layout is Figma-fixed at four columns).
  const macroStrip = [
    { label: "CAL", value: `${Math.round(recipe.calories)}`, unit: "" },
    { label: "PRO", value: `${Math.round(recipe.protein)}`, unit: "g" },
    { label: "CARB", value: `${Math.round(recipe.carbs)}`, unit: "g" },
    { label: "FAT", value: `${Math.round(recipe.fat)}`, unit: "g" },
  ];
  const microChips = [
    ...(recipe.fiberG != null && recipe.fiberG > 0
      ? [{ label: "Fibre", value: `${Math.round(recipe.fiberG)}g` }]
      : []),
    ...(recipe.sugarG != null && recipe.sugarG > 0
      ? [{ label: "Sugar", value: `${recipe.sugarG}g` }]
      : []),
    ...(recipe.sodiumMg != null && recipe.sodiumMg > 0
      ? [{ label: "Sodium", value: `${recipe.sodiumMg}mg` }]
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
    // Figma 332:2 — Sloe cream page (#f6f5f2 surface) replaces the slate base.
    <div className="min-h-screen bg-background-secondary">
      <PageViewTracker event={AnalyticsEvents.recipe_page_viewed} properties={{ recipeId: recipe.id, title: recipe.title }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
      />

      {/* Nav bar — Sloe palette: plum wordmark, clay CTA pill. */}
      <header className="sticky top-0 z-10 bg-background-secondary/90 backdrop-blur-xl border-b border-border px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href="/"
            className="text-lg font-semibold text-foreground-brand"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            Suppr
          </Link>
          <Link
            href="/login"
            className="px-5 py-2 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:brightness-95 transition-all"
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
          <div className="rounded-3xl overflow-hidden shadow-xl mb-8">
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
            className="relative rounded-3xl overflow-hidden shadow-xl mb-8 aspect-video"
            aria-label={`${recipe.title} — no photo available`}
          >
            <RecipeHeroFallback
              id={recipe.id}
              title={recipe.title}
              iconSize={48}
            />
          </div>
        )}

        {/* H1 — Figma 332:2: Newsreader serif, plum, normal weight, 36/45. */}
        <h1
          className="text-foreground-brand mb-2"
          style={{
            fontFamily: "var(--font-headline)",
            fontSize: "36px",
            lineHeight: "45px",
            fontWeight: 400,
          }}
        >
          {recipe.title}
        </h1>
        <p className="text-foreground-secondary mb-6">
          By{" "}
          {recipe.creatorId ? (
            <Link
              href={`/creator/${recipe.creatorId}`}
              className="font-medium text-primary-solid hover:underline"
            >
              {recipe.authorName}
            </Link>
          ) : (
            recipe.authorName
          )}
          {" "}· {recipe.servings} serving{recipe.servings !== 1 ? "s" : ""}
        </p>

        {recipe.description && (
          <p className="text-foreground mb-8 leading-relaxed">{recipe.description}</p>
        )}

        {/* Macro summary — Figma 332:2: ONE flat cream card, four equal columns,
            serif value + small-caps label (CAL / PRO / CARB / FAT). */}
        <div
          className="mb-4 grid grid-cols-4 rounded-2xl bg-card border border-border"
          role="list"
          aria-label="Nutrition per serving"
        >
          {macroStrip.map((m, idx) => (
            <div
              key={m.label}
              role="listitem"
              className={`flex flex-col items-center justify-center py-5 ${
                idx > 0 ? "border-l border-border" : ""
              }`}
            >
              <p
                className="text-foreground-brand tabular-nums"
                style={{ fontFamily: "var(--font-headline)", fontSize: "24px", fontWeight: 400 }}
              >
                {m.value}
                {m.unit ? (
                  <span className="text-base font-normal text-foreground-secondary">{m.unit}</span>
                ) : null}
              </p>
              <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-foreground-secondary">
                {m.label}
              </p>
            </div>
          ))}
        </div>

        {/* Micro chips — fibre / sugar / sodium when present. Kept below the
            four-column Figma strip so no nutrition value is dropped. */}
        {microChips.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2" aria-label="Additional nutrition per serving">
            {microChips.map((m) => (
              <span
                key={m.label}
                className="inline-flex items-baseline gap-1.5 rounded-full bg-card border border-border px-3 py-1.5 text-xs text-foreground"
              >
                <span className="text-foreground-secondary">{m.label}</span>
                <span className="font-semibold tabular-nums">{m.value}</span>
              </span>
            ))}
          </div>
        )}

        {/* Nutrition confidence badge — Sloe confidence tokens (sage/amber/brick). */}
        {confidenceTier && (
          <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium mb-8 ${confidenceColor[confidenceTier]}`}>
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{
                backgroundColor:
                  confidenceTier === "high"
                    ? "var(--confidence-high)"
                    : confidenceTier === "medium"
                      ? "var(--confidence-med)"
                      : "var(--confidence-low)",
              }}
            />
            Nutrition: {confidenceLabel[confidenceTier]}
            {recipe.verifiedConfidence != null && (
              <span className="opacity-60">({Math.round(recipe.verifiedConfidence * 100)}%)</span>
            )}
          </div>
        )}
        {!confidenceTier && (
          <p className="text-xs text-foreground-secondary mb-8">
            Nutrition values are from the recipe source and have not been independently verified.
          </p>
        )}

        {/* Ingredients — Figma 332:2 photo-card grid. Each card is a cream
            tile (radius 24) with an image area on top + name + amount below.
            The public-share recipe_ingredients rows carry NO per-ingredient
            image (only the recipe-level hero exists), so the image area uses
            the EXISTING deterministic RecipeHeroFallback glyph keyed per
            ingredient — never an empty grey box, and no new imagery is wired. */}
        {ingredients.length > 0 && (
          <div className="mb-6">
            <h2
              className="text-foreground-brand mb-4"
              style={{ fontFamily: "var(--font-headline)", fontSize: "20px", fontWeight: 400 }}
            >
              Ingredients
            </h2>
            <ul
              className="grid grid-cols-3 sm:grid-cols-4 gap-3"
              aria-label="Ingredients"
            >
              {ingredients.map((ing, idx) => {
                const microBits: string[] = [];
                if ((ing.fiberG ?? 0) > 0) microBits.push(`Fibre ${ing.fiberG}g`);
                if ((ing.sugarG ?? 0) > 0) microBits.push(`Sugar ${ing.sugarG}g`);
                if ((ing.sodiumMg ?? 0) > 0) microBits.push(`Sodium ${ing.sodiumMg}mg`);
                const amountLine = [ing.amount, ing.unit].filter(Boolean).join(" ");
                return (
                  <li
                    key={idx}
                    className="overflow-hidden rounded-3xl bg-card border border-border"
                  >
                    <div className="relative h-[86px] w-full">
                      <RecipeHeroFallback
                        id={`${recipe.id}-ing-${idx}`}
                        title={ing.name}
                        iconSize={28}
                      />
                    </div>
                    <div className="px-2.5 py-2">
                      <p className="text-xs font-semibold text-foreground leading-snug line-clamp-2">
                        {ing.name}
                      </p>
                      {amountLine ? (
                        <p className="mt-0.5 text-[11px] text-foreground-secondary tabular-nums">
                          {amountLine}
                        </p>
                      ) : null}
                      {microBits.length > 0 && (
                        <p className="mt-0.5 text-[10px] text-foreground-tertiary leading-snug">
                          {microBits.join(" · ")}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        {/* Instructions */}
        {instructions.length > 0 && (
          <div className="bg-card rounded-3xl border border-border p-6 mb-8 shadow-sm">
            <h2
              className="text-foreground-brand mb-4"
              style={{ fontFamily: "var(--font-headline)", fontSize: "20px", fontWeight: 400 }}
            >
              Instructions
            </h2>
            <ol className="space-y-4">
              {instructions.map((step, idx) => (
                <li key={idx} className="flex gap-4">
                  <span className="flex-shrink-0 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-semibold">
                    {idx + 1}
                  </span>
                  <p className="text-foreground pt-0.5">{step}</p>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* CTA */}
        <div className="text-center py-10 border-t border-border">
          <h3
            className="text-foreground-brand mb-2"
            style={{ fontFamily: "var(--font-headline)", fontSize: "24px", fontWeight: 400 }}
          >
            Add this to a meal plan that hits your macros
          </h3>
          <p className="text-foreground-secondary mb-6 max-w-md mx-auto">
            Suppr plans your week from recipes like this one — matched to your calorie and protein targets — then generates your shopping list automatically.
          </p>
          <a
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-full bg-primary text-primary-foreground font-semibold text-lg hover:brightness-95 transition-all"
          >
            Start planning free
          </a>
          <p className="mt-3 text-xs text-foreground-tertiary">No credit card required</p>
        </div>
      </main>
    </div>
  );
}
