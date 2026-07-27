/**
 * Имитация сервера для демо-режима.
 *
 * Существует, чтобы демо не нарушало инварианты SPEC при подмене бэкенда:
 *
 *  - §8.2 запрещает хардкодить доли распределения в клиенте. Здесь они лежат
 *    в одном месте, помеченном как серверные данные, и приходят в UI асинхронно —
 *    ровно как придут из `app_settings`, когда бэкенд подключат.
 *  - §4.2 требует, чтобы окно испытания отсчитывал сервер. Здесь отсчёт ведёт
 *    этот модуль по своим отметкам времени, а не экран.
 *  - §3.3 — все суммы в центах, целые.
 *
 * Когда подключим Supabase, этот файл заменяется на реальный API-клиент,
 * а экраны не меняются.
 */

import { CHALLENGE_WINDOW_MS, type Cents } from '@rise/shared';

export interface StakeSplitConfig {
  platform: number;
  charity: number;
  reward_pool: number;
}

export interface ServiceFeeConfig {
  cents: Cents;
  trees_share: number;
}

/** Аналог таблицы app_settings из миграции 0001. */
const SERVER_SETTINGS = {
  stake_split: { platform: 50, charity: 30, reward_pool: 20 } satisfies StakeSplitConfig,
  service_fee: { cents: 30, trees_share: 50 } satisfies ServiceFeeConfig,
};

/** Небольшая задержка, чтобы UI обрабатывал асинхронность как с настоящим API. */
const LATENCY_MS = 180;

function delay<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), LATENCY_MS));
}

export function fetchStakeSplit(): Promise<StakeSplitConfig> {
  return delay(SERVER_SETTINGS.stake_split);
}

export function fetchServiceFee(): Promise<ServiceFeeConfig> {
  return delay(SERVER_SETTINGS.service_fee);
}

/**
 * Распределение суммы по долям методом наибольшего остатка.
 *
 * Повторяет `supabase/functions/_shared/money.ts`: сумма частей обязана в точности
 * равняться исходной сумме. В демо это нужно, чтобы экран разбивки (§6.6) показывал
 * те же числа, что покажет сервер, а не расходился с ним на цент.
 */
export function splitStake(
  amountCents: Cents,
  split: StakeSplitConfig,
): { platform: Cents; charity: Cents; reward_pool: Cents } {
  const shares = [
    ['platform', split.platform],
    ['charity', split.charity],
    ['reward_pool', split.reward_pool],
  ] as const;

  const parts = shares.map(([key, pct]) => ({
    key,
    floor: Math.floor((amountCents * pct) / 100),
    remainder: (amountCents * pct) % 100,
  }));

  let leftover = amountCents - parts.reduce((sum, p) => sum + p.floor, 0);
  const bonus = new Set<string>();
  for (const part of [...parts].sort((a, b) => b.remainder - a.remainder)) {
    if (leftover <= 0) break;
    bonus.add(part.key);
    leftover -= 1;
  }

  return {
    platform: parts[0].floor + (bonus.has('platform') ? 1 : 0),
    charity: parts[1].floor + (bonus.has('charity') ? 1 : 0),
    reward_pool: parts[2].floor + (bonus.has('reward_pool') ? 1 : 0),
  };
}

// ─── Окно испытания (§4.2) ───────────────────────────────────────────────────

/**
 * Отметки времени срабатываний. Отсчёт ведётся здесь, а не в компоненте:
 * §4.2 требует, чтобы окно считал сервер и смена системного времени ни на что
 * не влияла. В демо «серверное время» — это Date.now() внутри этого модуля,
 * но граница ответственности та же, что будет в проде.
 */
const runWindows = new Map<string, number>();

export function startWindow(runId: string): void {
  runWindows.set(runId, Date.now());
}

export function remainingWindowMs(runId: string): number {
  const startedAt = runWindows.get(runId);
  if (startedAt === undefined) return 0;
  return Math.max(0, CHALLENGE_WINDOW_MS - (Date.now() - startedAt));
}

export function isWindowOpen(runId: string): boolean {
  return remainingWindowMs(runId) > 0;
}

export function clearWindow(runId: string): void {
  runWindows.delete(runId);
}
