import { STORAGE_KEY } from "@/context/appData/persistence";

const EXTRA_KEYS = [
  "platemate-profile-v2",
  "platemate-collections-v1",
  "platemate-recent-foods-v1",
] as const;

export function buildLocalDataExport(): Record<string, unknown> {
  const out: Record<string, unknown> = {
    exportedAt: new Date().toISOString(),
    exportVersion: 1,
    app: "Platemate",
  };
  const keys = [STORAGE_KEY, ...EXTRA_KEYS];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      try {
        out[k] = JSON.parse(raw) as unknown;
      } catch {
        out[k] = raw;
      }
    } catch {
      /* ignore */
    }
  }
  return out;
}

export function downloadJsonFile(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
