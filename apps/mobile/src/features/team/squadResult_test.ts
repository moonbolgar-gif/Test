/**
 * Тесты итога командного челленджа.
 *
 * Проверяют не столько арифметику, сколько соблюдение §14.1: деньги проигравшего
 * не должны доставаться победителю. Если эти тесты когда-нибудь начнут мешать —
 * это повод перечитать §14.1, а не поправить тест.
 *
 * Запуск: npm run test:squad
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { resolveSquadChallenge, type SquadMemberInput } from './squadResult.ts';

const MEMBERS: SquadMemberInput[] = [
  { id: 'u1', name: 'Даша', streak: 18 },
  { id: 'u2', name: 'Дэн', streak: 89 },
  { id: 'u3', name: 'Марк', streak: 3 },
  { id: 'u4', name: 'Лена', streak: 7 },
];

/** Детерминированный генератор — тесты не должны зависеть от удачи. */
function seeded(values: number[]): () => number {
  let i = 0;
  return () => values[i++ % values.length];
}

test('§14.1: награда не зависит от того, сколько денег потеряли проигравшие', () => {
  // Все проспали — фонд максимальный.
  const allFailed = resolveSquadChallenge(MEMBERS, 500, seeded([0.99]));
  // Никто не проспал — фонд пустой.
  const allWoke = resolveSquadChallenge(MEMBERS, 500, seeded([0.01]));

  assert.equal(allFailed.fundCents, 2000);
  assert.equal(allWoke.fundCents, 0);
  // Ключевая проверка: номинал награды одинаков в обоих случаях.
  assert.equal(allFailed.rewardCents, allWoke.rewardCents);
});

test('§14.1: награда не растёт при увеличении взноса', () => {
  const small = resolveSquadChallenge(MEMBERS, 100, seeded([0.99]));
  const large = resolveSquadChallenge(MEMBERS, 1000, seeded([0.99]));
  assert.equal(small.rewardCents, large.rewardCents);
});

test('взнос проспавшего уходит в фонд целиком', () => {
  const result = resolveSquadChallenge(MEMBERS, 500, seeded([0.99]));
  for (const member of result.members) {
    assert.equal(member.wokeUp, false);
    assert.equal(member.forfeitedCents, 500);
  }
  assert.equal(result.fundCents, 500 * MEMBERS.length);
});

test('проснувшийся не теряет ничего', () => {
  const result = resolveSquadChallenge(MEMBERS, 500, seeded([0.01]));
  for (const member of result.members) {
    assert.equal(member.wokeUp, true);
    assert.equal(member.forfeitedCents, 0);
    assert.ok(member.wokeUpAt !== null);
  }
});

test('идеальный раунд отмечается, только если встали все', () => {
  assert.equal(resolveSquadChallenge(MEMBERS, 500, seeded([0.01])).perfectRound, true);
  assert.equal(resolveSquadChallenge(MEMBERS, 500, seeded([0.99])).perfectRound, false);
  // Один проспал из четырёх — раунд уже не идеальный.
  const mixed = resolveSquadChallenge(MEMBERS, 500, seeded([0.01, 0.01, 0.99, 0.01]));
  assert.equal(mixed.perfectRound, false);
});

test('длинная серия снижает шанс проспать', () => {
  // Порог 0.8 проходит ветеран (шанс ~0.9), но не новичок (шанс 0.586).
  const veteran = resolveSquadChallenge(
    [{ id: 'v', name: 'Дэн', streak: 89 }], 500, seeded([0.8]),
  );
  const rookie = resolveSquadChallenge(
    [{ id: 'r', name: 'Марк', streak: 3 }], 500, seeded([0.8]),
  );
  assert.equal(veteran.members[0].wokeUp, true);
  assert.equal(rookie.members[0].wokeUp, false);
});

test('пустая команда не ломает расчёт', () => {
  const result = resolveSquadChallenge([], 500, seeded([0.5]));
  assert.deepEqual(result.members, []);
  assert.equal(result.fundCents, 0);
  assert.equal(result.perfectRound, true);
});

test('все суммы — целые центы (§3.3)', () => {
  const result = resolveSquadChallenge(MEMBERS, 333, seeded([0.99, 0.01]));
  assert.ok(Number.isInteger(result.fundCents));
  assert.ok(Number.isInteger(result.rewardCents));
  for (const member of result.members) {
    assert.ok(Number.isInteger(member.forfeitedCents));
  }
});
