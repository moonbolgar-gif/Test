/**
 * Следит за временем и открывает экран срабатывания. docs/SPEC.md §7.1.
 *
 * Работает, пока приложение живо. Если приложение свёрнуто, пользователя будит
 * серия уведомлений (`notifications.ts`), а по возвращении в приложение эта
 * проверка немедленно откроет испытание.
 *
 * Чего это не даёт: срабатывания при полностью выгруженном приложении. Это
 * `RiseAlarmModule` из §4.1 и содержание Фазы 0.
 */

import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { useStore } from '../../lib/store';

const TICK_MS = 1000;

/** Насколько поздно ещё имеет смысл открывать испытание (§4.2 — окно 5 минут). */
const MAX_LATE_MS = 5 * 60 * 1000;

export function useAlarmWatcher(onFire: () => void): void {
  // Колбэк держим в ref: интервал ставится один раз, а onFire меняется
  // на каждом рендере навигатора.
  const fire = useRef(onFire);
  fire.current = onFire;

  useEffect(() => {
    const check = (): void => {
      const state = useStore.getState();
      if (state.activeRun) return;

      const now = Date.now();
      const due = state.alarms.find(
        (alarm) =>
          alarm.isActive &&
          alarm.nextFireAt <= now &&
          now - alarm.nextFireAt < MAX_LATE_MS,
      );
      if (!due) return;

      state.startRun(due.id);
      fire.current();
    };

    const timer = setInterval(check, TICK_MS);

    // Возврат из фона — проверяем немедленно, не дожидаясь тика: пользователь
    // мог открыть приложение по уведомлению будильника.
    const subscription = AppState.addEventListener('change', (next) => {
      if (next === 'active') check();
    });

    check();

    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
}
