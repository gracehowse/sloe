/**
 * /help — Linear-style help surface.
 *
 * 2026-05-12 (premium-bar audit Group A Feature 5): rebuilt from a
 * single long-form doc into a structured help page with:
 *
 *   - Search input pinned at the top (client-side filter over
 *     section bodies, no network).
 *   - Sticky ToC sidebar on desktop ≥ lg (1024px+).
 *   - Mobile-web: accordion sections (collapsed by default so the
 *     full doc isn't a wall of text on phone).
 *   - Sticky "Contact support" CTA in the bottom-right.
 *   - Renamed "Help & Information" → "Help".
 *
 * Section bodies stay the canonical methodology copy — they were
 * already factually correct + legal-reviewed. The pre-fix version
 * dumped them as one continuous prose article; the rebuild keeps
 * the content and improves the discovery / scanability layer.
 *
 * Server-rendered shell + client island for the search/accordion
 * state. Methodology copy lives inline so the page can be statically
 * generated (no /api/help endpoint to babysit).
 */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, Search } from "lucide-react";

const DEFAULT_EMAIL = "privacy@getsloe.com";

type Section = {
  id: string;
  title: string;
  /** Lower-case plain text body used by the search filter — keep it
   *  in sync with the JSX body below. */
  searchBlob: string;
  body: React.ReactNode;
};

function buildSections(email: string): Section[] {
  return [
    {
      id: "methodology",
      title: "How we calculate nutrition",
      searchBlob:
        "nutrition calculate parse ingredient match confidence usda foodfacts fatsecret matching aggregate macros",
      body: (
        <>
          <p>When you import a recipe, Sloe parses every ingredient and matches it against multiple food databases:</p>
          <ol className="list-decimal pl-5 space-y-2 mt-3">
            <li><strong>Ingredient parsing</strong> &mdash; each line is broken into name, quantity, and unit. Count-based items (e.g. &ldquo;2 eggs&rdquo;) are converted to gram weights using our staples database of 176+ common foods.</li>
            <li><strong>Database matching</strong> &mdash; each ingredient is searched against USDA FoodData Central, Open Food Facts, and FatSecret. The best match by name similarity and portion plausibility is selected.</li>
            <li><strong>Confidence scoring</strong> &mdash; each ingredient receives a score (0&ndash;100%). High means the match closely aligns with a verified database entry. Low means it fell back to a local estimate. Tap any ingredient on a recipe to see its score and source.</li>
            <li><strong>Aggregation</strong> &mdash; per-ingredient macros are summed and divided by servings to produce per-serving totals.</li>
          </ol>
        </>
      ),
    },
    {
      id: "importing-recipes",
      title: "How recipe import works",
      searchBlob:
        "import recipe personal copy cookbook private default facts ingredients steps link back source bot supprbot identified honest",
      body: (
        <>
          <p>
            When you import a recipe, Sloe makes a personal copy in your own cookbook &mdash; like saving to your notes
            or printing for your kitchen. Imports are always started by you, never automatic, and are private by
            default. We capture the facts (ingredients, steps, times, our nutrition estimates) and link back to the
            original; we don&rsquo;t copy the original article&rsquo;s writing or photos, and we don&rsquo;t
            bulk-collect recipes.
          </p>
          <p className="mt-3">
            When we read a public web page, we identify ourselves honestly as Sloe&rsquo;s importer &mdash; an
            identified, rate-limited fetcher (<code className="text-xs bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">SupprBot</code>)
            that links to a{" "}
            <Link href="/bot" className="text-primary-solid underline">public bot page</Link>, respects access
            controls, and takes only the facts. See the{" "}
            <Link href="/terms" className="text-primary-solid underline">Terms of service</Link>{" "}
            for the full posture.
          </p>
        </>
      ),
    },
    {
      id: "sources",
      title: "Nutrition data sources",
      searchBlob:
        "usda fooddata central edamam open food facts fatsecret odbl public domain local staples ingredient database",
      body: (
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>USDA FoodData Central</strong> &mdash; lab-tested nutritional data for thousands of whole foods, maintained by the U.S. Department of Agriculture. Includes Foundation, SR Legacy, and Survey (FNDDS) datasets. FDC data is in the public domain; USDA does not endorse Sloe.</li>
          <li><strong>Edamam</strong> &mdash; restaurant and branded-food nutrition data. Food search results that come from Edamam are <em>Powered by Edamam</em> under Edamam&rsquo;s API terms.</li>
          <li><strong>Open Food Facts</strong> &mdash; volunteer-maintained, open database of food products with strong UK, EU, US, and Australian coverage. Product data is &copy; Open Food Facts contributors and made available under the <a href="https://opendatacommons.org/licenses/odbl/1-0/" className="text-primary-solid underline" rel="noopener noreferrer" target="_blank">Open Database License (ODbL)</a>.</li>
          <li><strong>FatSecret Platform API</strong> &mdash; curated food database with detailed branded and generic food entries including serving size information.</li>
          <li><strong>Local staples database</strong> &mdash; 176+ common cooking ingredients with per-100g macros and density values for cup/volume conversions. Used as a fallback when no external match is found.</li>
        </ul>
      ),
    },
    {
      id: "tdee",
      title: "Calorie targets & TDEE",
      searchBlob:
        "calorie target tdee mifflin st jeor bmr activity factor sedentary light moderate active very deficit surplus",
      body: (
        <>
          <p>Your daily calorie target is calculated using the <strong>Mifflin-St Jeor equation</strong>, which estimates Basal Metabolic Rate (BMR) from age, sex, height, and weight. This is multiplied by an activity factor:</p>
          <ul className="list-disc pl-5 space-y-1 mt-3">
            <li>Sedentary: BMR &times; 1.2</li>
            <li>Light (1&ndash;3 days/week): BMR &times; 1.375</li>
            <li>Moderate (3&ndash;5 days/week): BMR &times; 1.55</li>
            <li>Active (6&ndash;7 days/week): BMR &times; 1.725</li>
            <li>Very active: BMR &times; 1.9</li>
          </ul>
          <p className="mt-3">A deficit or surplus is applied based on your goal and pace. For weight loss, this ranges from 250&ndash;1,100 kcal/day below TDEE.</p>
        </>
      ),
    },
    {
      id: "activity",
      title: "Activity-adjusted calories",
      searchBlob:
        "activity adjusted calorie bonus apple health resting active double count tdee",
      body: (
        <p>When enabled in Settings, Sloe adds <strong>bonus calories</strong> only when your actual total burn (resting + active from Apple Health) exceeds your estimated maintenance TDEE. This prevents double-counting &mdash; your target already includes an activity estimate, so only the surplus above that is added.</p>
      ),
    },
    {
      id: "adaptive",
      title: "Adaptive TDEE",
      searchBlob: "adaptive tdee intake weight changes accuracy",
      body: (
        <p>After 7+ days of food logging and 3+ weight entries, Sloe computes an <strong>adaptive TDEE</strong> derived from your actual intake and weight changes. This replaces the formula estimate and improves accuracy over time.</p>
      ),
    },
    {
      id: "health",
      title: "Apple Health integration",
      searchBlob:
        "apple health steps active energy resting workouts weight body fat dietary writes reads",
      body: (
        <>
          <p>Sloe reads and writes the following data from Apple Health (with your permission):</p>
          <ul className="list-disc pl-5 space-y-1 mt-3">
            <li><strong>Reads:</strong> steps, active energy, resting energy, workouts, weight, body fat percentage</li>
            <li><strong>Writes:</strong> dietary energy consumed (so other apps can see your logged intake)</li>
          </ul>
        </>
      ),
    },
    {
      id: "disclaimers",
      title: "Important disclaimers",
      searchBlob:
        "disclaimer medical advice accuracy weight projection minimum intake third party ai photo voice",
      body: (
        <ul className="list-disc pl-5 space-y-2">
          <li><strong>Not medical advice.</strong> Sloe is a personal tracking tool, not a medical device. Always consult a healthcare professional before making significant dietary changes.</li>
          <li><strong>Nutrition accuracy.</strong> Values are estimates. Actual values vary by preparation method, brand, portion size, and ingredient variability. Confidence scores indicate match quality, not absolute accuracy.</li>
          <li><strong>Weight projections.</strong> Based on 7,700 kcal per kg of body weight. Actual results vary based on metabolism, water retention, muscle mass, and other factors.</li>
          <li><strong>Minimum intake.</strong> Very low calorie diets (&lt;1,200 kcal for women, &lt;1,500 kcal for men) should only be followed under medical supervision. Sloe does not enforce minimums.</li>
          <li><strong>Third-party data.</strong> Imported recipes extract data from external sites. We are not responsible for source recipe accuracy.</li>
          <li><strong>AI features.</strong> Photo and voice logging use third-party AI models (e.g. OpenAI). Results are estimates and should be reviewed before saving.</li>
        </ul>
      ),
    },
    {
      id: "contact",
      title: "Contact & support",
      searchBlob: `contact support email feedback questions ${email}`,
      body: (
        <p>
          For questions, feedback, or support:{" "}
          <a href={`mailto:${email}`} className="text-primary-solid underline">{email}</a>
        </p>
      ),
    },
  ];
}

export default function HelpClient() {
  const email = process.env.NEXT_PUBLIC_PRIVACY_EMAIL?.trim() || DEFAULT_EMAIL;
  const sections = useMemo(() => buildSections(email), [email]);
  const [query, setQuery] = useState("");
  const [openMobile, setOpenMobile] = useState<Set<string>>(new Set(["methodology"]));

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sections;
    return sections.filter(
      (s) => s.title.toLowerCase().includes(q) || s.searchBlob.includes(q),
    );
  }, [query, sections]);

  function toggleMobile(id: string) {
    setOpenMobile((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <div className="max-w-5xl mx-auto px-6 py-12">
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
          <Link href="/" className="text-primary-solid hover:underline">
            &larr; Back to app
          </Link>
        </p>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-3">Help</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
          How Sloe works, nutrition methodology, data sources, and disclaimers.
        </p>

        {/* Search */}
        <div className="relative mb-8 max-w-xl">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500"
            aria-hidden
          />
          <input
            type="search"
            placeholder="Search help…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-primary"
            data-testid="help-search-input"
            aria-label="Search help"
          />
        </div>

        <div className="lg:grid lg:grid-cols-[200px_1fr] lg:gap-10">
          {/* Sticky ToC sidebar — desktop ≥ lg only. */}
          <nav
            className="hidden lg:block sticky top-12 self-start"
            aria-label="Help sections"
          >
            <ul className="space-y-2 text-sm">
              {filtered.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-slate-600 dark:text-slate-300 hover:text-primary-solid transition-colors"
                  >
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Main column */}
          <div className="space-y-6 lg:space-y-8 text-sm text-slate-700 dark:text-slate-300">
            {filtered.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400">
                No sections match &ldquo;{query}&rdquo;. Try a different search term.
              </p>
            ) : (
              filtered.map((s) => {
                const isOpen = openMobile.has(s.id);
                return (
                  <section
                    key={s.id}
                    id={s.id}
                    className="scroll-mt-16 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden"
                    data-testid={`help-section-${s.id}`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleMobile(s.id)}
                      className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left lg:cursor-default"
                      aria-expanded={isOpen}
                    >
                      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                        {s.title}
                      </h2>
                      <ChevronDown
                        className={`lg:hidden w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                        aria-hidden
                      />
                    </button>
                    {/* Body: collapsed by default on mobile (accordion);
                        always visible on desktop ≥ lg. */}
                    <div className={`px-5 pb-5 ${isOpen ? "block" : "hidden"} lg:block`}>
                      {s.body}
                    </div>
                  </section>
                );
              })
            )}

            <p className="text-xs text-slate-500 dark:text-slate-400 pt-2">
              See also:{" "}
              <Link href="/privacy" className="text-primary-solid underline">Privacy Policy</Link>
              {" "}&middot;{" "}
              <Link href="/terms" className="text-primary-solid underline">Terms of Service</Link>
              {" "}&middot;{" "}
              <Link href="/roadmap" className="text-primary-solid underline">Roadmap</Link>
            </p>
          </div>
        </div>
      </div>

      {/* Sticky Contact support CTA — bottom-right pill. Always
          visible so users can reach out without scrolling back up. */}
      <a
        href={`mailto:${email}`}
        className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 rounded-full bg-primary text-primary-foreground hover:brightness-95 text-sm font-semibold px-4 py-2.5 shadow-lg shadow-primary/30"
        data-testid="help-sticky-contact"
      >
        Contact support
      </a>
    </div>
  );
}
