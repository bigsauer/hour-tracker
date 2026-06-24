import { describe, expect, it } from "vitest";
import type { Entry } from "../types/entry";
import { buildWeekExport, parseExportWorkbook, verifyXlInvariants } from "./export";
import { localDateKey } from "./time";

describe("export", () => {
  const entries: Entry[] = [
    {
      id: "1",
      start: "2026-06-22T14:05:00.000Z",
      end: "2026-06-22T17:30:00.000Z",
      location: "main",
      note: "",
    },
    {
      id: "2",
      start: "2026-06-23T14:00:00.000Z",
      end: "2026-06-23T14:07:00.000Z",
      location: "main",
      note: "",
    },
    {
      id: "3",
      start: "2026-06-23T15:00:00.000Z",
      end: "2026-06-23T15:07:00.000Z",
      location: "main",
      note: "",
    },
    {
      id: "4",
      start: "2026-06-23T16:00:00.000Z",
      end: "2026-06-23T16:07:00.000Z",
      location: "main",
      note: "",
    },
    {
      id: "open",
      start: "2026-06-24T10:00:00.000Z",
      end: null,
      location: "remote",
      note: "",
    },
  ];

  it("excludes open shifts from export", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-24T12:00:00.000Z"));

    const { workbook } = buildWeekExport(entries, 0, 1);
    const rows = parseExportWorkbook(workbook);
    const dataRows = rows.filter((r) => r[0] && r[4] !== "Day total" && r[4] !== "WEEK TOTAL");
    expect(dataRows.some((r) => localDateKey(String(r[0])) === "2026-06-24")).toBe(false);

    vi.useRealTimers();
  });

  it("passes XL invariants for per-entry rounding proof", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-24T12:00:00.000Z"));

    const { workbook, filename } = buildWeekExport(entries, 0, 1);
    expect(filename).toMatch(/^Hours_\d{4}-\d{2}-\d{2}\.xlsx$/);

    const rows = parseExportWorkbook(workbook);
    const result = verifyXlInvariants(rows);
    expect(result.ok).toBe(true);

    vi.useRealTimers();
  });

  it("three 7-min entries on one day total 0.25 in export", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-24T12:00:00.000Z"));

    const dayEntries: Entry[] = [
      {
        id: "a",
        start: "2026-06-23T14:00:00.000Z",
        end: "2026-06-23T14:07:00.000Z",
        location: "main",
        note: "",
      },
      {
        id: "b",
        start: "2026-06-23T15:00:00.000Z",
        end: "2026-06-23T15:07:00.000Z",
        location: "main",
        note: "",
      },
      {
        id: "c",
        start: "2026-06-23T16:00:00.000Z",
        end: "2026-06-23T16:07:00.000Z",
        location: "main",
        note: "",
      },
    ];

    const { workbook } = buildWeekExport(dayEntries, 0, 1);
    const rows = parseExportWorkbook(workbook);
    const dayTotalRow = rows.find((r) => r[4] === "Day total");
    expect(dayTotalRow?.[5]).toBe(0.25);

    vi.useRealTimers();
  });
});
