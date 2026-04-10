"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { AnalyticsProvider } from "../src/app/components/AnalyticsProvider.tsx";
import { AppDataProvider } from "../src/context/AppDataContext.tsx";
import { AuthSessionProvider } from "../src/context/AuthSessionContext.tsx";
import { NotificationProvider } from "../src/context/NotificationContext.tsx";
import { Toaster } from "../src/app/components/ui/sonner.tsx";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AnalyticsProvider>
        <AuthSessionProvider>
          <NotificationProvider>
            <AppDataProvider>
              {children}
              <Toaster richColors position="top-center" />
            </AppDataProvider>
          </NotificationProvider>
        </AuthSessionProvider>
      </AnalyticsProvider>
    </ThemeProvider>
  );
}

