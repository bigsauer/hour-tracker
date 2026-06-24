# Hour Tracker (Time Clock)

Single-user PWA for tracking work hours, clock in/out with location tags, and weekly Excel export.

## Locked decisions

| Decision | Value |
|----------|-------|
| Users | One (me). Per-user RLS anyway for future multi-user. |
| Hosting | Vercel (Hobby/free) |
| Backend | Supabase (free tier) — Postgres + Auth, client talks directly with anon key + RLS |
| Cost | $0 recurring |
| Hours format | Decimal, 2 dp (e.g. `7.50`) |
| Rounding | Per entry to nearest 5 min, then sum — never round the total |
| Week | Monday 00:00 → Sunday 23:59 local |
| Clocking | Manual tap in/out — **no GPS/geofence** |
| Locations | Main office, Other office, Meeting, Remote |
| Time storage | UTC in DB, local display |
| Midnight rule | Entry counts on start day only (no split) |

## Stack

- Vite + React + TypeScript + Tailwind v4
- Supabase JS client (`@supabase/supabase-js`)
- SheetJS (`xlsx`) for client-side Excel export
- Vitest (unit) + Playwright (e2e)

## Supabase project

- Project ref: `aeatoiekrvcissjaciyk` (us-east-2)
- Migrations in `supabase/migrations/`
- PostgREST grants for `authenticated` are required (see handoff §4.2)

## Env vars

See `.env.example`. Never commit `.env`.

## Local dev

```bash
npm install
cp .env.example .env   # fill VITE_SUPABASE_* from Supabase dashboard or MCP
npm run dev
```

## Tests

```bash
npm test          # Vitest unit tests
npm run test:e2e  # Playwright (needs .env.test)
```

## XL bug check

When asked to "run the XL bug check", validate exported `.xlsx` against handoff §10 invariants (see `docs/timeclock-handoff.md`).
