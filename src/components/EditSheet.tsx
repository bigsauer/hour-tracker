import { useState } from "react";
import type { Entry, LocationId } from "../types/entry";
import { LOCATIONS } from "../types/entry";
import { EntryValidationError } from "../lib/entries";
import { fromLocalInput, toLocalInput } from "../lib/time";

export function EditSheet({
  entry,
  isNew,
  onSave,
  onDelete,
  onClose,
}: {
  entry: Entry | null;
  isNew: boolean;
  onSave: (entry: Entry, isNew: boolean) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const baseStart = entry?.start ?? new Date().toISOString();
  const baseEnd = entry?.end ?? new Date().toISOString();

  const [startV, setStartV] = useState(toLocalInput(baseStart));
  const [endV, setEndV] = useState(entry?.end ? toLocalInput(baseEnd) : "");
  const [loc, setLoc] = useState<LocationId>(entry?.location ?? "main");
  const [note, setNote] = useState(entry?.note ?? "");
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const start = fromLocalInput(startV);
    const end = endV ? fromLocalInput(endV) : null;
    if (end && new Date(end) <= new Date(start)) {
      setErr("End time has to be after the start time.");
      return;
    }

    const payload: Entry = {
      id: entry?.id ?? "",
      start,
      end,
      location: loc,
      note: note.trim(),
    };

    setSaving(true);
    setErr("");
    try {
      await onSave(payload, isNew);
      onClose();
    } catch (e) {
      if (e instanceof EntryValidationError) {
        setErr(e.message);
      } else if (e instanceof Error) {
        setErr(e.message);
      } else {
        setErr("Save failed");
      }
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!entry) return;
    setSaving(true);
    try {
      await onDelete(entry.id);
      onClose();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-800 p-6"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-100">
            {isNew ? "Add entry" : "Edit entry"}
          </h3>
          <button onClick={onClose} className="text-slate-500 text-sm">Close</button>
        </div>

        <label className="block text-xs font-medium text-slate-400 mb-1">Start</label>
        <input
          type="datetime-local"
          value={startV}
          onChange={(e) => setStartV(e.target.value)}
          className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 mb-4"
        />

        <label className="block text-xs font-medium text-slate-400 mb-1">
          End <span className="text-slate-600">(leave blank if still running)</span>
        </label>
        <input
          type="datetime-local"
          value={endV}
          onChange={(e) => setEndV(e.target.value)}
          className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 mb-4"
        />

        <label className="block text-xs font-medium text-slate-400 mb-1">Location</label>
        <div className="grid grid-cols-2 gap-2 mb-4">
          {LOCATIONS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLoc(l.id)}
              className={`rounded-xl border px-3 py-2 text-sm transition-colors ${
                loc === l.id
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-700 bg-slate-950 text-slate-400"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <label className="block text-xs font-medium text-slate-400 mb-1">
          Note <span className="text-slate-600">(optional)</span>
        </label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. client meeting, St. Louis branch"
          className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 mb-4"
        />

        {err && <p className="text-xs text-red-400 mb-3">{err}</p>}

        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 rounded-xl bg-emerald-500 text-slate-950 py-3 text-sm font-semibold disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {entry && !isNew && (
            <button
              onClick={remove}
              disabled={saving}
              className="rounded-xl border border-red-500/50 text-red-400 px-4 py-3 text-sm font-semibold disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
