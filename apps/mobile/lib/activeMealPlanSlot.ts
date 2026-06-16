import AsyncStorage from "@react-native-async-storage/async-storage";

import { DEFAULT_MEAL_PLAN_SLOT_ID } from "@suppr/shared/mealPlan/namedSlots";
import {
  ACTIVE_MEAL_PLAN_SLOT_STORAGE_KEY,
  cloudSlotIdFromLocal,
} from "@suppr/shared/mealPlan/slotCloudSync";

/** Read the active named plan slot and map to cloud `meal_plan_days.slot_id`. */
export async function readActiveCloudMealPlanSlotId(): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(ACTIVE_MEAL_PLAN_SLOT_STORAGE_KEY);
    const local = raw && raw.trim() ? raw.trim() : DEFAULT_MEAL_PLAN_SLOT_ID;
    return cloudSlotIdFromLocal(local);
  } catch {
    return cloudSlotIdFromLocal(DEFAULT_MEAL_PLAN_SLOT_ID);
  }
}
