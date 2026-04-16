import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Help & Information — Suppr",
  description: "How Suppr works, nutrition methodology, data sources, and disclaimers.",
};

const DEFAULT_EMAIL = "privacy@suppr-club.com";

export default function HelpPage() {
  const email = process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim() || DEFAULT_EMAIL;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-2xl mx-auto px-6 py-12">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          <Link href="/" className="text-violet-600 dark:text-violet-400 hover:underline">
            &larr; Back to app
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-8">Help &amp; Information</h1>

        <div className="prose prose-slate dark:prose-invert prose-sm max-w-none space-y-6 text-slate-700 dark:text-slate-300">

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2" id="methodology">How we calculate nutrition</h2>
          <p>When you import a recipe, Suppr parses every ingredient and matches it against multiple food databases:</p>
          <ol className="list-decimal pl-5 space-y-2">
            <li><strong>Ingredient parsing</strong> &mdash; each line is broken into name, quantity, and unit. Count-based items (e.g. &ldquo;2 eggs&rdquo;) are converted to gram weights using our staples database of 176+ common foods.</li>
            <li><strong>Database matching</strong> &mdash; each ingredient is searched against USDA FoodData Central, Open Food Facts, and FatSecret. The best match by name similarity and portion plausibility is selected.</li>
            <li><strong>Confidence scoring</strong> &mdash; each ingredient receives a score (0&ndash;100%). High means the match closely aligns with a verified database entry. Low means it fell back to a local estimate. Tap any ingredient on a recipe to see its score and source.</li>
            <li><strong>Aggregation</strong> &mdash; per-ingredient macros are summed and divided by servings to produce per-serving totals.</li>
          </ol>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2" id="sources">Nutrition data sources</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>USDA FoodData Central</strong> &mdash; lab-tested nutritional data for thousands of whole foods, maintained by the U.S. Department of Agriculture. Includes Foundation, SR Legacy, and Survey (FNDDS) datasets.</li>
            <li><strong>Open Food Facts</strong> &mdash; volunteer-maintained, open database of food products with strong UK, EU, US, and Australian coverage. Data comes from product labels.</li>
            <li><strong>FatSecret Platform API</strong> &mdash; curated food database with detailed branded and generic food entries including serving size information.</li>
            <li><strong>Local staples database</strong> &mdash; 176+ common cooking ingredients with per-100g macros and density values for cup/volume conversions. Used as a fallback when no external match is found.</li>
          </ul>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2" id="tdee">Calorie targets &amp; TDEE</h2>
          <p>Your daily calorie target is calculated using the <strong>Mifflin-St Jeor equation</strong>, which estimates Basal Metabolic Rate (BMR) from age, sex, height, and weight. This is multiplied by an activity factor:</p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Sedentary: BMR &times; 1.2</li>
            <li>Light (1&ndash;3 days/week): BMR &times; 1.375</li>
            <li>Moderate (3&ndash;5 days/week): BMR &times; 1.55</li>
            <li>Active (6&ndash;7 days/week): BMR &times; 1.725</li>
            <li>Very active: BMR &times; 1.9</li>
          </ul>
          <p>A deficit or surplus is applied based on your goal and pace. For weight loss, this ranges from 250&ndash;1,100 kcal/day below TDEE.</p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2" id="activity">Activity-adjusted calories</h2>
          <p>When enabled in Settings, Suppr adds <strong>bonus calories</strong> only when your actual total burn (resting + active from Apple Health) exceeds your estimated maintenance TDEE. This prevents double-counting &mdash; your target already includes an activity estimate, so only the surplus above that is added.</p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2" id="adaptive">Adaptive TDEE</h2>
          <p>After 7+ days of food logging and 3+ weight entries, Suppr computes an <strong>adaptive TDEE</strong> derived from your actual intake and weight changes. This replaces the formula estimate and improves accuracy over time.</p>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2" id="health">Apple Health integration</h2>
          <p>Suppr reads and writes the following data from Apple Health (with your permission):</p>
          <ul className="list-disc pl-5 space-y-1">
            <li><strong>Reads:</strong> steps, active energy, resting energy, workouts, weight, body fat percentage</li>
            <li><strong>Writes:</strong> dietary energy consumed (so other apps can see your logged intake)</li>
          </ul>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2" id="disclaimers">Important disclaimers</h2>
          <ul className="list-disc pl-5 space-y-2">
            <li><strong>Not medical advice.</strong> Suppr is a personal tracking tool, not a medical device. Always consult a healthcare professional before making significant dietary changes.</li>
            <li><strong>Nutrition accuracy.</strong> Values are estimates. Actual values vary by preparation method, brand, portion size, and ingredient variability. Confidence scores indicate match quality, not absolute accuracy.</li>
            <li><strong>Weight projections.</strong> Based on 7,700 kcal per kg of body weight. Actual results vary based on metabolism, water retention, muscle mass, and other factors.</li>
            <li><strong>Minimum intake.</strong> Very low calorie diets (&lt;1,200 kcal for women, &lt;1,500 kcal for men) should only be followed under medical supervision. Suppr does not enforce minimums.</li>
            <li><strong>Third-party data.</strong> Imported recipes extract data from external sites. We are not responsible for source recipe accuracy.</li>
            <li><strong>AI features.</strong> Photo and voice logging use third-party AI models (e.g. OpenAI). Results are estimates and should be reviewed before saving.</li>
          </ul>

          <h2 className="text-lg font-semibold text-slate-900 dark:text-white pt-2" id="contact">Contact &amp; support</h2>
          <p>
            For questions, feedback, or support:{" "}
            <a href={`mailto:${email}`} className="text-violet-600 dark:text-violet-400 underline">{email}</a>
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            See also:{" "}
            <Link href="/privacy" className="text-violet-600 dark:text-violet-400 underline">Privacy Policy</Link>
            {" "}&middot;{" "}
            <Link href="/terms" className="text-violet-600 dark:text-violet-400 underline">Terms of Service</Link>
            {" "}&middot;{" "}
            <Link href="/roadmap" className="text-violet-600 dark:text-violet-400 underline">Roadmap</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
