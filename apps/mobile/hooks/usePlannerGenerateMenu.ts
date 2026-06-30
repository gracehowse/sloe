import { useCallback } from "react";
import { Alert, ActionSheetIOS, Platform } from "react-native";

import type { ResetPlanMode } from "@suppr/shared/planning/resetPlanSheet";

interface UsePlannerGenerateMenuArgs {
  generating: boolean;
  planImportEnabled: boolean;
  requestLibraryGenerate: () => void;
  openPlanImport: () => void;
}

/** Plan tab generate menu + direct library generate entry (ENG-742 / ENG-1261). */
export function usePlannerGenerateMenu({
  generating,
  planImportEnabled,
  requestLibraryGenerate,
  openPlanImport,
}: UsePlannerGenerateMenuArgs) {
  const openGenerateMenu = useCallback(() => {
    if (generating) return;
    if (!planImportEnabled) {
      requestLibraryGenerate();
      return;
    }
    const labels = ["Generate from library", "Import existing plan", "Cancel"] as const;
    const runLibrary = () => {
      requestLibraryGenerate();
    };
    if (Platform.OS === "ios") {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          title: "Generate",
          options: [...labels],
          cancelButtonIndex: 2,
        },
        (idx) => {
          if (idx === 0) runLibrary();
          else if (idx === 1) openPlanImport();
        },
      );
      return;
    }
    Alert.alert("Generate", undefined, [
      { text: "Generate from library", onPress: runLibrary },
      { text: "Import existing plan", onPress: openPlanImport },
      { text: "Cancel", style: "cancel" },
    ]);
  }, [generating, planImportEnabled, requestLibraryGenerate, openPlanImport]);

  return openGenerateMenu;
}

export type { ResetPlanMode };
