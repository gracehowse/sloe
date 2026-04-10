import Link from "next/link";

export default function RecipeNotFound() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 dark:from-slate-700 dark:to-slate-800 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl">🍽️</span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
          Recipe not found
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-8">
          This recipe may have been removed or is no longer public. Browse our community for more inspiration.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/"
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-semibold hover:shadow-lg hover:shadow-violet-500/25 transition-all"
          >
            Browse Recipes
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-all"
          >
            Sign in
          </Link>
        </div>
      </div>
    </div>
  );
}
