import type { Entry } from "../types/entry";
import { locLabel } from "../types/entry";
import { entryRoundedMinutes, fmtTime, toHoursStr } from "../lib/time";

export function EntryRow({
  entry,
  onEdit,
}: {
  entry: Entry;
  onEdit: () => void;
}) {
  const mins = entryRoundedMinutes(entry);

  return (
    <button
      onClick={onEdit}
      className="w-full text-left flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-3"
    >
      <div>
        <div
          className="text-sm text-slate-100 font-medium"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {fmtTime(entry.start)} –{" "}
          {entry.end ? (
            fmtTime(entry.end)
          ) : (
            <span className="text-emerald-400">running</span>
          )}
        </div>
        <div className="text-xs text-slate-500">
          {locLabel(entry.location)}
          {entry.note ? ` · ${entry.note}` : ""}
        </div>
      </div>
      <div className="text-right">
        <div
          className="text-sm font-semibold text-slate-200"
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {mins != null ? toHoursStr(mins) : "—"}
        </div>
        <div className="text-[10px] uppercase tracking-wider text-slate-600">hrs</div>
      </div>
    </button>
  );
}
