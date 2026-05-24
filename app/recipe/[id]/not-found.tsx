import Link from "next/link";

export default function RecipeNotFound() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">🍽️</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2 font-serif">
          Recipe not found
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          This recipe may have been removed or is no longer public. Browse our community for more inspiration.
        </p>
        {/* 2026-05-13 (premium-bar audit Group F web — fix 404 CTA loop):
            old primary CTA pointed at "/" (landing), which dropped the
            user out of the product back to the marketing page — felt
            like a dead end on a typoed link. Now points at the in-app
            Discover feed so the user lands somewhere they can actually
            keep browsing. */}
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/discover"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:shadow-lg hover:shadow-violet-500/25 transition-all"
          >
            Browse recipes
          </Link>
          <Link
            href="/today"
            className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            Back to Today
          </Link>
        </div>
      </div>
    </div>
  );
}
