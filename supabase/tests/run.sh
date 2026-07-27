#!/usr/bin/env bash
#
# Прогон теста RLS на одноразовой базе. docs/SPEC.md §9.
#
# Тест намеренно не требует Supabase CLI и Docker: ему нужен только локальный
# Postgres. Схема auth, которую в Supabase предоставляет платформа, здесь
# создаётся заглушкой — минимум, от которого зависят миграции.
#
# Переменные окружения:
#   PGDATABASE_TEST  имя тестовой базы (по умолчанию rise_rls_test)
#   PSQL             команда psql с правами на создание баз
#                    (по умолчанию: su postgres -c psql)

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DB="${PGDATABASE_TEST:-rise_rls_test}"

run_sql() {
  if [[ -n "${PSQL:-}" ]]; then
    $PSQL "$@"
  else
    su postgres -c "psql $*"
  fi
}

echo "==> пересоздаю базу $DB"
run_sql -q -c "\"drop database if exists $DB\"" >/dev/null
run_sql -q -c "\"create database $DB\"" >/dev/null

echo "==> заглушка схемы auth (в Supabase её даёт платформа)"
run_sql -q -d "$DB" \
  -c "\"create extension if not exists pgcrypto\"" \
  -c "\"create schema auth\"" \
  -c "\"create table auth.users (id uuid primary key default gen_random_uuid(), email text)\"" \
  -c "\"create function auth.uid() returns uuid language sql stable as \\\$\\\$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid \\\$\\\$\"" \
  >/dev/null

# Роли Supabase. Могут уже существовать — они кластерные, а не per-database.
run_sql -q -d "$DB" -c "\"do \\\$\\\$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
end \\\$\\\$\"" >/dev/null

for migration in "$ROOT"/supabase/migrations/*.sql; do
  echo "==> миграция $(basename "$migration")"
  run_sql -v ON_ERROR_STOP=1 -q -d "$DB" < "$migration"
done

echo "==> тест RLS"
output="$(run_sql -d "$DB" < "$ROOT/supabase/tests/rls_test.sql" 2>&1)"
echo "$output" | grep -E 'PASS|FAIL' || true

failures="$(echo "$output" | grep -cE 'FAIL' || true)"
errors="$(echo "$output" | grep -cE '^ERROR' || true)"
passes="$(echo "$output" | grep -cE 'PASS' || true)"

echo
echo "пройдено: $passes, провалено: $failures, ошибок: $errors"

if [[ "$failures" -ne 0 || "$errors" -ne 0 ]]; then
  echo "$output"
  exit 1
fi
