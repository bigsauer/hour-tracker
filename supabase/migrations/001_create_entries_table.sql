create table public.entries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) default auth.uid(),
  start_at   timestamptz not null,
  end_at     timestamptz,
  location   text not null default 'main',
  note       text not null default '',
  created_at timestamptz not null default now()
);

alter table public.entries enable row level security;

create policy "owner can read" on public.entries
  for select using (auth.uid() = user_id);

create policy "owner can insert" on public.entries
  for insert with check (auth.uid() = user_id);

create policy "owner can update" on public.entries
  for update using (auth.uid() = user_id);

create policy "owner can delete" on public.entries
  for delete using (auth.uid() = user_id);

create index entries_user_start_idx on public.entries (user_id, start_at);
