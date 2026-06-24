import type { Entry } from "../types/entry";

const pad = (n: number) => String(n).padStart(2, "0");

export const round5 = (minutes: number): number => Math.round(minutes / 5) * 5;

export const minutesBetween = (startIso: string, endIso: string): number =>
  (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000;

export const toHoursStr = (minutes: number): string => (minutes / 60).toFixed(2);
export const toHoursNum = (minutes: number): number => Number((minutes / 60).toFixed(2));

export function weekStart(offset = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow + offset * 7);
  return d;
}

export function localDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function dateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function fmtDateShort(d: Date): string {
  return d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}

export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(s: string): string {
  return new Date(s).toISOString();
}

export function elapsed(startIso: string, nowMs: number): string {
  let s = Math.max(0, Math.floor((nowMs - new Date(startIso).getTime()) / 1000));
  const h = Math.floor(s / 3600);
  s -= h * 3600;
  const m = Math.floor(s / 60);
  s -= m * 60;
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function entryRoundedMinutes(entry: Entry): number | null {
  if (!entry.end) return null;
  return round5(minutesBetween(entry.start, entry.end));
}

export function entriesForDay(entries: Entry[], dayKey: string): Entry[] {
  return entries
    .filter((e) => localDateKey(e.start) === dayKey)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
}

export function dayTotalMinutes(entries: Entry[], dayKey: string): number {
  return entriesForDay(entries, dayKey)
    .filter((e) => e.end)
    .reduce((sum, e) => sum + round5(minutesBetween(e.start, e.end!)), 0);
}

export function weekDays(weekStartDate: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i));
}

export function weekTotalMinutes(entries: Entry[], weekStartDate: Date): number {
  const days = weekDays(weekStartDate);
  return days.reduce((sum, d) => sum + dayTotalMinutes(entries, dateKey(d)), 0);
}

export function entryInWeek(entry: Entry, weekStartDate: Date): boolean {
  const days = weekDays(weekStartDate);
  const startKey = dateKey(days[0]);
  const endKey = dateKey(days[6]);
  const k = localDateKey(entry.start);
  return k >= startKey && k <= endKey;
}

export function isStaleOpenShift(open: Entry | null, todayKey: string): boolean {
  return open !== null && localDateKey(open.start) !== todayKey;
}
