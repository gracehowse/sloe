import type { Metadata } from "next";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { projectId, publicAnonKey } from "../utils/supabase/info.tsx";
import { HomePageClient } from "./HomePageClient.tsx";
import { LandingPage } from "./(landing)/LandingPage.tsx";

export const metadata: Metadata = {
  title: "Suppr — The recipe and nutrition platform for people who actually cook",
  description:
    "Paste a link from Instagram, TikTok, or any recipe blog — Suppr parses every ingredient against USDA data so you know exactly what's on the plate.",
};

export default async function Page() {
  const cookieStore = await cookies();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || `https://${projectId}.supabase.co`;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || publicAnonKey;

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {
        // no-op — middleware owns cookie writes; this server component only reads.
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return <LandingPage />;
  }

  return <HomePageClient />;
}
