import type { Entry, LocationId } from "../types/entry";
import { LOCATIONS, locLabel } from "../types/entry";
import { EntryRow } from "./EntryRow";
import {
  dateKey,
  dayTotalMinutes,
  elapsed,
  entriesForDay,
  toHoursStr,
} from "../lib/time";

export function TodayView({
  entries,
  open,
  pickLoc,
  setPickLoc,
  tick,
  onClockIn,
  onClockOut,
  onAdd,
  onEdit,
}: {
  entries: Entry[];
  open: Entry | null;
  pickLoc: LocationId;
  setPickLoc: (loc: LocationId) => void;
  tick: number;
  onClockIn: () => void;
  onClockOut: () => void;
  onAdd: () => void;
  onEdit: (entry: Entry) => void;
}) {
  const todayKey = dateKey(new Date());
  const todayEntries = entriesForDay(entries, todayKey);
  const todayMin = dayTotalMinutes(entries, todayKey);

  return (
    <>
      <div
        className={`rounded-3xl border px-6 py-7 ${
          open ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-800 bg-slate-900"
        }`}
      >
        {open ? (
          <>
            <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-widest">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Running
            </div>
            <div
              className="mt-3 text-6xl font-semibold text-slate-50"
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontVariantNumeric: "tabular-nums",
                letterSpacing: "0.02em",
              }}
            >
              {elapsed(open.start, tick)}
            </div>
            <div className="mt-2 text-sm text-slate-400">
              {locLabel(open.location)} · since{" "}
              {new Date(open.start).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              })}
            </div>
          </>
        ) : (
          <>
            <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
              Not clocked in
            </div>
            <div
              className="mt-3 text-6xl font-semibold text-slate-50"
              style={{
                fontFamily: "ui-monospace, SFMono-Regular, monospace",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {toHoursStr(todayMin)}
            </div>
            <div className="mt-2 text-sm text-slate-400">hours logged today</div>
          </>
        )}
      </div>

      {!open && (
        <div className="mt-4 grid grid-cols-2 gap-2">
          {LOCATIONS.map((l) => (
            <button
              key={l.id}
              onClick={() => setPickLoc(l.id)}
              className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                pickLoc === l.id
                  ? "border-emerald-500 bg-emerald-500/10 text-emerald-300"
                  : "border-slate-800 bg-slate-900 text-slate-400"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      )}

      <button
        onClick={open ? onClockOut : onClockIn}
        disabled={!open && false}
        className={`mt-4 w-full rounded-2xl py-4 text-base font-semibold transition-transform active:scale-[0.99] ${
          open ? "bg-slate-100 text-slate-900" : "bg-emerald-500 text-slate-950"
        }`}
      >
        {open ? "Clock Out" : `Clock In · ${locLabel(pickLoc)}`}
      </button>

      <div className="mt-7 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-300">Today</h2>
        <button onClick={onAdd} className="text-xs font-medium text-emerald-400">
          + Add entry
        </button>
      </div>
      <div className="mt-2 space-y-2">
        {todayEntries.length === 0 && (
          <p className="text-sm text-slate-600 py-3">Nothing logged yet today.</p>
        )}
        {todayEntries.map((e) => (
          <EntryRow key={e.id} entry={e} onEdit={() => onEdit(e)} />
        ))}
      </div>
    </>
  );
}
