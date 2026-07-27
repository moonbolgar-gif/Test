/**
 * Расчёт следующего срабатывания. docs/SPEC.md §7.1, §10 («сервер вычисляет next_fire_at»).
 *
 * В демо считает клиент. В проде эта функция переезжает на сервер целиком:
 * §4.2 требует, чтобы смена системного времени на устройстве ни на что не влияла,
 * а клиентский `Date.now()` этого обеспечить не может.
 *
 * Функция чистая — принимает «сейчас» аргументом, поэтому тестируется без моков часов.
 */

import type { Weekday } from '@rise/shared';

export interface AlarmTime {
  hour: number;
  minute: number;
  /** Пустой массив = разовый будильник на ближайшее наступление времени. */
  repeatDays: Weekday[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Ближайший момент, когда будильник должен зазвонить, в миллисекундах.
 *
 * Граничный случай, ради которого написан тест: если время уже прошло сегодня,
 * будильник переносится на следующий подходящий день, а не звонит немедленно.
 */
export function nextFireAt(alarm: AlarmTime, now: Date = new Date()): number {
  const candidate = new Date(now);
  candidate.setHours(alarm.hour, alarm.minute, 0, 0);

  if (alarm.repeatDays.length === 0) {
    // Разовый: сегодня, если время ещё не прошло, иначе завтра.
    if (candidate.getTime() <= now.getTime()) {
      return candidate.getTime() + DAY_MS;
    }
    return candidate.getTime();
  }

  // Повторяющийся: ищем ближайший из выбранных дней недели, включая сегодня.
  for (let offset = 0; offset < 8; offset++) {
    const day = new Date(candidate.getTime() + offset * DAY_MS);
    const weekday = day.getDay() as Weekday;
    if (!alarm.repeatDays.includes(weekday)) continue;
    if (day.getTime() > now.getTime()) return day.getTime();
  }

  // Недостижимо при непустом repeatDays: за 8 дней любой день недели встретится.
  return candidate.getTime() + DAY_MS;
}

/** Человекочитаемый остаток до срабатывания — для подписи на главном экране. */
export function timeUntil(fireAt: number, now: number = Date.now()): string {
  const diff = Math.max(0, fireAt - now);
  const hours = Math.floor(diff / 3_600_000);
  const minutes = Math.floor((diff % 3_600_000) / 60_000);

  if (hours === 0 && minutes === 0) return 'меньше минуты';
  if (hours === 0) return `${minutes} мин`;
  if (minutes === 0) return `${hours} ч`;
  return `${hours} ч ${minutes} мин`;
}
