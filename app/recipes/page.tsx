/**
 * /recipes → /home?view=library (server-side 307).
 *
 * Convenience alias. The shipped sidebar primary label is "Recipes"
 * which expands into Library + Discover sub-tabs; `/recipes` lands
 * on Library (the default leaf — same default as the sidebar's
 * `defaultLeaf: "library"` for the Recipes primary).
 *
 * See `app/library/page.tsx` for the audit context (#4 — Web Recipes
 * routes).
 */
import { redirect } from "next/navigation";

export default function RecipesRedirectPage() {
  redirect("/home?view=library");
}
