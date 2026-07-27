/**
 * Форматирование. Все суммы приходят в центах (§3.3) и превращаются в строки
 * только здесь — арифметики над долларами в приложении быть не должно.
 */

import type { Cents, Weekday } from '@rise/shared';

export function formatMoney(cents: Cents): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const fraction = abs % 100;
  return fraction === 0
    ? `${sign}$${whole}`
    : `${sign}$${whole}.${String(fraction).padStart(2, '0')}`;
}

/** Время в формате `07:00 AM`, как в §6.4. */
export function formatTime(hour: number, minute: number): string {
  const suffix = hour < 12 ? 'AM' : 'PM';
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${String(displayHour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${suffix}`;
}

/** Оставшееся время окна в формате `4:37` (§6.10). */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** 0 = Вс … 6 = Сб, как в `alarms.repeat_days`. */
export const WEEKDAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const;

/** Порядок отображения — с понедельника, как в недельной полосе §6.4. */
export const WEEK_ORDER: Weekday[] = [1, 2, 3, 4, 5, 6, 0];

export function formatRepeatDays(days: Weekday[]): string {
  if (days.length === 0) return 'Один раз';
  if (days.length === 7) return 'Каждый день';

  const sorted = [...days].sort();
  const isWeekdays = sorted.length === 5 && sorted.every((d, i) => d === i + 1);
  if (isWeekdays) return 'Будни';

  const isWeekend = sorted.length === 2 && sorted[0] === 0 && sorted[1] === 6;
  if (isWeekend) return 'Выходные';

  return WEEK_ORDER.filter((d) => days.includes(d))
    .map((d) => WEEKDAY_LABELS[d])
    .join(', ');
}

/** Склонение слова «день» для счётчика стрика. */
export function pluralDays(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod100 >= 11 && mod100 <= 14) return 'дней';
  if (mod10 === 1) return 'день';
  if (mod10 >= 2 && mod10 <= 4) return 'дня';
  return 'дней';
}
