import type { Metadata } from "next";

import { ReferralLandingClient } from "./ReferralLandingClient";

export const metadata: Metadata = {
  title: "Sloe invite",
  robots: { index: false, follow: false },
};

export default async function ReferralLandingPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  return <ReferralLandingClient code={code} />;
}
