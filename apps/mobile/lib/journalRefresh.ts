/**
 * Lightweight pub/sub so off-tab flows (Health Sync → Sync Now) can
 * refresh Today journal without requiring another tab focus cycle.
 * ENG-879 S3.
 */

type JournalRefreshListener = () => void;

const listeners = new Set<JournalRefreshListener>();

export function subscribeJournalRefresh(listener: JournalRefreshListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function requestJournalRefresh(): void {
  for (const listener of listeners) {
    try {
      listener();
    } catch (err) {
      console.warn("[journalRefresh] listener threw:", err);
    }
  }
}
