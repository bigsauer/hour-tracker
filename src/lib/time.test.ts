import { describe, expect, it } from "vitest";
import type { Entry } from "../types/entry";
import {
  dayTotalMinutes,
  localDateKey,
  minutesBetween,
  round5,
  toHoursStr,
  weekStart,
  weekTotalMinutes,
} from "./time";

describe("round5", () => {
  it("rounds to nearest 5 minutes", () => {
    expect(round5(0)).toBe(0);
    expect(round5(2)).toBe(0);
    expect(round5(3)).toBe(5);
    expect(round5(7)).toBe(5);
    expect(round5(8)).toBe(10);
    expect(round5(32)).toBe(30);
    expect(round5(33)).toBe(35);
  });
});

describe("minutesBetween", () => {
  it("computes minutes between two ISO timestamps", () => {
    expect(minutesBetween("2026-06-24T09:00:00.000Z", "2026-06-24T09:25:00.000Z")).toBe(25);
  });

  it("handles DST boundary with fixed ISO strings", () => {
    const start = "2026-03-08T06:00:00.000Z";
    const end = "2026-03-08T08:00:00.000Z";
    expect(minutesBetween(start, end)).toBe(120);
  });
});

describe("totaling", () => {
  const threeSevenMinEntries: Entry[] = [
    {
      id: "1",
      start: "2026-06-24T09:00:00.000Z",
      end: "2026-06-24T09:07:00.000Z",
      location: "main",
      note: "",
    },
    {
      id: "2",
      start: "2026-06-24T10:00:00.000Z",
      end: "2026-06-24T10:07:00.000Z",
      location: "main",
      note: "",
    },
    {
      id: "3",
      start: "2026-06-24T11:00:00.000Z",
      end: "2026-06-24T11:07:00.000Z",
      location: "main",
      note: "",
    },
  ];

  it("rounds per entry then sums to 0.25 hours", () => {
    const dayKey = localDateKey(threeSevenMinEntries[0].start);
    const mins = dayTotalMinutes(threeSevenMinEntries, dayKey);
    expect(mins).toBe(15);
    expect(toHoursStr(mins)).toBe("0.25");
  });
});

describe("weekStart", () => {
  it("returns Monday 00:00 local for offset 0 on a Wednesday", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 5, 24, 15, 30, 0)); // Wed Jun 24 2026 local

    const start = weekStart(0);
    expect(start.getDay()).toBe(1);
    expect(start.getHours()).toBe(0);
    expect(start.getMinutes()).toBe(0);
    expect(start.getDate()).toBe(22);

    const prev = weekStart(-1);
    expect(prev.getDate()).toBe(15);

    vi.useRealTimers();
  });
});

describe("localDateKey", () => {
  it("uses local date parts, not UTC", () => {
    const iso = "2026-06-24T02:30:00.000Z";
    const utcKey = new Date(iso).toISOString().slice(0, 10);
    const localKey = localDateKey(iso);
    const offset = new Date(iso).getTimezoneOffset();
    if (offset < 0) {
      expect(localKey).not.toBe(utcKey);
    }
    expect(localKey).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("buckets evening local time on correct local date", () => {
    const d = new Date(2026, 5, 24, 20, 30, 0);
    const iso = d.toISOString();
    expect(localDateKey(iso)).toBe("2026-06-24");
  });
});

describe("weekTotalMinutes", () => {
  it("sums day totals for the week", () => {
    const start = weekStart(0);
    const entries: Entry[] = [
      {
        id: "1",
        start: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 9, 0).toISOString(),
        end: new Date(start.getFullYear(), start.getMonth(), start.getDate(), 10, 0).toISOString(),
        location: "main",
        note: "",
      },
    ];
    expect(weekTotalMinutes(entries, start)).toBe(60);
  });
});
