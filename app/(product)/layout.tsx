/**
 * Shared shell for in-app routes — mounts HomePageClient once so
 * `/today` ↔ `/discover` tab changes do not remount auth + profile gates.
 */
import { HomePageClient } from "../HomePageClient";

export default function ProductShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <HomePageClient />
      {children}
    </>
  );
}
