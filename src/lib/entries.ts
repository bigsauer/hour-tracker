import type { Entry, LocationId } from "../types/entry";
import type { Tables } from "../types/database";
import { getSupabase } from "./supabase";

type EntryRow = Tables<"entries">;

function rowToEntry(row: EntryRow): Entry {
  return {
    id: row.id,
    start: row.start_at,
    end: row.end_at,
    location: row.location as LocationId,
    note: row.note,
  };
}

export class EntryValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EntryValidationError";
  }
}

function validateEndAfterStart(start: string, end: string | null): void {
  if (end && new Date(end) <= new Date(start)) {
    throw new EntryValidationError("End time has to be after the start time.");
  }
}

export async function loadEntries(): Promise<Entry[]> {
  const { data, error } = await getSupabase()
    .from("entries")
    .select("*")
    .order("start_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(rowToEntry);
}

export async function clockIn(location: LocationId): Promise<Entry> {
  const existing = await findOpenEntry();
  if (existing) {
    throw new Error("Already clocked in");
  }

  const { data, error } = await getSupabase()
    .from("entries")
    .insert({
      start_at: new Date().toISOString(),
      location,
      note: "",
    })
    .select()
    .single();

  if (error) throw error;
  return rowToEntry(data);
}

export async function clockOut(id: string): Promise<Entry> {
  const { data, error } = await getSupabase()
    .from("entries")
    .update({ end_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return rowToEntry(data);
}

export async function createEntry(entry: Omit<Entry, "id">): Promise<Entry> {
  validateEndAfterStart(entry.start, entry.end);

  const { data, error } = await getSupabase()
    .from("entries")
    .insert({
      start_at: entry.start,
      end_at: entry.end,
      location: entry.location,
      note: entry.note,
    })
    .select()
    .single();

  if (error) throw error;
  return rowToEntry(data);
}

export async function updateEntry(entry: Entry): Promise<Entry> {
  validateEndAfterStart(entry.start, entry.end);

  const { data, error } = await getSupabase()
    .from("entries")
    .update({
      start_at: entry.start,
      end_at: entry.end,
      location: entry.location,
      note: entry.note,
    })
    .eq("id", entry.id)
    .select()
    .single();

  if (error) throw error;
  return rowToEntry(data);
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await getSupabase().from("entries").delete().eq("id", id);
  if (error) throw error;
}

export async function findOpenEntry(): Promise<Entry | null> {
  const { data, error } = await getSupabase()
    .from("entries")
    .select("*")
    .is("end_at", null)
    .maybeSingle();

  if (error) throw error;
  return data ? rowToEntry(data) : null;
}
