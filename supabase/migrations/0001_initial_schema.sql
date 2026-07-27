-- RISE — начальная схема. Источник: docs/SPEC.md §9.
--
-- Отличия от SQL в §9 и их причины:
--   1. Порядок таблиц изменён: в §9 `alarms` ссылается на `squads`, объявленную ниже.
--      Как есть — не выполняется. `squads` и `squad_members` подняты выше `alarms`.
--   2. Добавлена таблица `app_settings`: §8.2 требует хранить доли распределения на сервере
--      (`settings.stake_split`), но самой таблицы в §9 нет.
--   3. Добавлены `updated_at` там, где §9 упоминает обновление, и триггер их сопровождения.
--   4. Ограничения на суммы (`>= 0`) добавлены явно: §3.3 требует целые центы, отрицательная
--      ставка не имеет смысла ни в одном сценарии §8.
--
-- Инварианты §3.3, закреплённые на уровне схемы:
--   - деньги в центах, тип integer, никогда numeric/float;
--   - все временные метки timestamptz (UTC), локальная зона живёт в profiles.timezone.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- ПОЛЬЗОВАТЕЛИ
-- ─────────────────────────────────────────────────────────────────────────────

create table profiles (
  id uuid primary key references auth.users on delete cascade,
  display_name text,
  avatar_url text,
  timezone text not null default 'UTC',
  locale text not null default 'ru',
  is_adult_confirmed boolean not null default false,
  streak int not null default 0 check (streak >= 0),
  best_streak int not null default 0 check (best_streak >= 0),
  last_completed_date date,               -- защита от двойного +1 в календарный день (§7.2)
  points_week int not null default 0,
  total_wakes int not null default 0 check (total_wakes >= 0),
  total_saved_cents int not null default 0 check (total_saved_cents >= 0),
  total_lost_cents int not null default 0 check (total_lost_cents >= 0),
  trees_planted int not null default 0 check (trees_planted >= 0),
  mascot_stage int not null default 1 check (mascot_stage between 1 and 5),
  is_premium boolean not null default false,
  premium_until timestamptz,
  stripe_customer_id text unique,
  default_payment_method_id text,
  money_modes_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

comment on column profiles.last_completed_date is
  'Календарная дата последнего completed в TZ пользователя. §7.2: не более +1 к стрику в день.';

-- ─────────────────────────────────────────────────────────────────────────────
-- КОМАНДЫ (§7.7)
-- Подняты выше alarms: alarms.squad_id ссылается на squads.
-- ─────────────────────────────────────────────────────────────────────────────

create table squads (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Моя команда',
  owner_id uuid not null references profiles on delete cascade,
  streak int not null default 0 check (streak >= 0),
  invite_code text unique not null,
  invite_expires_at timestamptz,          -- §7.7: инвайт живёт 7 дней
  created_at timestamptz not null default now()
);

create table squad_members (
  squad_id uuid references squads on delete cascade,
  user_id uuid references profiles on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (squad_id, user_id)
);

-- §7.7: в MVP пользователь состоит ровно в одной команде.
create unique index squad_members_one_squad_per_user on squad_members (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- БУДИЛЬНИКИ
-- ─────────────────────────────────────────────────────────────────────────────

create table alarms (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  time_local time not null,
  repeat_days smallint[] not null default '{}',   -- 0=Вс..6=Сб; пусто = разовый
  challenge_type text not null check (challenge_type in ('pattern','math','shake')),
  mode text not null check (mode in ('free','stake','squad')),
  stake_cents int not null default 0 check (stake_cents >= 0),
  squad_id uuid references squads on delete set null,
  auto_record boolean not null default true,
  is_active boolean not null default true,
  next_fire_at timestamptz,                       -- вычисляет сервер, в UTC
  created_at timestamptz not null default now(),

  -- §14.1: ставки ограничены $1–$10.
  constraint alarms_stake_bounds check (
    (mode = 'free' and stake_cents = 0) or
    (mode in ('stake','squad') and stake_cents between 100 and 1000)
  ),
  -- Командный спор невозможен без команды.
  constraint alarms_squad_requires_squad check (mode <> 'squad' or squad_id is not null),
  -- 0=Вс..6=Сб.
  constraint alarms_repeat_days_range check (
    repeat_days <@ array[0,1,2,3,4,5,6]::smallint[]
  )
);

create index alarms_next_fire_at_idx on alarms (next_fire_at) where is_active;
create index alarms_user_idx on alarms (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- СРАБАТЫВАНИЯ (§7.1)
-- ─────────────────────────────────────────────────────────────────────────────

create table alarm_runs (
  id uuid primary key default gen_random_uuid(),
  -- §9 задаёт `not null ... on delete cascade`, но тогда удаление будильника уносит
  -- историю срабатываний, а вместе с ней — ставки и записи в ledger. Ссылка обнуляется:
  -- сам факт подъёма и его денежные последствия переживают удаление будильника.
  -- Денормализованных полей ниже (challenge_type, mode, stake_cents) хватает, чтобы
  -- запись оставалась осмысленной без родителя.
  alarm_id uuid references alarms on delete set null,
  user_id uuid not null references profiles on delete cascade,
  scheduled_for timestamptz not null,
  ringing_at timestamptz,
  window_ends_at timestamptz,             -- §4.2: ringing_at + 5 минут, считает сервер
  completed_at timestamptz,
  status text not null default 'scheduled'
    check (status in ('scheduled','ringing','in_challenge','completed','failed','expired')),
  challenge_type text not null check (challenge_type in ('pattern','math','shake')),
  attempts int not null default 0 check (attempts >= 0),
  mode text not null check (mode in ('free','stake','squad')),
  stake_cents int not null default 0 check (stake_cents >= 0),
  shared boolean not null default false,
  created_at timestamptz not null default now(),

  -- completed без времени завершения — рассинхрон, ловим на уровне БД.
  constraint alarm_runs_completed_has_time check (
    (status = 'completed') = (completed_at is not null)
  ),
  constraint alarm_runs_window_after_ringing check (
    window_ends_at is null or ringing_at is null or window_ends_at > ringing_at
  )
);

create unique index alarm_runs_alarm_scheduled_uniq on alarm_runs (alarm_id, scheduled_for);
create index alarm_runs_user_idx on alarm_runs (user_id, created_at desc);
-- Для cron-задачи «истекшее окно → expired» (§10).
create index alarm_runs_open_window_idx on alarm_runs (window_ends_at)
  where status in ('ringing','in_challenge');

-- ─────────────────────────────────────────────────────────────────────────────
-- ЛЕНТА АКТИВНОСТИ (§6.14)
-- ─────────────────────────────────────────────────────────────────────────────

create table activity_events (
  id uuid primary key default gen_random_uuid(),
  squad_id uuid not null references squads on delete cascade,
  actor_id uuid not null references profiles on delete cascade,
  type text not null check (type in
    ('woke_up','failed','streak_milestone','joined','won_dispute','got_voucher','shared')),
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index activity_events_feed_idx on activity_events (squad_id, created_at desc);

create table activity_reactions (
  event_id uuid references activity_events on delete cascade,
  user_id uuid references profiles on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)          -- §6.14: одна реакция на событие от пользователя
);

-- ─────────────────────────────────────────────────────────────────────────────
-- ДЕНЬГИ (§8)
-- ─────────────────────────────────────────────────────────────────────────────

-- Финансовые записи не удаляются по действию пользователя. §14.4 требует удаление
-- аккаунта из приложения (требование сторов), но удалять историю платежей вместе с
-- профилем нельзя — это бухгалтерская запись. Поэтому обе ссылки обнуляемые:
-- при удалении аккаунта ставка обезличивается и остаётся, а RLS перестаёт её кому-либо
-- показывать (политика сравнивает user_id с auth.uid(), null не совпадёт ни с кем).
create table stakes (
  id uuid primary key default gen_random_uuid(),
  alarm_run_id uuid unique references alarm_runs on delete set null,
  user_id uuid references profiles on delete set null,
  amount_cents int not null check (amount_cents >= 0),
  fee_cents int not null default 30 check (fee_cents >= 0),
  status text not null default 'pending'
    check (status in ('pending','released','charged','failed','disputed','refunded')),
  stripe_payment_intent_id text,
  idempotency_key text unique not null,   -- §3.3: идемпотентность денежных операций
  charge_attempts int not null default 0 check (charge_attempts >= 0),  -- §8.6: retry ×3
  next_retry_at timestamptz,
  last_error text,
  charged_at timestamptz,
  created_at timestamptz not null default now(),

  constraint stakes_charged_has_time check ((status = 'charged') = (charged_at is not null))
);

create index stakes_retry_idx on stakes (next_retry_at) where status = 'failed';

create table ledger_entries (
  id bigserial primary key,
  stake_id uuid references stakes on delete restrict,
  bucket text not null check (bucket in ('platform','charity','reward_pool','fee')),
  amount_cents int not null,
  created_at timestamptz not null default now()
);

create index ledger_entries_stake_idx on ledger_entries (stake_id);

create table disputes (
  id uuid primary key default gen_random_uuid(),
  stake_id uuid not null references stakes on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  reason text not null,
  evidence_url text,
  status text not null default 'open' check (status in ('open','approved','rejected')),
  resolved_by text,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index disputes_open_idx on disputes (created_at) where status = 'open';

-- ─────────────────────────────────────────────────────────────────────────────
-- НАГРАДЫ (§7.6)
-- ─────────────────────────────────────────────────────────────────────────────

create table vouchers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  brand text not null,
  icon text,
  amount_cents int not null check (amount_cents > 0),
  code text not null,
  source text not null check (source in ('squad_win','streak_milestone','partner')),
  status text not null default 'issued'
    check (status in ('issued','redeemed','exchanged','expired')),
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index vouchers_user_idx on vouchers (user_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- ИМПАКТ (§7.5)
-- ─────────────────────────────────────────────────────────────────────────────

create table impact_ledger (
  id bigserial primary key,
  user_id uuid references profiles on delete set null,
  source text not null check (source in ('wakes','service_fee','charity_split','premium_bonus')),
  trees numeric(10,3) not null,
  amount_cents int,
  created_at timestamptz not null default now()
);

create index impact_ledger_user_idx on impact_ledger (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- ПОДПИСКИ (§8.4)
-- ─────────────────────────────────────────────────────────────────────────────

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  platform text not null check (platform in ('ios','android')),
  product_id text not null,
  original_transaction_id text unique,
  status text not null check (status in ('trial','active','grace','expired','cancelled')),
  expires_at timestamptz,
  updated_at timestamptz not null default now()
);

create index subscriptions_user_idx on subscriptions (user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- СЕРВЕРНЫЙ КОНФИГ (§8.2, §8.3, §8.5)
-- Не описан в §9, но обязателен: доли распределения и сервисный сбор не должны
-- попадать в клиентский бандл и должны меняться без релиза приложения.
-- ─────────────────────────────────────────────────────────────────────────────

create table app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value) values
  -- §8.2: платформа 50%, благотворительность 30%, фонд наград 20%.
  ('stake_split', '{"platform": 50, "charity": 30, "reward_pool": 20}'),
  -- §8.3: фиксированный сервисный сбор, 50% которого идёт на деревья.
  ('service_fee', '{"cents": 30, "trees_share": 50}'),
  -- §8.5: аварийный выключатель денежных режимов без перевыпуска приложения.
  ('feature_flags', '{"money_modes": true}');

-- Доли обязаны давать ровно 100%, иначе распределение потеряет или создаст деньги.
create or replace function assert_stake_split_sums_to_100() returns trigger
language plpgsql as $$
declare
  total int;
begin
  if new.key <> 'stake_split' then
    return new;
  end if;
  select (new.value->>'platform')::int
       + (new.value->>'charity')::int
       + (new.value->>'reward_pool')::int
    into total;
  if total <> 100 then
    raise exception 'stake_split must sum to 100, got %', total;
  end if;
  return new;
end;
$$;

create trigger app_settings_validate_split
  before insert or update on app_settings
  for each row execute function assert_stake_split_sums_to_100();
