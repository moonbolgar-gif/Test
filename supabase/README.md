# Бэкенд RISE

Схема, RLS и Edge Functions. Источник требований — [`../docs/SPEC.md`](../docs/SPEC.md).

```
migrations/   SQL-миграции, применяются по возрастанию номера
functions/    Edge Functions (Deno)
  _shared/    общий код: денежная арифметика, клиент Stripe, проверка подписи
tests/        тест RLS на голом psql
```

## Тесты

```bash
npm run test          # всё
npm run test:money    # денежная арифметика + подпись вебхуков (Node, 31 тест)
npm run test:rls      # RLS на одноразовой базе Postgres (26 проверок)
```

`test:rls` требует локальный Postgres и права на создание баз. Supabase CLI и Docker
не нужны: схема `auth`, которую в Supabase даёт платформа, создаётся заглушкой.

`test:money` использует встроенный тест-раннер Node и `--experimental-strip-types`.
Модули в `_shared/` намеренно написаны на чистом TypeScript без Deno-специфичных API,
поэтому один и тот же код исполняется в Edge Functions (Deno) и в тестах (Node).

## Миграции

| Файл | Содержимое |
|---|---|
| `0001_initial_schema.sql` | Таблицы по §9 + `app_settings` |
| `0002_rls.sql` | RLS-политики и гранты |
| `0003_functions.sql` | Серверные функции денежного контура |

Отличия от SQL, приведённого в §9, перечислены в шапке `0001_initial_schema.sql`
и обоснованы в [`../docs/DECISIONS.md`](../docs/DECISIONS.md) (ADR-008, ADR-009).

## Переменные окружения

| Переменная | Назначение |
|---|---|
| `SUPABASE_URL` | URL проекта |
| `SUPABASE_SERVICE_ROLE_KEY` | Ключ service_role. Только для Edge Functions, никогда в клиент |
| `STRIPE_SECRET_KEY` | Секретный ключ Stripe (`sk_test_…` в тестовом режиме) |
| `STRIPE_WEBHOOK_SECRET` | Секрет подписи вебхука (`whsec_…`) |

---

## Статус Спайка 4 (§17)

DoD спайка — доказать, что связка SetupIntent + off-session списание работает
в тестовом режиме Stripe, включая 3DS.

**Проверено здесь:**

- [x] Арифметика распределения: сумма частей всегда равна списанному, на всех суммах
      диапазона §14.1 и за его пределами. 18 тестов.
- [x] Проверка подписи вебхука: подделка тела, чужой секрет, пустой секрет, повтор
      устаревшего сообщения, перенос подписи на другое время, ротация секрета. 13 тестов.
- [x] Схема и RLS на реальном Postgres: клиент не может писать в `stakes`,
      `ledger_entries`, `vouchers`, `impact_ledger`, `subscriptions`, `alarm_runs`;
      удаление аккаунта не уничтожает финансовые записи. 26 проверок.

**Не проверено — требует ключей Stripe и развёрнутого проекта Supabase:**

- [ ] Реальный `SetupIntent` и привязка карты `4242 4242 4242 4242`.
- [ ] Реальное off-session списание и приход `payment_intent.succeeded`.
- [ ] Отказ по карте `4000 0000 0000 0002` → ветка ретраев §8.6.
- [ ] 3DS по карте `4000 0025 0000 3155` → `requires_action` и экран подтверждения.
- [ ] Идемпотентность против настоящего Stripe: повтор запроса с тем же
      `Idempotency-Key` не должен списать дважды.

Пока эти пункты не закрыты, **Спайк 4 не считается пройденным**. Код Edge Functions
написан, но ни разу не исполнялся: в этом окружении нет ни Deno, ни ключей Stripe.

### Как закрыть остаток

```bash
supabase start
supabase db reset                     # применит migrations/
supabase secrets set STRIPE_SECRET_KEY=sk_test_… STRIPE_WEBHOOK_SECRET=whsec_…
supabase functions serve
stripe listen --forward-to localhost:54321/functions/v1/stripe-webhook
```

Дальше — прогнать четыре тестовые карты из §13.1 и отметить чекбоксы выше.
