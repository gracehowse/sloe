import {
  JOURNAL_WRITE_QUEUE_STORAGE_KEY,
  parseJournalWriteQueue,
  type JournalWriteQueue,
} from "./journalWriteQueue";

export async function loadJournalWriteQueue(): Promise<JournalWriteQueue> {
  if (typeof window === "undefined") return parseJournalWriteQueue(null);
  try {
    const raw = window.localStorage.getItem(JOURNAL_WRITE_QUEUE_STORAGE_KEY);
    if (!raw) return parseJournalWriteQueue(null);
    return parseJournalWriteQueue(JSON.parse(raw));
  } catch {
    return parseJournalWriteQueue(null);
  }
}

export async function saveJournalWriteQueue(queue: JournalWriteQueue): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(JOURNAL_WRITE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* best-effort */
  }
}
