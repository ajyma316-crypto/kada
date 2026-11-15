-- QADA, миграция 0002: инкрементальная синхронизация и удаление аккаунта.
-- Только ДОБАВЛЯЕТ колонки, индексы, триггеры и функцию. Существующие данные не удаляются.
-- Можно выполнять повторно (идемпотентна).

-- 1. Время последнего изменения записи. Ставит сервер (а не часы телефона),
--    поэтому синхронизация может запрашивать «всё, что изменилось после …».
alter table public.qada_logs   add column if not exists updated_at timestamptz not null default now();
alter table public.debt_events add column if not exists updated_at timestamptz not null default now();

create or replace function public.qada_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists qada_logs_touch on public.qada_logs;
create trigger qada_logs_touch
  before insert or update on public.qada_logs
  for each row execute function public.qada_touch_updated_at();

drop trigger if exists debt_events_touch on public.debt_events;
create trigger debt_events_touch
  before insert or update on public.debt_events
  for each row execute function public.qada_touch_updated_at();

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch
  before insert or update on public.profiles
  for each row execute function public.qada_touch_updated_at();

-- 2. Быстрая выборка изменений конкретного пользователя.
create index if not exists qada_logs_user_updated_idx   on public.qada_logs   (user_id, updated_at, id);
create index if not exists debt_events_user_updated_idx on public.debt_events (user_id, updated_at, id);

-- 3. Время сервера для курсора синхронизации (часы телефона могут быть неточными).
create or replace function public.qada_server_time()
returns timestamptz
language sql
stable
set search_path = ''
as $$ select now() $$;

revoke all on function public.qada_server_time() from public, anon;
grant execute on function public.qada_server_time() to authenticated;

-- 4. Удаление собственного аккаунта (требование App Store 5.1.1(v) и Google Play).
--    Удаляет пользователя из auth.users; его профиль, события и отметки удаляются
--    каскадно (внешние ключи on delete cascade). Удалить можно только СВОЙ аккаунт.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  delete from auth.users where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
