/**
 * goPublic — shared publish / unpublish logic for recipe surfaces (ENG-700).
 *
 * Web `GoPublicDialog` and mobile Alert attestation flows import these
 * strings and the Supabase update helper so copy and persistence stay aligned.
 */

/** Mobile Alert + create-recipe publish attestation (short form). */
export const GO_PUBLIC_ALERT_TITLE = "Publish to community?";
export const GO_PUBLIC_ALERT_MESSAGE =
  "I created this recipe and I have the right to share it publicly. Publishing makes it visible in Discover.";

/** Web `GoPublicDialog` title + body (recipe title interpolated). */
export const GO_PUBLIC_DIALOG_TITLE = "Publish this recipe?";

export function goPublicDialogDescription(recipeTitle: string): string {
  return `Publishing makes ${recipeTitle} visible to others. Only publish recipes you created and have the right to share.`;
}

export const GO_PUBLIC_ATTESTATION_LABEL =
  "I created this recipe and I have the right to share it publicly.";

export const UNPUBLISH_ALERT_TITLE = "Unpublish this recipe?";
export const UNPUBLISH_ALERT_MESSAGE =
  "This removes it from public discovery. It will stay in your library as a private draft.";

export type RecipePublishSupabaseClient = {
  from: (table: string) => {
    update: (payload: { published: boolean }) => {
      eq: (column: string, value: string) => {
        eq: (
          column: string,
          value: string,
        ) => PromiseLike<{ error: { message: string } | null }>;
      };
    };
  };
};

export async function updateRecipePublishedStatus(
  supabase: RecipePublishSupabaseClient,
  params: { recipeId: string; authorId: string; published: boolean },
): Promise<{ ok: true } | { ok: false; message: string }> {
  const { error } = await supabase
    .from("recipes")
    .update({ published: params.published })
    .eq("id", params.recipeId)
    .eq("author_id", params.authorId);

  if (error) return { ok: false, message: error.message };
  return { ok: true };
}
