import * as React from "react";
import { MobileStoryThemeProvider } from "@suppr/storybook-stubs/mobile-theme";
import { OnboardingProvider } from "./context";
import type { OnboardingState } from "@/lib/onboarding";

export function OnboardingStoryFrame({
  children,
  initial,
}: {
  children: React.ReactNode;
  initial?: Partial<OnboardingState>;
}) {
  return (
    <MobileStoryThemeProvider>
      <OnboardingProvider initial={initial ?? {}}>
        <div style={{ width: 360, minHeight: 640, background: "#F7F6FA" }}>
          {children}
        </div>
      </OnboardingProvider>
    </MobileStoryThemeProvider>
  );
}
