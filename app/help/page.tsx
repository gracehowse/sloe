import Link from "next/link";

export default function HelpPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          <Link href="/" className="text-violet-600 dark:text-violet-400 hover:underline">
            ← Back to app
          </Link>
        </p>

        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6">Help</h1>

        <div className="prose prose-slate dark:prose-invert prose-sm max-w-none space-y-4 text-slate-700 dark:text-slate-300">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Activity-adjusted calories</h2>
          <p>
            If you turn on activity adjustment in the Nutrition tracker, your daily calorie target can move with your
            activity for that day.
          </p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Intermittent fasting timer</h2>
          <p>
            The fasting timer (start and end fasts, window presets, synced history) lives in the{" "}
            <strong>Suppr mobile app</strong> under More → Fasting. This website does not include that screen yet; your
            progress still syncs to your account if you use mobile.
          </p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Data quality</h2>
          <p>
            We aim to keep food and recipe info consistent and easy to trust. If you ever notice something off, treat it
            as an estimate and adjust your portion or entry as needed.
          </p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Pricing</h2>
          <p>Features may change as we finalize pricing and plan options.</p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">What’s coming (high level)</h2>
          <p>
            We’re focused on making logging fast and planning feel effortless. Some larger features may appear later as
            we improve the core experience.
          </p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">How recipe and food matches work</h2>
          <p>
            When you import a recipe or pick a food, we try sources in order (USDA FoodData Central, then Open Food Facts,
            then FatSecret when configured). Each match must clear a minimum confidence score; we also skip matches when
            preparation wording clearly disagrees (for example grilled vs raw-only database rows) or when scaled macros
            look implausible. If none qualify, we fall back to a conservative estimate from ingredient text. You can
            override matches when editing or verifying a recipe in the app.
          </p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Nutrition data sources</h2>
          <p>
            Suppr combines multiple trusted databases to provide accurate nutrition information worldwide:
          </p>
          <ul>
            <li>
              <strong><a href="https://fdc.nal.usda.gov" target="_blank" rel="noopener">USDA FoodData Central</a></strong> — Laboratory-tested nutrition data for thousands of whole foods, maintained by the U.S. Department of Agriculture. Includes Foundation, SR Legacy, and Survey datasets.
            </li>
            <li>
              <strong><a href="https://world.openfoodfacts.org" target="_blank" rel="noopener">Open Food Facts</a></strong> — A free, open-source database of food products from around the world. Strong coverage across the UK, EU, US, and Australia.
            </li>
            <li>
              <strong><a href="https://platform.fatsecret.com" target="_blank" rel="noopener">FatSecret Platform API</a></strong> — A comprehensive food and nutrition database with detailed serving-size information for branded and generic foods.
            </li>
          </ul>
          <p>
            Nutrition values are estimates and may vary by brand, preparation method, and portion size. Always refer to product packaging for the most accurate information. You can verify and correct individual ingredients on any recipe.
          </p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2">Sponsored content</h2>
          <p>If something is sponsored or affiliate, it will be clearly disclosed.</p>

          <hr />

          <p>
            Looking for legal details? See the <Link href="/privacy">privacy policy</Link> and{" "}
            <Link href="/terms">terms of service</Link>.
          </p>
        </div>
      </div>
    </div>
  );
}

