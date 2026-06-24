import type { Entry } from "../types/entry";
import { fmtDateShort } from "../lib/time";

export function StaleBanner({
  open,
  onFix,
}: {
  open: Entry;
  onFix: () => void;
}) {
  return (
    <button
      onClick={onFix}
      className="w-full text-left mb-4 rounded-2xl border border-amber-500 bg-amber-500/10 px-4 py-3"
    >
      <div className="text-amber-400 text-sm font-semibold">
        Open shift since {fmtDateShort(new Date(open.start))}
      </div>
      <div className="text-amber-200/80 text-xs mt-0.5">
        Looks like a missed clock-out. Tap to set the end time.
      </div>
    </button>
  );
}
