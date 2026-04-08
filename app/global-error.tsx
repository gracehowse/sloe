"use client";

import { useEffect } from "react";
import { Button } from "@/app/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error("Global error boundary", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen grid place-items-center px-6 py-12 bg-slate-50 dark:bg-slate-950">
          <div className="w-full max-w-md rounded-2xl border border-slate-200/60 dark:border-slate-800/60 bg-white/70 dark:bg-slate-900/40 p-6 shadow-lg">
            <h1 className="text-slate-900 dark:text-white mb-2">App error</h1>
            <p className="text-sm text-slate-600 dark:text-slate-300 mb-6">
              The app crashed unexpectedly. You can try reloading now.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => reset()}>
                Reload
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}

