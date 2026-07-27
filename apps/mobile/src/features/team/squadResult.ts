/**
 * Итог командного челленджа. docs/SPEC.md §6.6, §6.7, §7.7.
 *
 * ЮРИДИЧЕСКИ ВАЖНАЯ ЧАСТЬ, а не просто расчёт.
 *
 * §14.1 объясняет, почему RISE — не азартная игра, и один из четырёх доводов
 * звучит так: деньги проигравшего **не идут напрямую победителю**. Они уходят
 * в обезличенный фонд платформы, а награду победившим выдаёт платформа из
 * своего фонда наград.
 *
 * Поэтому здесь взнос проспавшего никогда не делится между проснувшимися.
 * Проснувшиеся получают ваучер фиксированного номинала из фонда — независимо
 * от того, сколько человек проспало и проспал ли кто-то вообще. Любая правка,
 * которая свяжет размер награды с суммой проигравших, ломает §14.1.
 */

import type { Cents } from '@rise/shared';

export interface SquadMemberInput {
  id: string;
  name: string;
  streak: number;
}

export interface SquadMemberResult {
  id: string;
  name: string;
  wokeUp: boolean;
  /** Время подъёма для тех, кто справился. */
  wokeUpAt: string | null;
  /** Взнос, ушедший в фонд платформы. Только для проспавших. */
  forfeitedCents: Cents;
}

export interface SquadChallengeResult {
  members: SquadMemberResult[];
  /** Сколько всего ушло в резервный фонд платформы. */
  fundCents: Cents;
  /** Номинал награды победившим. Фиксирован — см. комментарий к модулю. */
  rewardCents: Cents;
  /** Победила ли команда целиком (никто не проспал). */
  perfectRound: boolean;
}

/** §7.6 — номинал награды из фонда. Не зависит от суммы проигравших. */
const REWARD_CENTS = 200;

/**
 * Разыгрывает утро команды.
 *
 * Вероятность подъёма привязана к серии участника: тот, кто держит серию 89 дней,
 * не должен проспать с той же вероятностью, что новичок с серией 3. Это делает
 * демонстрацию правдоподобной, а не случайной.
 */
export function resolveSquadChallenge(
  members: SquadMemberInput[],
  stakeCents: Cents,
  random: () => number = Math.random,
): SquadChallengeResult {
  const results: SquadMemberResult[] = members.map((member) => {
    // 0.55 у новичка, ~0.9 у ветерана.
    const chance = Math.min(0.9, 0.55 + member.streak * 0.012);
    const wokeUp = random() < chance;

    return {
      id: member.id,
      name: member.name,
      wokeUp,
      wokeUpAt: wokeUp ? randomWakeTime(random) : null,
      forfeitedCents: wokeUp ? 0 : stakeCents,
    };
  });

  const fundCents = results.reduce((sum, r) => sum + r.forfeitedCents, 0);

  return {
    members: results,
    fundCents,
    rewardCents: REWARD_CENTS,
    perfectRound: results.every((r) => r.wokeUp),
  };
}

function randomWakeTime(random: () => number): string {
  const minute = Math.floor(random() * 12);
  return `6:${String(minute).padStart(2, '0')}`;
}
