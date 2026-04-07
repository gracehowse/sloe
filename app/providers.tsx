"use client";

import { ThemeProvider } from "next-themes";
import type { ReactNode } from "react";
import { AppDataProvider } from "../src/context/AppDataContext.tsx";
import { Toaster } from "../src/app/components/ui/sonner.tsx";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <AppDataProvider>
        {children}
        <Toaster richColors position="top-center" />
      </AppDataProvider>
    </ThemeProvider>
  );
}

