/**
 * /recipes → /library (server-side 307).
 *
 * The sidebar "Recipes" primary tab's default leaf is Library. A user
 * who types `/recipes` lands on the Library view by convention.
 * Keeping this as a redirect (rather than a HomePageClient mount)
 * means there's exactly one canonical path per view — `/library` is
 * the canonical leaf, `/recipes` is a friendly alias.
 */
import { redirect } from "next/navigation";

export default function RecipesRedirectPage() {
  redirect("/library");
}
