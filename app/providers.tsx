"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { AnalyticsProvider } from "../src/app/components/AnalyticsProvider.tsx";
import { AppDataProvider } from "../src/context/AppDataContext.tsx";
import { AuthSessionProvider } from "../src/context/AuthSessionContext.tsx";
import { NotificationProvider } from "../src/context/NotificationContext.tsx";
import { HouseholdProvider } from "../src/context/HouseholdContext.tsx";
import { Toaster } from "../src/app/components/ui/sonner.tsx";
import { CookieConsent } from "../src/app/components/CookieConsent.tsx";
import { ServiceWorkerRegistration } from "../src/app/components/ServiceWorkerRegistration.tsx";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AnalyticsProvider>
        <AuthSessionProvider>
          <NotificationProvider>
            <HouseholdProvider>
              <AppDataProvider>
                {children}
                <Toaster richColors position="top-center" />
                <CookieConsent />
                <ServiceWorkerRegistration />
              </AppDataProvider>
            </HouseholdProvider>
          </NotificationProvider>
        </AuthSessionProvider>
      </AnalyticsProvider>
    </ThemeProvider>
  );
}

