import { useEffect, useState } from "react";
import type { Entry, LocationId } from "./types/entry";
import { EditSheet } from "./components/EditSheet";
import { StaleBanner } from "./components/StaleBanner";
import { TodayView } from "./components/TodayView";
import { WeekView } from "./components/WeekView";
import { useEntries } from "./hooks/useEntries";
import { dateKey, isStaleOpenShift } from "./lib/time";

type View = "today" | "week";
type EditingState = { kind: "new" } | { kind: "edit"; entry: Entry } | null;

export default function TimeClockApp() {
  const {
    entries,
    ready,
    error,
    clockIn,
    clockOut,
    saveEntry,
    deleteEntry,
  } = useEntries();

  const [view, setView] = useState<View>("today");
  const [pickLoc, setPickLoc] = useState<LocationId>("main");
  const [weekOffset, setWeekOffset] = useState(0);
  const [editing, setEditing] = useState<EditingState>(null);
  const [tick, setTick] = useState(Date.now());
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const open = entries.find((e) => !e.end) ?? null;
  const todayKey = dateKey(new Date());
  const openIsStale = isStaleOpenShift(open, todayKey);

  const handleClockIn = async () => {
    if (open || acting) return;
    setActing(true);
    try {
      await clockIn(pickLoc);
    } finally {
      setActing(false);
    }
  };

  const handleClockOut = async () => {
    if (!open || acting) return;
    setActing(true);
    try {
      await clockOut(open.id);
    } finally {
      setActing(false);
    }
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        Loading…
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-slate-950 text-slate-100"
      style={{ fontFamily: "ui-sans-serif, system-ui, Inter, sans-serif" }}
    >
      <div className="mx-auto w-full max-w-md px-5 pb-28">
        <header className="pt-7 pb-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-400 font-semibold">
              On the Clock
            </div>
            <div className="text-sm text-slate-500">
              {new Date().toLocaleDateString([], {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
          <div className="flex rounded-full bg-slate-900 border border-slate-800 p-1 text-xs font-medium">
            {(["today", "week"] as View[]).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-full capitalize transition-colors ${
                  view === v ? "bg-slate-100 text-slate-900" : "text-slate-400"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        </header>

        {error && (
          <p className="mb-4 text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-2">
            {error}
          </p>
        )}

        {openIsStale && open && (
          <StaleBanner open={open} onFix={() => setEditing({ kind: "edit", entry: open })} />
        )}

        {view === "today" ? (
          <TodayView
            entries={entries}
            open={open}
            pickLoc={pickLoc}
            setPickLoc={setPickLoc}
            tick={tick}
            onClockIn={handleClockIn}
            onClockOut={handleClockOut}
            onAdd={() => setEditing({ kind: "new" })}
            onEdit={(entry) => setEditing({ kind: "edit", entry })}
          />
        ) : (
          <WeekView
            entries={entries}
            weekOffset={weekOffset}
            setWeekOffset={setWeekOffset}
            onEdit={(entry) => setEditing({ kind: "edit", entry })}
          />
        )}

        <p className="mt-9 text-[11px] leading-relaxed text-slate-600">
          Times are stored in UTC and shown in your local zone, so travel between offices never
          skews the math. Each entry is rounded to the nearest 5 minutes, then summed. An entry
          that crosses midnight counts on the day it started.
        </p>
      </div>

      {editing && (
        <EditSheet
          entry={editing.kind === "new" ? null : editing.entry}
          isNew={editing.kind === "new"}
          onSave={async (entry, isNew) => {
            await saveEntry(entry, isNew);
          }}
          onDelete={deleteEntry}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

