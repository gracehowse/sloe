import type { ReactNode } from "react";
import { AuthProvider } from "@/context/auth";
import { AnalyticsProvider } from "@/context/AnalyticsProvider";
import { NutritionJournalProvider } from "@/context/nutritionJournal";
import { FontGate } from "@/components/FontGate";
import { ThemeProvider as SupprThemeProvider } from "@/context/theme";

/**
 * ENG-1475 — composed app-root provider stack, extracted out of
 * `app/_layout.tsx` (a pinned only-shrink screen-line-budget file,
 * `scripts/screen-line-budget.json`) so adding `NutritionJournalProvider`
 * (the one shared in-memory nutrition journal both Today and Progress
 * read/write — see `context/nutritionJournal.tsx`) doesn't push that file
 * past its pin. Nesting order is load-bearing:
 * `NutritionJournalProvider` calls `useAuth()`, so it must sit inside
 * `AuthProvider`; it sits ABOVE the tab navigator (`RootLayoutInner` /
 * `(tabs)`) so the journal survives tab switches and is populated even
 * when Progress — not Today — is the first screen the user lands on
 * (e.g. a deep link straight to Progress).
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <NutritionJournalProvider>
        <AnalyticsProvider>
          <FontGate>
            <SupprThemeProvider>{children}</SupprThemeProvider>
          </FontGate>
        </AnalyticsProvider>
      </NutritionJournalProvider>
    </AuthProvider>
  );
}
