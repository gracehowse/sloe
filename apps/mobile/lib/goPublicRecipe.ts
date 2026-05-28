import { Alert } from "react-native";

import {
  GO_PUBLIC_ALERT_MESSAGE,
  GO_PUBLIC_ALERT_TITLE,
  UNPUBLISH_ALERT_MESSAGE,
  UNPUBLISH_ALERT_TITLE,
  updateRecipePublishedStatus,
} from "@suppr/shared/recipes/goPublic";
import { supabase } from "@/lib/supabase";

export function promptGoPublicAttestation(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(GO_PUBLIC_ALERT_TITLE, GO_PUBLIC_ALERT_MESSAGE, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Publish", onPress: () => resolve(true) },
    ]);
  });
}

export function promptUnpublishConfirmation(): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(UNPUBLISH_ALERT_TITLE, UNPUBLISH_ALERT_MESSAGE, [
      { text: "Cancel", style: "cancel", onPress: () => resolve(false) },
      { text: "Unpublish", style: "destructive", onPress: () => resolve(true) },
    ]);
  });
}

export type SetRecipePublishedResult =
  | { ok: true; published: boolean }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string };

/** Attestation prompt + Supabase `recipes.published` update (owner-only). */
export async function setRecipePublishedWithPrompt(params: {
  recipeId: string;
  authorId: string;
  published: boolean;
}): Promise<SetRecipePublishedResult> {
  const proceed = params.published
    ? await promptGoPublicAttestation()
    : await promptUnpublishConfirmation();
  if (!proceed) return { ok: false, cancelled: true };

  const result = await updateRecipePublishedStatus(supabase, {
    recipeId: params.recipeId,
    authorId: params.authorId,
    published: params.published,
  });
  if (!result.ok) return { ok: false, cancelled: false, message: result.message };
  return { ok: true, published: params.published };
}
