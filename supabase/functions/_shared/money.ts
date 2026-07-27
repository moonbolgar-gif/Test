/**
 * Денежная арифметика RISE. docs/SPEC.md §8.2, §8.3, §3.3.
 *
 * Этот модуль — единственное место, где деньги делятся на части. Он намеренно
 * не содержит ни значений долей, ни размера сбора: по §8.2 они живут в
 * app_settings на сервере и приходят сюда аргументом.
 *
 * Инварианты, которые модуль обязан удерживать (проверяются в money_test.ts):
 *   1. Сумма частей всегда в точности равна исходной сумме. Ни один цент
 *      не исчезает и не появляется из округления.
 *   2. Все значения — целые неотрицательные центы (§3.3).
 *   3. Результат детерминирован: одинаковый вход всегда даёт одинаковый выход.
 */

export type Cents = number;

/** Доли распределения в процентах. Сумма обязана быть 100 (§8.2). */
export interface StakeSplit {
  platform: number;
  charity: number;
  reward_pool: number;
}

/** §8.3: фиксированный сервисный сбор и доля, уходящая на деревья. */
export interface ServiceFeeConfig {
  cents: Cents;
  trees_share: number;
}

export interface StakeAllocation {
  platform: Cents;
  charity: Cents;
  reward_pool: Cents;
}

export interface FeeAllocation {
  /** Доля сбора, учитываемая как вклад в посадку деревьев. */
  charity: Cents;
  platform: Cents;
}

export type LedgerBucket = 'platform' | 'charity' | 'reward_pool' | 'fee';

export interface LedgerEntry {
  bucket: LedgerBucket;
  amount_cents: Cents;
}

export class MoneyError extends Error {}

function assertValidAmount(amountCents: Cents, label: string): void {
  if (!Number.isInteger(amountCents)) {
    throw new MoneyError(`${label} must be an integer number of cents, got ${amountCents}`);
  }
  if (amountCents < 0) {
    throw new MoneyError(`${label} must not be negative, got ${amountCents}`);
  }
}

/**
 * Делит сумму по процентным долям без потери центов.
 *
 * Метод наибольшего остатка: каждой корзине достаётся floor от её точной доли,
 * затем нераспределённые центы раздаются корзинам с наибольшей дробной частью.
 * Наивное округление каждой доли по отдельности здесь непригодно — оно
 * систематически теряет или создаёт центы, а §8.2 требует, чтобы три записи
 * в ledger в сумме давали ровно списанное.
 *
 * Порядок `order` задаёт разрешение ничьих и потому фиксирован: без него
 * распределение $0.01 между равными долями было бы недетерминированным.
 */
function distributeByShares<K extends string>(
  amountCents: Cents,
  shares: ReadonlyArray<readonly [K, number]>,
): Record<K, Cents> {
  const totalShare = shares.reduce((sum, [, pct]) => sum + pct, 0);
  if (totalShare !== 100) {
    throw new MoneyError(`shares must sum to 100, got ${totalShare}`);
  }
  if (shares.some(([, pct]) => pct < 0)) {
    throw new MoneyError('shares must not be negative');
  }

  const exact = shares.map(([key, pct]) => {
    const scaled = amountCents * pct;
    return { key, floor: Math.floor(scaled / 100), remainder: scaled % 100 };
  });

  const distributed = exact.reduce((sum, part) => sum + part.floor, 0);
  let leftover = amountCents - distributed;

  // Сортировка стабильна относительно исходного порядка: при равных остатках
  // цент уходит корзине, объявленной раньше.
  const byRemainder = [...exact]
    .map((part, index) => ({ ...part, index }))
    .sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  const bonus = new Map<K, Cents>();
  for (const part of byRemainder) {
    if (leftover <= 0) break;
    bonus.set(part.key, 1);
    leftover -= 1;
  }

  const result = {} as Record<K, Cents>;
  for (const part of exact) {
    result[part.key] = part.floor + (bonus.get(part.key) ?? 0);
  }
  return result;
}

/**
 * §8.2 — распределение списанной ставки между платформой, благотворительностью
 * и фондом наград.
 */
export function splitStake(amountCents: Cents, split: StakeSplit): StakeAllocation {
  assertValidAmount(amountCents, 'stake amount');
  return distributeByShares(amountCents, [
    ['platform', split.platform],
    ['charity', split.charity],
    ['reward_pool', split.reward_pool],
  ] as const);
}

/**
 * §8.3 — распределение сервисного сбора. Доля `trees_share` учитывается как
 * благотворительный вклад (посадка деревьев), остаток — выручка платформы.
 */
export function splitServiceFee(fee: ServiceFeeConfig): FeeAllocation {
  assertValidAmount(fee.cents, 'service fee');
  if (fee.trees_share < 0 || fee.trees_share > 100) {
    throw new MoneyError(`trees_share must be within 0..100, got ${fee.trees_share}`);
  }
  return distributeByShares(fee.cents, [
    ['charity', fee.trees_share],
    ['platform', 100 - fee.trees_share],
  ] as const);
}

/** Итог списания: что уходит в Stripe и как это ложится в ledger. */
export interface ChargePlan {
  /** Сумма, которую надо списать одним PaymentIntent (§8.1, шаг 4). */
  totalCents: Cents;
  stakeCents: Cents;
  feeCents: Cents;
  entries: LedgerEntry[];
}

/**
 * Строит план списания при провале (§8.1, шаг 4–5): ставка + сбор одной
 * транзакцией, разложенные на записи ledger.
 *
 * Записи с нулевой суммой отбрасываются — они не несут смысла в отчётности
 * и только засоряют выборки.
 */
export function planFailureCharge(
  stakeCents: Cents,
  split: StakeSplit,
  fee: ServiceFeeConfig,
): ChargePlan {
  assertValidAmount(stakeCents, 'stake amount');
  const stake = splitStake(stakeCents, split);
  const feeParts = splitServiceFee(fee);

  const entries: LedgerEntry[] = [
    { bucket: 'platform', amount_cents: stake.platform },
    { bucket: 'charity', amount_cents: stake.charity },
    { bucket: 'reward_pool', amount_cents: stake.reward_pool },
    // Сбор идёт отдельной записью: §8.3 отличает его от ставки, и в отчётности
    // он не должен смешиваться с распределением по §8.2.
    { bucket: 'fee', amount_cents: fee.cents },
  ].filter((entry) => entry.amount_cents > 0);

  return {
    totalCents: stakeCents + fee.cents,
    stakeCents,
    feeCents: fee.cents,
    entries,
  };
}

/**
 * §8.1, шаг 3 — успешное прохождение испытания. Ставка не списывается,
 * взимается только сервисный сбор.
 */
export function planSuccessCharge(fee: ServiceFeeConfig): ChargePlan {
  assertValidAmount(fee.cents, 'service fee');
  return {
    totalCents: fee.cents,
    stakeCents: 0,
    feeCents: fee.cents,
    entries: fee.cents > 0 ? [{ bucket: 'fee', amount_cents: fee.cents }] : [],
  };
}

/**
 * Ключ идемпотентности денежной операции (§3.3).
 *
 * Строится из идентификатора срабатывания и вида операции, а не из времени или
 * случайного значения: повторный вызов после сетевого сбоя обязан дать тот же
 * ключ, иначе Stripe спишет деньги дважды.
 */
export function idempotencyKey(alarmRunId: string, kind: 'failure' | 'success'): string {
  return `rise:${kind}:${alarmRunId}`;
}
