import { useState, useEffect, useRef } from "react";
import * as XLSX from "xlsx";

/* ------------------------------------------------------------------ *
 *  DATA LAYER  —  the only thing you swap when you move to Supabase.
 *  Right now it uses the artifact's persistent storage so you can
 *  really test it. To deploy: replace the four methods below with
 *  Supabase calls. Schema:
 *
 *    create table entries (
 *      id        text primary key,
 *      start_at  timestamptz not null,   -- stored UTC
 *      end_at    timestamptz,            -- null = open shift
 *      location  text not null,
 *      note      text default ''
 *    );
 *
 *  load()        -> select * from entries order by start_at
 *  save(list)    -> not needed; use add/update/remove per row instead
 *  add(e)        -> insert into entries ...
 *  update(e)     -> update entries set ... where id = e.id
 *  remove(id)    -> delete from entries where id = id
 * ------------------------------------------------------------------ */
const KEY = "timeclock:entries";
let memFallback = [];
const db = {
  async load() {
    try {
      const r = await window.storage.get(KEY);
      return r ? JSON.parse(r.value) : [];
    } catch {
      return memFallback;
    }
  },
  async save(list) {
    memFallback = list;
    try {
      await window.storage.set(KEY, JSON.stringify(list));
    } catch {
      /* storage unavailable; in-memory only */
    }
  },
};

/* ----------------------------- helpers ---------------------------- */
const LOCATIONS = [
  { id: "main", label: "Main office" },
  { id: "other", label: "Other office" },
  { id: "meeting", label: "Meeting" },
  { id: "remote", label: "Remote" },
];
const locLabel = (id) => (LOCATIONS.find((l) => l.id === id) || {}).label || id;

const pad = (n) => String(n).padStart(2, "0");
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

function minutesBetween(startIso, endIso) {
  return (new Date(endIso) - new Date(startIso)) / 60000;
}
// round each entry to nearest 5 min, THEN sum — so rows always add up.
const round5 = (min) => Math.round(min / 5) * 5;
const toHours = (min) => (min / 60).toFixed(2);

function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
function fmtDateShort(d) {
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
function localDateKey(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function dateKey(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
// Monday-start week. offset 0 = this week.
function weekStart(offset = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setDate(d.getDate() - day + offset * 7);
  return d;
}
function addDays(d, n) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
// ISO <-> <input type=datetime-local> value (local time)
function toLocalInput(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
const fromLocalInput = (s) => new Date(s).toISOString();

function elapsed(startIso, nowMs) {
  let s = Math.max(0, Math.floor((nowMs - new Date(startIso)) / 1000));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/* ------------------------------ app ------------------------------- */
export default function TimeClock() {
  const [entries, setEntries] = useState([]);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState("today"); // today | week
  const [pickLoc, setPickLoc] = useState("main");
  const [weekOffset, setWeekOffset] = useState(0);
  const [editing, setEditing] = useState(null); // entry obj or 'new'
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    db.load().then((list) => {
      setEntries(list);
      setReady(true);
    });
  }, []);

  // live clock tick (only meaningful while a shift is open)
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const persist = (next) => {
    setEntries(next);
    db.save(next);
  };

  const open = entries.find((e) => !e.end) || null;
  const todayKey = dateKey(new Date());
  const openIsStale = open && localDateKey(open.start) !== todayKey;

  const clockIn = () => {
    if (open) return;
    persist([...entries, { id: uid(), start: new Date().toISOString(), end: null, location: pickLoc, note: "" }]);
  };
  const clockOut = () => {
    if (!open) return;
    persist(entries.map((e) => (e.id === open.id ? { ...e, end: new Date().toISOString() } : e)));
  };
  const saveEdit = (e) => {
    if (entries.some((x) => x.id === e.id)) persist(entries.map((x) => (x.id === e.id ? e : x)));
    else persist([...entries, e]);
    setEditing(null);
  };
  const removeEntry = (id) => {
    persist(entries.filter((e) => e.id !== id));
    setEditing(null);
  };

  /* ---- today totals ---- */
  const todayEntries = entries
    .filter((e) => localDateKey(e.start) === todayKey)
    .sort((a, b) => new Date(a.start) - new Date(b.start));
  const todayMin = todayEntries
    .filter((e) => e.end)
    .reduce((sum, e) => sum + round5(minutesBetween(e.start, e.end)), 0);

  if (!ready) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        Loading…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: "ui-sans-serif, system-ui, Inter, sans-serif" }}>
      <div className="mx-auto w-full max-w-md px-5 pb-28">
        {/* header */}
        <header className="pt-7 pb-4 flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.22em] text-emerald-400 font-semibold">On the Clock</div>
            <div className="text-sm text-slate-500">{new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}</div>
          </div>
          <div className="flex rounded-full bg-slate-900 border border-slate-800 p-1 text-xs font-medium">
            {["today", "week"].map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-1.5 rounded-full capitalize transition-colors ${view === v ? "bg-slate-100 text-slate-900" : "text-slate-400"}`}
              >
                {v}
              </button>
            ))}
          </div>
        </header>

        {/* stale open-shift warning */}
        {openIsStale && (
          <button
            onClick={() => setEditing(open)}
            className="w-full text-left mb-4 rounded-2xl border border-amber-500 bg-amber-500/10 px-4 py-3"
          >
            <div className="text-amber-400 text-sm font-semibold">Open shift since {fmtDateShort(new Date(open.start))}</div>
            <div className="text-amber-200/80 text-xs mt-0.5">Looks like a missed clock-out. Tap to set the end time.</div>
          </button>
        )}

        {view === "today" ? (
          <>
            {/* HERO */}
            <div className={`rounded-3xl border px-6 py-7 ${open ? "border-emerald-500/40 bg-emerald-500/5" : "border-slate-800 bg-slate-900"}`}>
              {open ? (
                <>
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-semibold uppercase tracking-widest">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Running
                  </div>
                  <div
                    className="mt-3 text-6xl font-semibold text-slate-50"
                    style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em" }}
                  >
                    {elapsed(open.start, tick)}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    {locLabel(open.location)} · since {fmtTime(open.start)}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Not clocked in</div>
                  <div
                    className="mt-3 text-6xl font-semibold text-slate-50"
                    style={{ fontFamily: "ui-monospace, SFMono-Regular, monospace", fontVariantNumeric: "tabular-nums" }}
                  >
                    {toHours(todayMin)}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">hours logged today</div>
                </>
              )}
            </div>

            {/* location picker (only when off the clock) */}
            {!open && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {LOCATIONS.map((l) => (
                  <button
                    key={l.id}
                    onClick={() => setPickLoc(l.id)}
                    className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                      pickLoc === l.id ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-slate-800 bg-slate-900 text-slate-400"
                    }`}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            )}

            {/* primary action */}
            <button
              onClick={open ? clockOut : clockIn}
              className={`mt-4 w-full rounded-2xl py-4 text-base font-semibold transition-transform active:scale-[0.99] ${
                open ? "bg-slate-100 text-slate-900" : "bg-emerald-500 text-slate-950"
              }`}
            >
              {open ? "Clock Out" : `Clock In · ${locLabel(pickLoc)}`}
            </button>

            {/* today list */}
            <div className="mt-7 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-300">Today</h2>
              <button onClick={() => setEditing("new")} className="text-xs font-medium text-emerald-400">+ Add entry</button>
            </div>
            <div className="mt-2 space-y-2">
              {todayEntries.length === 0 && <p className="text-sm text-slate-600 py-3">Nothing logged yet today.</p>}
              {todayEntries.map((e) => (
                <EntryRow key={e.id} e={e} onEdit={() => setEditing(e)} />
              ))}
            </div>
          </>
        ) : (
          <WeekView entries={entries} weekOffset={weekOffset} setWeekOffset={setWeekOffset} onEdit={setEditing} />
        )}

        <p className="mt-9 text-[11px] leading-relaxed text-slate-600">
          Times are stored in UTC and shown in your local zone, so travel between offices never skews the math. Each
          entry is rounded to the nearest 5 minutes, then summed. An entry that crosses midnight counts on the day it
          started.
        </p>
      </div>

      {editing && (
        <EditSheet
          entry={editing === "new" ? null : editing}
          onSave={saveEdit}
          onDelete={removeEntry}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/* --------------------------- components --------------------------- */
function EntryRow({ e, onEdit }) {
  const mins = e.end ? round5(minutesBetween(e.start, e.end)) : null;
  return (
    <button onClick={onEdit} className="w-full text-left flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3">
      <div>
        <div className="text-sm text-slate-100 font-medium" style={{ fontVariantNumeric: "tabular-nums" }}>
          {fmtTime(e.start)} – {e.end ? fmtTime(e.end) : <span className="text-emerald-400">running</span>}
        </div>
        <div className="text-xs text-slate-500">{locLabel(e.location)}{e.note ? ` · ${e.note}` : ""}</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-semibold text-slate-200" style={{ fontVariantNumeric: "tabular-nums" }}>
          {mins != null ? toHours(mins) : "—"}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-slate-600">hrs</div>
      </div>
    </button>
  );
}

function WeekView({ entries, weekOffset, setWeekOffset, onEdit }) {
  const start = weekStart(weekOffset);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));
  const inWeek = (e) => {
    const k = localDateKey(e.start);
    return k >= dateKey(days[0]) && k <= dateKey(days[6]);
  };
  const weekEntries = entries.filter(inWeek);
  const weekMin = weekEntries.filter((e) => e.end).reduce((s, e) => s + round5(minutesBetween(e.start, e.end)), 0);
  const label =
    weekOffset === 0 ? "This week" : weekOffset === -1 ? "Last week" : `${fmtDateShort(days[0])} – ${fmtDateShort(days[6])}`;

  const exportXlsx = (weeksBack) => {
    const first = weekStart(weekOffset - (weeksBack - 1));
    const rangeDays = Array.from({ length: 7 * weeksBack }, (_, i) => addDays(first, i));
    const aoa = [["Date", "Day", "Start", "End", "Location", "Hours"]];
    let grand = 0;
    rangeDays.forEach((d) => {
      const k = dateKey(d);
      const list = entries
        .filter((e) => e.end && localDateKey(e.start) === k)
        .sort((a, b) => new Date(a.start) - new Date(b.start));
      if (list.length === 0) return;
      let dayMin = 0;
      list.forEach((e) => {
        const m = round5(minutesBetween(e.start, e.end));
        dayMin += m;
        aoa.push([
          k,
          d.toLocaleDateString([], { weekday: "short" }),
          fmtTime(e.start),
          fmtTime(e.end),
          locLabel(e.location),
          Number(toHours(m)),
        ]);
      });
      aoa.push(["", "", "", "", "Day total", Number(toHours(dayMin))]);
      grand += dayMin;
    });
    aoa.push([]);
    aoa.push(["", "", "", "", "WEEK TOTAL", Number(toHours(grand))]);
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 12 }, { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 8 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hours");
    XLSX.writeFile(wb, `Hours_${dateKey(first)}.xlsx`);
  };

  return (
    <div>
      <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-3 py-3">
        <button onClick={() => setWeekOffset(weekOffset - 1)} className="px-3 py-1 text-slate-400 text-lg">‹</button>
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-100">{label}</div>
          <div className="text-2xl font-semibold text-emerald-400" style={{ fontVariantNumeric: "tabular-nums" }}>
            {toHours(weekMin)} <span className="text-xs text-slate-500 font-normal">hrs</span>
          </div>
        </div>
        <button
          onClick={() => setWeekOffset(Math.min(0, weekOffset + 1))}
          className={`px-3 py-1 text-lg ${weekOffset >= 0 ? "text-slate-700" : "text-slate-400"}`}
        >
          ›
        </button>
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={() => exportXlsx(1)} className="flex-1 rounded-xl bg-emerald-500 text-slate-950 py-3 text-sm font-semibold">
          Export this week
        </button>
        <button onClick={() => exportXlsx(2)} className="flex-1 rounded-xl border border-slate-700 text-slate-200 py-3 text-sm font-semibold">
          Export last 2 weeks
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {days.map((d) => {
          const k = dateKey(d);
          const list = entries
            .filter((e) => localDateKey(e.start) === k)
            .sort((a, b) => new Date(a.start) - new Date(b.start));
          const dMin = list.filter((e) => e.end).reduce((s, e) => s + round5(minutesBetween(e.start, e.end)), 0);
          return (
            <div key={k}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{fmtDateShort(d)}</span>
                <span className="text-xs text-slate-400" style={{ fontVariantNumeric: "tabular-nums" }}>
                  {list.length ? `${toHours(dMin)} hrs` : ""}
                </span>
              </div>
              {list.length === 0 ? (
                <div className="text-xs text-slate-700 pb-1">—</div>
              ) : (
                <div className="space-y-2">
                  {list.map((e) => (
                    <EntryRow key={e.id} e={e} onEdit={() => onEdit(e)} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function EditSheet({ entry, onSave, onDelete, onClose }) {
  const base = entry || {
    id: uid(),
    start: new Date().toISOString(),
    end: new Date().toISOString(),
    location: "main",
    note: "",
  };
  const [startV, setStartV] = useState(toLocalInput(base.start));
  const [endV, setEndV] = useState(base.end ? toLocalInput(base.end) : "");
  const [loc, setLoc] = useState(base.location);
  const [note, setNote] = useState(base.note || "");
  const [err, setErr] = useState("");

  const save = () => {
    const start = fromLocalInput(startV);
    const end = endV ? fromLocalInput(endV) : null;
    if (end && new Date(end) <= new Date(start)) {
      setErr("End time has to be after the start time.");
      return;
    }
    onSave({ id: base.id, start, end, location: loc, note: note.trim() });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-slate-900 border border-slate-800 p-6"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-semibold text-slate-100">{entry ? "Edit entry" : "Add entry"}</h3>
          <button onClick={onClose} className="text-slate-500 text-sm">Close</button>
        </div>

        <label className="block text-xs font-medium text-slate-400 mb-1">Start</label>
        <input
          type="datetime-local"
          value={startV}
          onChange={(e) => setStartV(e.target.value)}
          className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 mb-4"
        />

        <label className="block text-xs font-medium text-slate-400 mb-1">End <span className="text-slate-600">(leave blank if still running)</span></label>
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
                loc === l.id ? "border-emerald-500 bg-emerald-500/10 text-emerald-300" : "border-slate-700 bg-slate-950 text-slate-400"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>

        <label className="block text-xs font-medium text-slate-400 mb-1">Note <span className="text-slate-600">(optional)</span></label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. client meeting, St. Louis branch"
          className="w-full rounded-xl bg-slate-950 border border-slate-700 px-3 py-2.5 text-sm text-slate-100 mb-4"
        />

        {err && <p className="text-xs text-red-400 mb-3">{err}</p>}

        <div className="flex gap-2">
          <button onClick={save} className="flex-1 rounded-xl bg-emerald-500 text-slate-950 py-3 text-sm font-semibold">Save</button>
          {entry && (
            <button onClick={() => onDelete(base.id)} className="rounded-xl border border-red-500/50 text-red-400 px-4 py-3 text-sm font-semibold">
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
