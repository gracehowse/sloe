"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { AnalyticsProvider } from "../src/app/components/AnalyticsProvider.tsx";
import { FrostFlagToggle } from "../src/app/components/FrostFlagToggle.tsx";
import { AppDataProvider } from "../src/context/AppDataContext.tsx";
import { AuthSessionProvider } from "../src/context/AuthSessionContext.tsx";
import { NotificationProvider } from "../src/context/NotificationContext.tsx";
import { Toaster } from "../src/app/components/ui/sonner.tsx";
import { CookieConsent } from "../src/app/components/CookieConsent.tsx";
import { ServiceWorkerRegistration } from "../src/app/components/ServiceWorkerRegistration.tsx";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AnalyticsProvider>
        {/* Frost secondary-colour exploration — toggles `flag-frost` on <html>
            once flags resolve. Covers app + marketing. Inert when the flag is
            off (the default). */}
        <FrostFlagToggle />
        <AuthSessionProvider>
          <NotificationProvider>
            <AppDataProvider>
              {children}
              <Toaster richColors position="top-center" />
              <CookieConsent />
              <ServiceWorkerRegistration />
            </AppDataProvider>
          </NotificationProvider>
        </AuthSessionProvider>
      </AnalyticsProvider>
    </ThemeProvider>
  );
}

