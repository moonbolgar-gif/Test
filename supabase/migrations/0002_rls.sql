-- RISE — Row Level Security. Источник: docs/SPEC.md §9 («RLS обязательно»).
--
-- Модель доступа:
--   - пользователь видит и меняет только свои записи;
--   - записи команды видны только её участникам;
--   - денежные таблицы (stakes, ledger_entries) — read-only для клиента; запись только
--     через SECURITY DEFINER-функции. Прямой insert/update с клиента запрещён (§9, §3.3).
--
-- Важно: RLS не применяется к владельцу таблицы и к ролям с BYPASSRLS. Edge Functions
-- ходят под service_role, который в Supabase имеет BYPASSRLS — это и есть канал записи
-- для серверной денежной логики.

-- ─────────────────────────────────────────────────────────────────────────────
-- Хелперы
-- ─────────────────────────────────────────────────────────────────────────────

-- SECURITY DEFINER, иначе проверка членства в команде сама попадёт под RLS
-- на squad_members и уйдёт в бесконечную рекурсию.
create or replace function is_squad_member(target_squad_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from squad_members
    where squad_id = target_squad_id and user_id = auth.uid()
  );
$$;

-- Команда текущего пользователя (§7.7 — в MVP ровно одна).
create or replace function current_squad_id()
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select squad_id from squad_members where user_id = auth.uid() limit 1;
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- Включаем RLS на всех таблицах без исключений
-- ─────────────────────────────────────────────────────────────────────────────

alter table profiles           enable row level security;
alter table squads             enable row level security;
alter table squad_members      enable row level security;
alter table alarms             enable row level security;
alter table alarm_runs         enable row level security;
alter table activity_events    enable row level security;
alter table activity_reactions enable row level security;
alter table stakes             enable row level security;
alter table ledger_entries     enable row level security;
alter table disputes           enable row level security;
alter table vouchers           enable row level security;
alter table impact_ledger      enable row level security;
alter table subscriptions      enable row level security;
alter table app_settings       enable row level security;

-- ─────────────────────────────────────────────────────────────────────────────
-- PROFILES
-- Профили сокомандников видны — иначе не отрисовать ленту и лидерборд (§6.14).
-- ─────────────────────────────────────────────────────────────────────────────

create policy profiles_select_self_or_squad on profiles
  for select using (
    id = auth.uid()
    or exists (
      select 1 from squad_members m
      where m.user_id = profiles.id and m.squad_id = current_squad_id()
    )
  );

create policy profiles_update_self on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- Insert профиля делает триггер на auth.users под service_role, не клиент.

-- ─────────────────────────────────────────────────────────────────────────────
-- SQUADS
-- ─────────────────────────────────────────────────────────────────────────────

create policy squads_select_members on squads
  for select using (is_squad_member(id));

create policy squads_insert_self_owned on squads
  for insert with check (owner_id = auth.uid());

create policy squads_update_owner on squads
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy squads_delete_owner on squads
  for delete using (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- SQUAD_MEMBERS
-- ─────────────────────────────────────────────────────────────────────────────

create policy squad_members_select_same_squad on squad_members
  for select using (is_squad_member(squad_id));

-- Вступление по инвайту идёт через Edge Function (§10 POST /squads/join/:code),
-- которая проверяет код и срок. Клиент может добавить только сам себя.
create policy squad_members_insert_self on squad_members
  for insert with check (user_id = auth.uid());

-- Выйти может сам участник; исключить — владелец команды (§7.7).
create policy squad_members_delete_self_or_owner on squad_members
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from squads s where s.id = squad_id and s.owner_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- ALARMS
-- §4.2/§15: запрет на изменение и удаление денежного будильника менее чем за 30 минут
-- до срабатывания — иначе пользователь просто удалит будильник, чтобы не платить.
-- Правило живёт в RLS, а не только в API: обойти его через PostgREST не должно быть можно.
-- ─────────────────────────────────────────────────────────────────────────────

create policy alarms_select_own on alarms
  for select using (user_id = auth.uid());

create policy alarms_insert_own on alarms
  for insert with check (user_id = auth.uid());

create policy alarms_update_own_unless_locked on alarms
  for update using (
    user_id = auth.uid()
    and (
      mode = 'free'
      or next_fire_at is null
      or next_fire_at - now() > interval '30 minutes'
    )
  ) with check (user_id = auth.uid());

create policy alarms_delete_own_unless_locked on alarms
  for delete using (
    user_id = auth.uid()
    and (
      mode = 'free'
      or next_fire_at is null
      or next_fire_at - now() > interval '30 minutes'
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- ALARM_RUNS
-- Клиент читает свои срабатывания, но не создаёт и не меняет их: переходы статусов
-- и валидацию 5-минутного окна делает сервер (§7.1, §4.2).
-- ─────────────────────────────────────────────────────────────────────────────

create policy alarm_runs_select_own on alarm_runs
  for select using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- ЛЕНТА АКТИВНОСТИ (§6.14)
-- ─────────────────────────────────────────────────────────────────────────────

create policy activity_events_select_squad on activity_events
  for select using (is_squad_member(squad_id));

-- События порождает сервер по итогам alarm_run, а не клиент.

create policy activity_reactions_select_squad on activity_reactions
  for select using (
    exists (
      select 1 from activity_events e
      where e.id = event_id and is_squad_member(e.squad_id)
    )
  );

create policy activity_reactions_insert_self on activity_reactions
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from activity_events e
      where e.id = event_id and is_squad_member(e.squad_id)
    )
  );

create policy activity_reactions_delete_self on activity_reactions
  for delete using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- ДЕНЬГИ — ТОЛЬКО ЧТЕНИЕ ДЛЯ КЛИЕНТА (§9, §3.3)
-- Ни одной insert/update/delete-политики. Любая запись — только service_role
-- из Edge Functions. Отсутствие политики при включённом RLS = запрет.
-- ─────────────────────────────────────────────────────────────────────────────

create policy stakes_select_own on stakes
  for select using (user_id = auth.uid());

create policy ledger_entries_select_own on ledger_entries
  for select using (
    exists (select 1 from stakes s where s.id = stake_id and s.user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- DISPUTES (§14.3)
-- Создать оспаривание пользователь может сам; решение принимает только сервер.
-- ─────────────────────────────────────────────────────────────────────────────

create policy disputes_select_own on disputes
  for select using (user_id = auth.uid());

create policy disputes_insert_own on disputes
  for insert with check (
    user_id = auth.uid()
    and status = 'open'
    and exists (select 1 from stakes s where s.id = stake_id and s.user_id = auth.uid())
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- VOUCHERS (§7.6)
-- Выдаёт сервер. Погашение и обмен — через Edge Functions, чтобы клиент не мог
-- сам перевести ваучер в статус exchanged и получить дни подписки.
-- ─────────────────────────────────────────────────────────────────────────────

create policy vouchers_select_own on vouchers
  for select using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- IMPACT (§7.5) и ПОДПИСКИ (§8.4) — только чтение своих записей
-- ─────────────────────────────────────────────────────────────────────────────

create policy impact_ledger_select_own on impact_ledger
  for select using (user_id = auth.uid());

create policy subscriptions_select_own on subscriptions
  for select using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────────────────────
-- APP_SETTINGS (§8.2)
-- Клиенту нужен только stake_split и service_fee, чтобы отрисовать разбивку в §6.6,
-- не хардкодя доли. Остальные ключи (в т.ч. feature_flags) не отдаём.
-- ─────────────────────────────────────────────────────────────────────────────

create policy app_settings_select_public on app_settings
  for select using (key in ('stake_split', 'service_fee'));

-- ─────────────────────────────────────────────────────────────────────────────
-- ГРАНТЫ — вторая линия обороны поверх RLS
--
-- RLS при отсутствии политики уже запрещает операцию, но полагаться только на неё
-- рискованно: любая будущая политика, добавленная невнимательно, немедленно откроет
-- запись. Денежным таблицам право записи не выдаётся в принципе, поэтому ошибка
-- в политике не превращается в возможность списать или начислить деньги с клиента.
-- ─────────────────────────────────────────────────────────────────────────────

grant usage on schema public to anon, authenticated;

grant select on
  profiles, squads, squad_members, alarms, alarm_runs,
  activity_events, activity_reactions, stakes, ledger_entries,
  disputes, vouchers, impact_ledger, subscriptions, app_settings
  to authenticated;

grant insert, update, delete on alarms to authenticated;
grant insert, delete on squad_members, activity_reactions to authenticated;
grant insert, update, delete on squads to authenticated;
grant update on profiles to authenticated;
grant insert on disputes to authenticated;

-- Денежные и начисляемые сервером таблицы: запись только под service_role.
revoke insert, update, delete on
  stakes, ledger_entries, vouchers, impact_ledger,
  subscriptions, alarm_runs, activity_events, app_settings
  from anon, authenticated;
