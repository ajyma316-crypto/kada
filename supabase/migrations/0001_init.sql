-- QADA: схема базы данных Supabase.
-- Каждая строка принадлежит пользователю; Row Level Security гарантирует,
-- что пользователь видит и изменяет только свои данные.

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  settings   jsonb,
  plan       jsonb,
  calc       jsonb,
  updated_at timestamptz not null default now()
);

-- Изменения задолженности (результат расчёта, ручные корректировки). Только добавление.
create table if not exists public.debt_events (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null,
  kind       text not null check (kind in ('calculation', 'manual')),
  deltas     jsonb not null,
  note       text
);
create index if not exists debt_events_user_idx on public.debt_events (user_id, created_at);

-- Восполненные намазы. Отмена — заполнение voided_at, записи не удаляются.
create table if not exists public.qada_logs (
  id         uuid primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  prayer     text not null check (prayer in ('fajr','dhuhr','asr','maghrib','isha','witr')),
  count      integer not null check (count > 0 and count <= 10000),
  created_at timestamptz not null,
  voided_at  timestamptz
);
create index if not exists qada_logs_user_idx on public.qada_logs (user_id, created_at);

alter table public.profiles    enable row level security;
alter table public.debt_events enable row level security;
alter table public.qada_logs   enable row level security;

create policy "own profile" on public.profiles
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own debt events" on public.debt_events
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own logs" on public.qada_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Удалять записи учёта нельзя (только отмечать отменёнными) — защита истории.
revoke delete on public.qada_logs from authenticated;
revoke delete on public.debt_events from authenticated;
