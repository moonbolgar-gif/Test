/**
 * Тесты расчёта следующего срабатывания.
 *
 * Запуск: npm run test:alarm
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { nextFireAt, timeUntil } from './schedule.ts';

/** 2026-07-27 — понедельник. */
const MONDAY_08_00 = new Date(2026, 6, 27, 8, 0, 0, 0);

function fmt(ms: number): string {
  const d = new Date(ms);
  const days = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
  return `${days[d.getDay()]} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

test('разовый будильник на время впереди — сегодня', () => {
  const at = nextFireAt({ hour: 9, minute: 30, repeatDays: [] }, MONDAY_08_00);
  assert.equal(fmt(at), 'Пн 09:30');
});

test('разовый будильник на время позади — завтра, а не немедленно', () => {
  const at = nextFireAt({ hour: 7, minute: 0, repeatDays: [] }, MONDAY_08_00);
  assert.equal(fmt(at), 'Вт 07:00');
});

test('разовый ровно на текущую минуту переносится на завтра', () => {
  // Иначе будильник зазвонил бы сразу после создания.
  const at = nextFireAt({ hour: 8, minute: 0, repeatDays: [] }, MONDAY_08_00);
  assert.equal(fmt(at), 'Вт 08:00');
});

test('будни: время впереди — сегодня', () => {
  const at = nextFireAt({ hour: 9, minute: 0, repeatDays: [1, 2, 3, 4, 5] }, MONDAY_08_00);
  assert.equal(fmt(at), 'Пн 09:00');
});

test('будни: время позади — завтра', () => {
  const at = nextFireAt({ hour: 7, minute: 0, repeatDays: [1, 2, 3, 4, 5] }, MONDAY_08_00);
  assert.equal(fmt(at), 'Вт 07:00');
});

test('только воскресенье: в понедельник ждём шесть дней', () => {
  const at = nextFireAt({ hour: 9, minute: 0, repeatDays: [0] }, MONDAY_08_00);
  assert.equal(fmt(at), 'Вс 09:00');
  assert.ok(at - MONDAY_08_00.getTime() > 5 * 24 * 3600_000);
});

test('будни: в пятницу вечером следующий — понедельник', () => {
  const friday = new Date(2026, 6, 31, 20, 0, 0, 0);
  const at = nextFireAt({ hour: 7, minute: 0, repeatDays: [1, 2, 3, 4, 5] }, friday);
  assert.equal(fmt(at), 'Пн 07:00');
});

test('каждый день: всегда в пределах суток', () => {
  const at = nextFireAt({ hour: 7, minute: 0, repeatDays: [0, 1, 2, 3, 4, 5, 6] }, MONDAY_08_00);
  assert.ok(at - MONDAY_08_00.getTime() <= 24 * 3600_000);
});

test('результат всегда строго в будущем', () => {
  // Прогон по каждой минуте суток на каждом наборе дней: ни один вариант
  // не должен дать время в прошлом — иначе будильник зазвонит при создании.
  const variants = [[], [1, 2, 3, 4, 5], [0], [0, 6], [0, 1, 2, 3, 4, 5, 6]] as const;
  for (const days of variants) {
    for (let hour = 0; hour < 24; hour++) {
      for (const minute of [0, 15, 30, 45, 59]) {
        const at = nextFireAt({ hour, minute, repeatDays: [...days] }, MONDAY_08_00);
        assert.ok(
          at > MONDAY_08_00.getTime(),
          `${hour}:${minute} дни=[${days}] дало прошедшее время`,
        );
      }
    }
  }
});

test('время до срабатывания форматируется по-русски', () => {
  const now = MONDAY_08_00.getTime();
  assert.equal(timeUntil(now + 30_000, now), 'меньше минуты');
  assert.equal(timeUntil(now + 25 * 60_000, now), '25 мин');
  assert.equal(timeUntil(now + 2 * 3_600_000, now), '2 ч');
  assert.equal(timeUntil(now + 2 * 3_600_000 + 15 * 60_000, now), '2 ч 15 мин');
  assert.equal(timeUntil(now - 5000, now), 'меньше минуты');
});
