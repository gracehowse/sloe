import type { ReactNode } from "react";
import "../src/styles/index.css";
import { Providers } from "./providers";

export const metadata = {
  title: "Platemate",
  description: "Creator recipes with verified macros.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

