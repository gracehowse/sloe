/**
 * ENG-1648 — deep-link helper for opening Settings → "My shared links".
 * Mobile uses AsyncStorage; web uses URL navigation (see shareMealAction).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import { MEAL_SHARED_LINKS_OPEN_FLAG } from "@suppr/shared/share/mealSharedLinks";

/** Stash a one-shot flag so Settings expands meal shared links on next open. */
export async function requestOpenMealSharedLinksManager(): Promise<void> {
  try {
    await AsyncStorage.setItem(MEAL_SHARED_LINKS_OPEN_FLAG, "1");
  } catch {
    /* non-fatal — user can still open Settings manually */
  }
}

/** Read + clear the one-shot open flag (at-most-once). */
export async function consumeOpenMealSharedLinksManager(): Promise<boolean> {
  try {
    const value = await AsyncStorage.getItem(MEAL_SHARED_LINKS_OPEN_FLAG);
    if (value !== "1") return false;
    await AsyncStorage.removeItem(MEAL_SHARED_LINKS_OPEN_FLAG);
    return true;
  } catch {
    return false;
  }
}
