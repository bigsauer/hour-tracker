# Time Clock — Build Handoff for Cursor

A single-user web app for tracking my own work hours. I clock in/out from my phone, tag where I am, fix entries when I forget, and at week's end export a clean Excel file to send to our controller. It replaces a manual Excel + Life360 workflow.

This document is the source of truth. Build to it exactly. Where it says a value or rule, that value or rule is a decision, not a suggestion.

---

## 1. Locked decisions

These are settled. Don't re-litigate them in the build.

- **Users:** one (me). Build with per-user data isolation anyway so it doesn't have to be rewritten later.
- **Hosting:** Vercel (Hobby/free).
- **Backend:** Supabase (free tier).
- **Cost target:** $0 recurring. No paid tiers.
- **Hours format in the export:** decimal (e.g. `7.50`), two decimal places.
- **Rounding:** each entry's duration is rounded to the nearest **5 minutes**, *then* summed. Never round the total. Rows must visibly add up to the day and week totals.
- **Week:** Monday 00:00 → Sunday 23:59 local. I close the week out Sunday night.
- **Clocking model:** tap to clock in / clock out (manual, low-friction). Not GPS/geofence auto-detection — out of scope, see §13.
- **Location tags:** Main office, Other office, Meeting, Remote.
- **Time storage:** all timestamps stored in **UTC**, displayed in local time.
- **Midnight rule:** an entry that crosses midnight counts entirely on the day it **started**. Do not split.

---

## 2. Tech stack

- **Frontend:** Vite + React (matches the working prototype; simplest static deploy to Vercel). PWA-enabled (installable, works offline for the UI shell).
- **Backend:** Supabase (Postgres + Auth + auto REST). Client talks to Supabase directly with the anon key + Row Level Security. The anon key is safe to ship in the browser *as long as RLS is enabled* — that is by design.
- **Excel export:** SheetJS (`xlsx`), generated client-side, triggers a file download.
- **Auth:** Supabase email magic link. One account (mine). RLS scopes every row to the signed-in user.

---

## 3. Architecture

Client-only React app. No custom server. The browser:

1. Authenticates against Supabase (magic link).
2. Reads/writes the `entries` table directly via the Supabase JS client.
3. Generates the Excel file in-browser on demand.

State that must survive a crash (an open shift) lives in Postgres, written **on clock-in**, not on clock-out (see §6).

---

## 4. Supabase setup

### 4.1 Schema + RLS

Run this in the Supabase SQL editor.

```sql
create table public.entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) default auth.uid(),
  start_at   timestamptz not null,          -- UTC
  end_at     timestamptz,                    -- null = open shift
  location   text not null default 'main',   -- main | other | meeting | remote
  note       text not null default '',
  created_at timestamptz not null default now()
);

alter table public.entries enable row level security;

create policy "owner can read"   on public.entries for select using (auth.uid() = user_id);
create policy "owner can insert" on public.entries for insert with check (auth.uid() = user_id);
create policy "owner can update" on public.entries for update using (auth.uid() = user_id);
create policy "owner can delete" on public.entries for delete using (auth.uid() = user_id);

create index entries_user_start_idx on public.entries (user_id, start_at);
```

### 4.2 PostgREST grants (do not skip — recent platform change)

Supabase changed how tables are exposed through the auto-generated Data API. **New projects created after May 30, 2026 must add explicit Postgres grants for PostgREST access**, or queries silently return nothing. Add:

```sql
grant usage on schema public to authenticated;
grant select, insert, update, delete on public.entries to authenticated;
```

If reads come back empty despite rows existing, this grant is the first thing to check.

### 4.3 Auth

- Enable Email provider, magic-link sign-in.
- Restrict sign-ups (Supabase Auth settings) so only my email can create an account, or just don't share the URL. Either is fine for one user.

---

## 5. Environment / config

```
VITE_SUPABASE_URL=...        # from Supabase project settings → API
VITE_SUPABASE_ANON_KEY=...   # anon/public key (safe in client with RLS on)
```

Put these in Vercel project env vars and in a local `.env`. Never commit `.env`.

---

## 6. Data model & invariants

| Field | Type | Notes |
|---|---|---|
| `id` | uuid | server-generated |
| `user_id` | uuid | server-set to `auth.uid()` |
| `start_at` | timestamptz (UTC) | written the instant Clock In is tapped |
| `end_at` | timestamptz (UTC) \| null | `null` means the shift is open/running |
| `location` | enum-ish text | `main` / `other` / `meeting` / `remote` |
| `note` | text | optional |

**Hard invariants:**

1. **At most one open entry** (`end_at is null`) at a time. Clock In must be disabled/hidden while one exists.
2. **Start is persisted immediately on clock-in.** If the phone dies or the tab closes, the clock-in is already in Postgres. Nothing is held in client memory waiting for clock-out.
3. **`end_at` must be strictly after `start_at`** when set. Reject on save with a clear message.
4. An open entry whose `start_at` is on a **previous local day** is a *stale open shift* (a missed clock-out) and must be surfaced as a warning, not silently totaled.

---

## 7. Core business logic (build these as pure, tested functions)

These are the functions the XL bug check and smoke tests target. Keep them pure and isolated from React so they can be unit-tested directly.

```ts
// Round one entry's duration to the nearest 5 minutes.
export const round5 = (minutes: number): number => Math.round(minutes / 5) * 5;

export const minutesBetween = (startIso: string, endIso: string): number =>
  (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000;

// Decimal hours, 2 dp, as a STRING for display and as a number for Excel.
export const toHoursStr = (minutes: number): string => (minutes / 60).toFixed(2);
export const toHoursNum = (minutes: number): number => Number((minutes / 60).toFixed(2));

// Monday-start week. offset 0 = current week. Returns local Date at 00:00.
export function weekStart(offset = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = (d.getDay() + 6) % 7; // Mon=0 ... Sun=6
  d.setDate(d.getDate() - dow + offset * 7);
  return d;
}

// Local YYYY-MM-DD key — used for day bucketing. Must use LOCAL parts,
// never toISOString() (that's UTC and will misbucket evening entries).
export function localDateKey(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
```

**Totaling rule (must be implemented exactly this way):**

```
dayTotalMinutes  = sum over entries in that local day of round5(minutesBetween(start,end))
weekTotalMinutes = sum over the 7 day-totals
displayed hours  = (minutes / 60).toFixed(2)
```

Round **per entry first**, then sum. Open entries (`end_at` null) are excluded from all totals.

---

## 8. Functional requirements (screens & behavior)

### Today view
- Big status hero. If clocked in: a live running timer (HH:MM:SS, tabular numerals), the location, and "since {time}". If not: today's total decimal hours.
- When **off** the clock: a location picker (4 chips), then a green **Clock In · {location}** button.
- When **on** the clock: a **Clock Out** button.
- A list of today's entries (time range, location, note, rounded hours). Tap to edit.
- "+ Add entry" for after-the-fact entries.

### Week view
- Week navigator (‹ prev / next ›); can't go past the current week.
- Week total (decimal hours) up top.
- Per-day sections: each entry + a day subtotal.
- **Export this week** and **Export last 2 weeks** buttons.

### Edit / Add sheet
- Editable `start`, `end` (blank = still running), location, note.
- Save validates end > start.
- Delete (with the row present).

### Stale-open-shift banner
- If a stale open shift exists (§6.4), show an amber banner at top: "Open shift since {date} — looks like a missed clock-out. Tap to set the end time." Tapping opens that entry in the edit sheet.

### Empty states
- No entries today → "Nothing logged yet today." A day with none in the week view shows a dash. (Per the design guidance: empty states are direction, not mood.)

---

## 9. Excel export spec

One worksheet named `Hours`. Columns, in order:

| Date | Day | Start | End | Location | Hours |
|---|---|---|---|---|---|
| 2026-06-22 | Mon | 9:05 AM | 12:30 PM | Main office | 3.42 |

Rules:
- One row per **completed** entry (open shifts excluded), sorted by date then start time.
- After each day's rows, a subtotal row: blank cells, then `Day total` in the Location column, then the day's decimal hours in Hours.
- One blank row, then a final `WEEK TOTAL` row with the week's decimal hours.
- `Hours` cells are **numbers** (not strings) so they sum in Excel, formatted to 2 dp.
- Filename: `Hours_{YYYY-MM-DD of week start}.xlsx`.
- "Export last 2 weeks" spans 14 days ending on the currently viewed week; same layout, day subtotals throughout, with the trailing total covering the whole range.

---

## 10. XL Bug Check

When I say **"run the XL bug check,"** run it. In this project it specifically means validating the generated `.xlsx` against these invariants — verify each one against a real exported file, not just the on-screen numbers:

1. **Rows sum to day totals.** For every day, the `Hours` of its entry rows add up exactly to that day's `Day total` row.
2. **Day totals sum to the week total.** All `Day total` rows add up exactly to `WEEK TOTAL`.
3. **Rounding is per-entry-then-summed.** Confirm totals are *not* computed by rounding a raw sum. (Construct a case where the two methods differ — e.g. three 7-minute entries: per-entry → 5+5+5 = 15 min = 0.25; raw → 21 min rounded → 20 min = 0.33. The file must show 0.25.)
4. **Hours cells are numeric**, formatted to 2 dp — selecting them in Excel produces a working `SUM()`, not text concatenation.
5. **Day bucketing uses local time.** An entry at, say, 8:30 PM local lands on the correct local date, not the UTC date. (This is the classic `toISOString()` bug — test an evening entry.)
6. **Open shifts are excluded** from rows and totals entirely.
7. **Week boundaries are correct.** A Sunday-night entry belongs to that week; the following Monday starts the next week.
8. **Midnight-crossing entry** counts wholly on its start day.
9. **Empty days** don't produce phantom rows or break subtotaling.
10. **Filename** matches the week-start date.

Report any failure with the exact case that broke it.

---

## 11. Smoke tests

Two layers. Build both.

### 11.1 Unit tests (Vitest) — the pure logic in §7

These are cheap and catch the math bugs. Concrete cases:

- `round5`: 0→0, 2→0, 3→5, 7→5, 8→10, 32→30, 33→35.
- `minutesBetween`: 9:00→9:25 = 25; across DST boundary still correct (use fixed ISO strings).
- Totaling: three 7-min entries → 15 min → `0.25` hours (the per-entry-rounding proof from §10.3).
- `weekStart`: for a known Wednesday, returns that week's Monday at 00:00 local; offset −1 returns the prior Monday.
- `localDateKey`: an ISO string for 8:30 PM local returns the local date, and (in a non-UTC test timezone) differs from the UTC date — proves the evening-bucketing bug can't regress.

### 11.2 End-to-end smoke tests (Playwright) — the system works

Run against a Supabase test project (or a seeded local instance). Each is pass/fail:

1. **Sign in** via magic link (or a seeded session) and land on the Today view.
2. **Clock in** → an open entry exists in Postgres with `end_at` null; UI shows a running timer; Clock In is no longer offered.
3. **Clock out** → `end_at` is set; entry appears in today's list with rounded hours; Clock In returns.
4. **No double clock-in:** while running, there is no way to start a second entry.
5. **Crash safety:** clock in, reload the page mid-shift → the running shift is restored from the DB (not lost).
6. **Stale open shift:** seed an open entry dated yesterday → amber banner appears; fixing the end time clears it and the entry totals correctly.
7. **Edit:** change an entry's end time → today/week totals update to match.
8. **Validation:** setting end ≤ start is rejected with a visible message; nothing is saved.
9. **Add entry:** add a past entry → it appears on the correct day with correct hours.
10. **Delete:** remove an entry → it's gone from UI and DB; totals drop accordingly.
11. **Week math:** seed a known week of entries → on-screen week total equals the hand-calculated expected value.
12. **Export round-trip:** export the week, re-open the `.xlsx`, and assert the §10 XL bug check invariants programmatically (parse it with `xlsx` and check the sums + numeric types).
13. **RLS isolation:** a second test user cannot read the first user's rows.

### 11.3 Definition of done
All §11.1 and §11.2 tests pass, and the §10 XL bug check passes on a real exported file. Until then it's not done.

---

## 12. Deployment

1. Create the Supabase project; run §4.1, §4.2, configure §4.3 auth.
2. Add env vars (§5) locally and in Vercel.
3. `npm run build`; deploy to Vercel (static).
4. **PWA:** add `manifest.json` (name, icons, `display: standalone`, theme color) and a minimal service worker so it installs to the home screen. The UI shell should load offline; data ops require connectivity (acceptable — clock-in needs the DB).
5. **Keep-alive (important on free tier):** a free Supabase project **pauses after 7 consecutive days with no requests**, going offline until manually resumed in the dashboard. Daily use prevents this, but a long vacation could trigger it. Add a free scheduled GitHub Action that pings the project once a day:

```yaml
# .github/workflows/keepalive.yml
name: supabase-keepalive
on:
  schedule: [{ cron: "0 12 * * *" }]   # daily 12:00 UTC
  workflow_dispatch:
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -s -o /dev/null -w "%{http_code}\n" \
            "$SUPABASE_URL/rest/v1/entries?select=id&limit=1" \
            -H "apikey: $SUPABASE_ANON_KEY"
        env:
          SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          SUPABASE_ANON_KEY: ${{ secrets.SUPABASE_ANON_KEY }}
```

6. **Backups:** the free tier has **no automatic database backups.** Each weekly Excel export doubles as a snapshot of that week — keep them. Optionally add a periodic `pg_dump` via another GitHub Action later.

---

## 13. Out of scope / known limitations

- **No GPS/geofence auto clock-in.** Mobile browsers kill background location, so a PWA can't reliably auto-detect arriving at an office. This is deliberately tap-to-clock. (If true auto-detection ever becomes the priority over the custom export, the alternative is an off-the-shelf tool like Clockify, not this app.)
- **Single timezone assumption for display.** Storage is UTC so the math is safe across travel, but the UI shows the device's current local zone.
- **One user.** RLS and `user_id` are in place so multi-user is a small lift later, but it's not a goal now.

---

## 14. Reference prototype

A working React prototype already exists (`TimeClock.jsx`) with all of the above behavior except auth and Supabase — it uses a local storage shim behind a small `db` object. Treat it as the behavioral reference for UI and logic. The only real changes for production are: swap that `db` object for the Supabase client, add magic-link auth, and add the PWA shell. Keep the rounding, week math, totaling, and export logic identical to the prototype.
