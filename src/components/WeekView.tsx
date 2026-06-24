import type { Entry } from "../types/entry";
import { downloadWeekExport } from "../lib/export";
import { EntryRow } from "./EntryRow";
import {
  dateKey,
  dayTotalMinutes,
  entriesForDay,
  fmtDateShort,
  toHoursStr,
  weekDays,
  weekStart,
  weekTotalMinutes,
} from "../lib/time";

export function WeekView({
  entries,
  weekOffset,
  setWeekOffset,
  onEdit,
}: {
  entries: Entry[];
  weekOffset: number;
  setWeekOffset: (n: number) => void;
  onEdit: (entry: Entry) => void;
}) {
  const start = weekStart(weekOffset);
  const days = weekDays(start);
  const weekMin = weekTotalMinutes(entries, start);
  const label =
    weekOffset === 0
      ? "This week"
      : weekOffset === -1
        ? "Last week"
        : `${fmtDateShort(days[0])} – ${fmtDateShort(days[6])}`;

  return (
    <div>
      <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-3 py-3">
        <button
          onClick={() => setWeekOffset(weekOffset - 1)}
          className="px-3 py-1 text-slate-400 text-lg"
        >
          ‹
        </button>
        <div className="text-center">
          <div className="text-sm font-semibold text-slate-100">{label}</div>
          <div
            className="text-2xl font-semibold text-emerald-400"
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {toHoursStr(weekMin)}{" "}
            <span className="text-xs text-slate-500 font-normal">hrs</span>
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
        <button
          onClick={() => downloadWeekExport(entries, weekOffset, 1)}
          className="flex-1 rounded-xl bg-emerald-500 text-slate-950 py-3 text-sm font-semibold"
        >
          Export this week
        </button>
        <button
          onClick={() => downloadWeekExport(entries, weekOffset, 2)}
          className="flex-1 rounded-xl border border-slate-700 text-slate-200 py-3 text-sm font-semibold"
        >
          Export last 2 weeks
        </button>
      </div>

      <div className="mt-5 space-y-4">
        {days.map((d) => {
          const k = dateKey(d);
          const list = entriesForDay(entries, k);
          const dMin = dayTotalMinutes(entries, k);
          return (
            <div key={k}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {fmtDateShort(d)}
                </span>
                <span
                  className="text-xs text-slate-400"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {list.length ? `${toHoursStr(dMin)} hrs` : ""}
                </span>
              </div>
              {list.length === 0 ? (
                <div className="text-xs text-slate-700 pb-1">—</div>
              ) : (
                <div className="space-y-2">
                  {list.map((e) => (
                    <EntryRow key={e.id} entry={e} onEdit={() => onEdit(e)} />
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
