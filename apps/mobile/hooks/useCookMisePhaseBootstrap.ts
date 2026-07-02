import { useEffect } from "react";

/** ENG-946 — optional mise-en-place before steps when checklist flag is on. */
export function useCookMisePhaseBootstrap(
  recipeId: string | undefined,
  checklistEnabled: boolean,
  checklistCount: number,
  setCookPhase: (phase: "mise" | "steps") => void,
): void {
  useEffect(() => {
    if (checklistEnabled && checklistCount > 0) {
      setCookPhase("mise");
    } else {
      setCookPhase("steps");
    }
  }, [recipeId, checklistEnabled, checklistCount, setCookPhase]);
}
