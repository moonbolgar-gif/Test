/**
 * Тесты денежной арифметики. docs/SPEC.md §20.3: «Пиши тесты на денежную логику
 * до реализации — ошибки в деньгах недопустимы».
 *
 * Запуск: npm run test:money (из корня репозитория).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  MoneyError,
  idempotencyKey,
  planFailureCharge,
  planSuccessCharge,
  splitServiceFee,
  splitStake,
  type ServiceFeeConfig,
  type StakeSplit,
} from './money.ts';

/** Значения по умолчанию из миграции 0001 (§8.2, §8.3). */
const SPLIT: StakeSplit = { platform: 50, charity: 30, reward_pool: 20 };
const FEE: ServiceFeeConfig = { cents: 30, trees_share: 50 };

const sum = (a: Record<string, number>): number =>
  Object.values(a).reduce((acc, n) => acc + n, 0);

// ─── Инвариант 1: ни один цент не теряется ───────────────────────────────────

test('распределение ставки не теряет и не создаёт центы ни на одной сумме $1–$10', () => {
  // §14.1 ограничивает ставки диапазоном $1–$10, но проверяем каждый цент внутри
  // него: округление ломается именно на некруглых суммах.
  for (let amount = 100; amount <= 1000; amount++) {
    const parts = splitStake(amount, SPLIT);
    assert.equal(
      sum(parts),
      amount,
      `сумма частей ${sum(parts)} не равна ставке ${amount}`,
    );
  }
});

test('распределение не теряет центы и за пределами продуктового диапазона', () => {
  for (const amount of [0, 1, 2, 3, 7, 33, 99, 101, 333, 999, 100_000]) {
    assert.equal(sum(splitStake(amount, SPLIT)), amount, `сумма ${amount}`);
  }
});

test('распределение сбора не теряет центы', () => {
  for (let cents = 0; cents <= 500; cents++) {
    const parts = splitServiceFee({ cents, trees_share: 50 });
    assert.equal(sum(parts), cents, `сбор ${cents}`);
  }
});

// ─── Инвариант 2: целые неотрицательные центы ────────────────────────────────

test('все части — целые неотрицательные числа', () => {
  for (let amount = 0; amount <= 1000; amount += 7) {
    for (const value of Object.values(splitStake(amount, SPLIT))) {
      assert.ok(Number.isInteger(value), `${value} не целое`);
      assert.ok(value >= 0, `${value} отрицательное`);
    }
  }
});

// ─── Конкретные значения из ТЗ ───────────────────────────────────────────────

test('§6.6: $5.00 делится как 250 / 150 / 100', () => {
  assert.deepEqual(splitStake(500, SPLIT), {
    platform: 250,
    charity: 150,
    reward_pool: 100,
  });
});

test('§8.3: сбор $0.30 делится пополам между деревьями и платформой', () => {
  assert.deepEqual(splitServiceFee(FEE), { charity: 15, platform: 15 });
});

test('некруглая сумма распределяется по наибольшему остатку', () => {
  // 333: точные доли 166.5 / 99.9 / 66.6 → floor 166 / 99 / 66 = 331.
  // Два оставшихся цента уходят наибольшим остаткам: charity (.9) и reward_pool (.6).
  assert.deepEqual(splitStake(333, SPLIT), {
    platform: 166,
    charity: 100,
    reward_pool: 67,
  });
});

test('один цент достаётся корзине с наибольшей долей', () => {
  assert.deepEqual(splitStake(1, SPLIT), {
    platform: 1,
    charity: 0,
    reward_pool: 0,
  });
});

test('нулевая сумма даёт нули, а не ошибку', () => {
  assert.deepEqual(splitStake(0, SPLIT), {
    platform: 0,
    charity: 0,
    reward_pool: 0,
  });
});

// ─── Инвариант 3: детерминированность ────────────────────────────────────────

test('одинаковый вход всегда даёт одинаковый выход', () => {
  for (const amount of [1, 3, 333, 777]) {
    const first = splitStake(amount, SPLIT);
    for (let i = 0; i < 50; i++) {
      assert.deepEqual(splitStake(amount, SPLIT), first, `сумма ${amount}`);
    }
  }
});

// ─── Защита от некорректного конфига ─────────────────────────────────────────

test('доли, не дающие 100%, отвергаются', () => {
  assert.throws(
    () => splitStake(500, { platform: 60, charity: 30, reward_pool: 20 }),
    MoneyError,
  );
});

test('дробные и отрицательные суммы отвергаются', () => {
  assert.throws(() => splitStake(10.5, SPLIT), MoneyError);
  assert.throws(() => splitStake(-100, SPLIT), MoneyError);
});

test('доля деревьев вне 0..100 отвергается', () => {
  assert.throws(() => splitServiceFee({ cents: 30, trees_share: 101 }), MoneyError);
  assert.throws(() => splitServiceFee({ cents: 30, trees_share: -1 }), MoneyError);
});

// ─── План списания (§8.1) ────────────────────────────────────────────────────

test('§8.1 шаг 4: при провале списывается ставка вместе со сбором', () => {
  const plan = planFailureCharge(500, SPLIT, FEE);
  assert.equal(plan.totalCents, 530);
  assert.equal(plan.stakeCents, 500);
  assert.equal(plan.feeCents, 30);
});

test('записи ledger в сумме дают ровно списанное', () => {
  for (let amount = 100; amount <= 1000; amount++) {
    const plan = planFailureCharge(amount, SPLIT, FEE);
    const total = plan.entries.reduce((acc, e) => acc + e.amount_cents, 0);
    assert.equal(total, plan.totalCents, `ставка ${amount}`);
  }
});

test('§8.1 шаг 3: при успехе ставка не списывается, только сбор', () => {
  const plan = planSuccessCharge(FEE);
  assert.equal(plan.totalCents, 30);
  assert.equal(plan.stakeCents, 0);
  assert.deepEqual(plan.entries, [{ bucket: 'fee', amount_cents: 30 }]);
});

test('нулевые записи в ledger не создаются', () => {
  const plan = planFailureCharge(0, SPLIT, { cents: 0, trees_share: 50 });
  assert.deepEqual(plan.entries, []);
  assert.equal(plan.totalCents, 0);
});

// ─── Идемпотентность (§3.3) ──────────────────────────────────────────────────

test('ключ идемпотентности зависит только от срабатывания и вида операции', () => {
  const run = '33333333-0000-0000-0000-00000000000a';
  assert.equal(idempotencyKey(run, 'failure'), idempotencyKey(run, 'failure'));
  assert.notEqual(idempotencyKey(run, 'failure'), idempotencyKey(run, 'success'));
  assert.notEqual(idempotencyKey(run, 'failure'), idempotencyKey('other-run', 'failure'));
});
