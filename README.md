# Hour Tracker (On the Clock)

Personal time clock PWA: clock in/out with location tags, edit entries, export weekly hours to Excel.

## Stack

Vite + React + TypeScript, Supabase (Auth + Postgres), deployed on Vercel.

## Setup

1. **Supabase** — project with `entries` table and RLS (see `supabase/migrations/`).
2. **Env** — copy `.env.example` to `.env` and set:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. **Auth** — in Supabase dashboard: enable **Email** provider with password sign-in; turn off email confirmation for single-user instant login. Set `VITE_AUTH_PASSWORD` in `.env` (same value as the user's password in Supabase).

```bash
npm install
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Local dev server |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright (needs `.env.test` + service role key — see `e2e/README.md`) |
| `npm run build` | Production build |

## Troubleshooting

**Empty reads from Supabase but rows exist** — run grants migration `002_grant_entries_to_authenticated.sql`.

**Free tier pause** — Supabase pauses after 7 days idle; `keepalive` workflow pings daily (set GitHub secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`).

## Spec

Full product spec: [`docs/timeclock-handoff.md`](docs/timeclock-handoff.md).

## Deploy (Vercel)

Production URL: **https://hour-tracker-beta.vercel.app** (not `hour-tracker.vercel.app`).

1. Connect the GitHub repo.
2. Framework preset: **Vite** (or use `vercel.json` in repo).
3. Add **Production** and **Preview** environment variables (required at **build** time for Vite):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `VITE_AUTH_PASSWORD` (same value as local `.env`)
4. Redeploy after adding env vars (Vite bakes `VITE_*` into the bundle during build).

Without these, the app shows a configuration notice instead of a white screen.
