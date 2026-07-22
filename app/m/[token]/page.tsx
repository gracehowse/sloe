import type { Metadata } from "next";

import { MealShareLandingClient } from "./MealShareLandingClient";

export const metadata: Metadata = {
  title: "Shared meal — Sloe",
  robots: { index: false, follow: false },
};

export default async function MealShareLandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <MealShareLandingClient token={token} />;
}
