"use client";

import App from "../src/app/App.tsx";
import { useEffect, useState } from "react";
import { supabase } from "../src/lib/supabase/browserClient.ts";

export default function Page() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) {
        return;
      }
      setAuthed(Boolean(data.session?.user));
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session?.user));
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!ready) {
    return (
      <div className="min-h-screen grid place-items-center text-slate-600 dark:text-slate-300">
        Loading…
      </div>
    );
  }

  if (!authed) {
    // lightweight gate for now (Phase 0). We'll add public marketing pages later.
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    return null;
  }

  return <App />;
}

