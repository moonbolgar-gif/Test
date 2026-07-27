-- Тест RLS. Проверяет инварианты docs/SPEC.md §9 и §3.3 под ролью authenticated.
--
-- Запуск: см. supabase/tests/README.md
--
-- Каждая проверка печатает PASS или FAIL. Ни одного FAIL быть не должно.
-- Тест намеренно написан без pgTAP, чтобы запускаться на голом psql.

\set ON_ERROR_STOP off
\set QUIET on
\pset tuples_only on
\pset format unaligned

begin;

-- ─── Фикстуры (под владельцем схемы, RLS не применяется) ────────────────────

insert into auth.users (id) values
  ('aaaaaaaa-0000-0000-0000-000000000001'),   -- Аня
  ('bbbbbbbb-0000-0000-0000-000000000002'),   -- Борис, в той же команде
  ('cccccccc-0000-0000-0000-000000000003');   -- Слава, посторонний

insert into profiles (id, display_name) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'Аня'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'Борис'),
  ('cccccccc-0000-0000-0000-000000000003', 'Слава');

insert into squads (id, owner_id, invite_code) values
  ('11111111-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001', 'JOIN01');

insert into squad_members (squad_id, user_id) values
  ('11111111-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('11111111-0000-0000-0000-00000000000a', 'bbbbbbbb-0000-0000-0000-000000000002');

-- Денежный будильник Ани, до срабатывания больше 30 минут.
insert into alarms (id, user_id, time_local, challenge_type, mode, stake_cents, next_fire_at)
values ('22222222-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
        '07:00', 'pattern', 'stake', 500, now() + interval '5 hours');

-- Денежный будильник Ани, до срабатывания 10 минут — по §15 заблокирован от удаления.
insert into alarms (id, user_id, time_local, challenge_type, mode, stake_cents, next_fire_at)
values ('22222222-0000-0000-0000-00000000000b', 'aaaaaaaa-0000-0000-0000-000000000001',
        '07:00', 'pattern', 'stake', 500, now() + interval '10 minutes');

-- Бесплатный будильник Ани, тоже через 10 минут — блокировка на него не распространяется.
insert into alarms (id, user_id, time_local, challenge_type, mode, next_fire_at)
values ('22222222-0000-0000-0000-00000000000c', 'aaaaaaaa-0000-0000-0000-000000000001',
        '07:00', 'pattern', 'free', now() + interval '10 minutes');

insert into alarm_runs (id, alarm_id, user_id, scheduled_for, status, challenge_type, mode, stake_cents)
values ('33333333-0000-0000-0000-00000000000a', '22222222-0000-0000-0000-00000000000a',
        'aaaaaaaa-0000-0000-0000-000000000001', now(), 'scheduled', 'pattern', 'stake', 500);

insert into stakes (id, alarm_run_id, user_id, amount_cents, idempotency_key)
values ('44444444-0000-0000-0000-00000000000a', '33333333-0000-0000-0000-00000000000a',
        'aaaaaaaa-0000-0000-0000-000000000001', 500, 'test-key-1');

insert into ledger_entries (stake_id, bucket, amount_cents) values
  ('44444444-0000-0000-0000-00000000000a', 'platform', 250);

-- ─── Хелпер проверки ─────────────────────────────────────────────────────────

create or replace function check_eq(label text, actual anyelement, expected anyelement)
returns void language plpgsql as $$
begin
  if actual is not distinct from expected then
    raise notice 'PASS  %', label;
  else
    raise warning 'FAIL  % — ожидалось %, получено %', label, expected, actual;
  end if;
end;
$$;

-- Проверяет, что запрос падает (т.е. операция запрещена).
create or replace function check_denied(label text, stmt text)
returns void language plpgsql as $$
begin
  execute stmt;
  raise warning 'FAIL  % — операция прошла, хотя должна была быть запрещена', label;
exception when others then
  raise notice 'PASS  % (% )', label, sqlstate;
end;
$$;

-- ─── Работаем от лица Ани ────────────────────────────────────────────────────

set local role authenticated;
set local request.jwt.claim.sub = 'aaaaaaaa-0000-0000-0000-000000000001';

select check_eq('Аня видит только свои будильники',
  (select count(*)::int from alarms), 3);

select check_eq('Аня видит свою ставку',
  (select count(*)::int from stakes), 1);

select check_eq('Аня видит свою запись в ledger',
  (select count(*)::int from ledger_entries), 1);

select check_eq('Аня видит себя и сокомандника, но не постороннего',
  (select count(*)::int from profiles), 2);

select check_eq('app_settings отдаёт только публичные ключи (feature_flags скрыт)',
  (select count(*)::int from app_settings), 2);

-- §3.3 / §9: клиент не может писать в денежные таблицы ни при каких условиях.
select check_denied('клиент не может вставить ledger_entry',
  $$insert into ledger_entries (stake_id, bucket, amount_cents)
    values ('44444444-0000-0000-0000-00000000000a', 'platform', 999999)$$);

select check_denied('клиент не может изменить статус своей ставки',
  $$update stakes set status = 'released'
    where id = '44444444-0000-0000-0000-00000000000a'$$);

select check_denied('клиент не может выдать себе ваучер',
  $$insert into vouchers (user_id, brand, amount_cents, code, source)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'Spotify', 500, 'FREE', 'partner')$$);

select check_denied('клиент не может начислить себе деревья',
  $$insert into impact_ledger (user_id, source, trees)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'wakes', 1000)$$);

select check_denied('клиент не может выдать себе подписку RISE+',
  $$insert into subscriptions (user_id, platform, product_id, status)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'ios', 'rise_plus_yearly', 'active')$$);

select check_denied('клиент не может подделать alarm_run',
  $$insert into alarm_runs (alarm_id, user_id, scheduled_for, status, challenge_type, mode)
    values ('22222222-0000-0000-0000-00000000000a', 'aaaaaaaa-0000-0000-0000-000000000001',
            now(), 'completed', 'pattern', 'free')$$);

-- §15: блокировка денежного будильника за 30 минут до срабатывания.
delete from alarms where id = '22222222-0000-0000-0000-00000000000b';
select check_eq('денежный будильник за 10 мин до срабатывания не удаляется (§15)',
  (select count(*)::int from alarms where id = '22222222-0000-0000-0000-00000000000b'), 1);

delete from alarms where id = '22222222-0000-0000-0000-00000000000c';
select check_eq('бесплатный будильник за 10 мин удаляется свободно',
  (select count(*)::int from alarms where id = '22222222-0000-0000-0000-00000000000c'), 0);

delete from alarms where id = '22222222-0000-0000-0000-00000000000a';
select check_eq('денежный будильник за 5 часов до срабатывания удаляется',
  (select count(*)::int from alarms where id = '22222222-0000-0000-0000-00000000000a'), 0);

-- ─── Работаем от лица постороннего ───────────────────────────────────────────

set local request.jwt.claim.sub = 'cccccccc-0000-0000-0000-000000000003';

select check_eq('посторонний не видит чужих будильников',
  (select count(*)::int from alarms), 0);

select check_eq('посторонний не видит чужих ставок',
  (select count(*)::int from stakes), 0);

select check_eq('посторонний не видит чужой ledger',
  (select count(*)::int from ledger_entries), 0);

select check_eq('посторонний не видит чужую команду',
  (select count(*)::int from squads), 0);

select check_eq('посторонний видит только себя',
  (select count(*)::int from profiles), 1);

-- ─── Сокомандник ─────────────────────────────────────────────────────────────

set local request.jwt.claim.sub = 'bbbbbbbb-0000-0000-0000-000000000002';

select check_eq('сокомандник видит команду',
  (select count(*)::int from squads), 1);

select check_eq('сокомандник видит профиль Ани, но не Славы',
  (select count(*)::int from profiles), 2);

select check_eq('сокомандник не видит ставок Ани',
  (select count(*)::int from stakes), 0);

-- ─── Удаление аккаунта (§14.4) не должно уничтожать финансовые записи ────────
-- Требование сторов — удаление аккаунта из приложения. Требование бухгалтерии —
-- сохранность истории платежей. Ставка обезличивается, но остаётся; ledger цел.

reset role;
reset request.jwt.claim.sub;

delete from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001';

select check_eq('профиль Ани удалён',
  (select count(*)::int from profiles where id = 'aaaaaaaa-0000-0000-0000-000000000001'), 0);

select check_eq('ставка пережила удаление аккаунта',
  (select count(*)::int from stakes where id = '44444444-0000-0000-0000-00000000000a'), 1);

select check_eq('ставка обезличена',
  (select user_id from stakes where id = '44444444-0000-0000-0000-00000000000a'), null::uuid);

select check_eq('запись в ledger цела',
  (select amount_cents from ledger_entries
   where stake_id = '44444444-0000-0000-0000-00000000000a'), 250);

rollback;
