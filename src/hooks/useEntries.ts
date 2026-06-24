import { useCallback, useEffect, useState } from "react";
import type { Entry, LocationId } from "../types/entry";
import {
  clockIn,
  clockOut,
  createEntry,
  deleteEntry,
  loadEntries,
  updateEntry,
  EntryValidationError,
} from "../lib/entries";

export function useEntries() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const list = await loadEntries();
    setEntries(list);
    return list;
  }, []);

  useEffect(() => {
    refresh()
      .then(() => setReady(true))
      .catch((e) => {
        setError(e instanceof Error ? e.message : "Failed to load entries");
        setReady(true);
      });
  }, [refresh]);

  const handleClockIn = async (location: LocationId) => {
    setError(null);
    try {
      const entry = await clockIn(location);
      setEntries((prev) => [...prev, entry]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clock in failed");
      throw e;
    }
  };

  const handleClockOut = async (id: string) => {
    setError(null);
    try {
      const entry = await clockOut(id);
      setEntries((prev) => prev.map((e) => (e.id === id ? entry : e)));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Clock out failed");
      throw e;
    }
  };

  const handleSave = async (entry: Entry, isNew: boolean) => {
    setError(null);
    try {
      const saved = isNew
        ? await createEntry({
            start: entry.start,
            end: entry.end,
            location: entry.location,
            note: entry.note,
          })
        : await updateEntry(entry);
      setEntries((prev) => {
        if (isNew) return [...prev, saved];
        return prev.map((e) => (e.id === saved.id ? saved : e));
      });
      return saved;
    } catch (e) {
      const msg =
        e instanceof EntryValidationError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Save failed";
      setError(msg);
      throw e;
    }
  };

  const handleDelete = async (id: string) => {
    setError(null);
    try {
      await deleteEntry(id);
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
      throw e;
    }
  };

  return {
    entries,
    ready,
    error,
    setError,
    refresh,
    clockIn: handleClockIn,
    clockOut: handleClockOut,
    saveEntry: handleSave,
    deleteEntry: handleDelete,
  };
}
