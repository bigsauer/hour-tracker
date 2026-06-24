import * as XLSX from "xlsx";
import type { Entry } from "../types/entry";
import { locLabel } from "../types/entry";
import {
  addDays,
  dateKey,
  fmtTime,
  localDateKey,
  minutesBetween,
  round5,
  toHoursNum,
  weekStart,
} from "./time";

export interface ExportResult {
  filename: string;
  workbook: XLSX.WorkBook;
}

export function buildWeekExport(
  entries: Entry[],
  weekOffset: number,
  weeksBack: number,
): ExportResult {
  const first = weekStart(weekOffset - (weeksBack - 1));
  const rangeDays = Array.from({ length: 7 * weeksBack }, (_, i) => addDays(first, i));
  const aoa: (string | number)[][] = [["Date", "Day", "Start", "End", "Location", "Hours"]];
  let grand = 0;

  rangeDays.forEach((d) => {
    const k = dateKey(d);
    const list = entries
      .filter((e) => e.end && localDateKey(e.start) === k)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    if (list.length === 0) return;

    let dayMin = 0;
    list.forEach((e) => {
      const m = round5(minutesBetween(e.start, e.end!));
      dayMin += m;
      aoa.push([
        k,
        d.toLocaleDateString([], { weekday: "short" }),
        fmtTime(e.start),
        fmtTime(e.end!),
        locLabel(e.location),
        toHoursNum(m),
      ]);
    });
    aoa.push(["", "", "", "", "Day total", toHoursNum(dayMin)]);
    grand += dayMin;
  });

  aoa.push([]);
  aoa.push(["", "", "", "", "WEEK TOTAL", toHoursNum(grand)]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 12 }, { wch: 6 }, { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 8 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Hours");

  return { filename: `Hours_${dateKey(first)}.xlsx`, workbook: wb };
}

export function downloadWeekExport(entries: Entry[], weekOffset: number, weeksBack: number): void {
  const { filename, workbook } = buildWeekExport(entries, weekOffset, weeksBack);
  XLSX.writeFile(workbook, filename);
}

export function parseExportWorkbook(workbook: XLSX.WorkBook): (string | number)[][] {
  const sheet = workbook.Sheets["Hours"];
  if (!sheet) throw new Error("Missing Hours worksheet");
  return XLSX.utils.sheet_to_json<(string | number)[]>(sheet, { header: 1, defval: "" });
}

export interface XlInvariantResult {
  ok: boolean;
  failures: string[];
}

export function verifyXlInvariants(rows: (string | number)[][]): XlInvariantResult {
  const failures: string[] = [];
  const header = rows[0];
  if (!header || header[0] !== "Date") {
    failures.push("Missing or invalid header row");
    return { ok: false, failures };
  }

  let currentDayRows: number[] = [];
  let dayTotals: number[] = [];
  let weekTotal: number | null = null;
  let lastDate = "";

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => c === "")) continue;

    const location = String(row[4] ?? "");
    const hours = row[5];

    if (location === "WEEK TOTAL") {
      weekTotal = Number(hours);
      continue;
    }

    if (location === "Day total") {
      const daySumMinutes = currentDayRows.reduce((a, b) => a + Math.round(b * 60), 0);
      const dayTotalMinutes = Math.round(Number(hours) * 60);
      if (daySumMinutes !== dayTotalMinutes) {
        failures.push(
          `Day ${lastDate}: entry rows sum ${daySumMinutes} min but Day total is ${dayTotalMinutes} min`,
        );
      }
      dayTotals.push(dayTotalMinutes);
      currentDayRows = [];
      continue;
    }

    if (row[0]) {
      lastDate = String(row[0]);
      const h = Number(hours);
      if (typeof hours === "string" && hours !== "") {
        failures.push(`Hours cell for ${lastDate} is string, not numeric`);
      }
      currentDayRows.push(h);
    }
  }

  if (weekTotal !== null) {
    const sumDayMinutes = dayTotals.reduce((a, b) => a + b, 0);
    const weekTotalMinutes = Math.round(weekTotal * 60);
    if (sumDayMinutes !== weekTotalMinutes) {
      failures.push(
        `Day totals sum ${sumDayMinutes} min but WEEK TOTAL is ${weekTotalMinutes} min`,
      );
    }
  } else {
    failures.push("Missing WEEK TOTAL row");
  }

  return { ok: failures.length === 0, failures };
}
