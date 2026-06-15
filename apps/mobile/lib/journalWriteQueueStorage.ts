import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  JOURNAL_WRITE_QUEUE_STORAGE_KEY,
  parseJournalWriteQueue,
  type JournalWriteQueue,
} from "@suppr/shared/nutrition/journalWriteQueue";

export async function loadJournalWriteQueue(): Promise<JournalWriteQueue> {
  try {
    const raw = await AsyncStorage.getItem(JOURNAL_WRITE_QUEUE_STORAGE_KEY);
    if (!raw) return parseJournalWriteQueue(null);
    return parseJournalWriteQueue(JSON.parse(raw));
  } catch {
    return parseJournalWriteQueue(null);
  }
}

export async function saveJournalWriteQueue(queue: JournalWriteQueue): Promise<void> {
  try {
    await AsyncStorage.setItem(JOURNAL_WRITE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch {
    /* best-effort */
  }
}
