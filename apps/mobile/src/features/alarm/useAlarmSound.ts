/**
 * Звук и вибрация будильника. docs/SPEC.md §6.10.
 *
 * §6.10: звук играет в цикле, громкость нарастает первые 15 секунд от 40% до 100%.
 * Нарастание не «для красоты» — резкий звук на полной громкости в 7 утра вызывает
 * желание убить приложение, а не встать.
 *
 * Ограничение демо: звучит только пока приложение открыто. Чтобы будильник звонил
 * при закрытом приложении, нужен нативный модуль из §4.1 (Фаза 0).
 */

import { useCallback, useEffect, useRef } from 'react';
import { Platform, Vibration } from 'react-native';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';

const alarmSound = require('../../../assets/alarm.wav');

/** §6.10 — окно нарастания громкости. */
const RAMP_MS = 15_000;
const RAMP_FROM = 0.4;
const RAMP_TO = 1.0;
const RAMP_TICK_MS = 250;

/** Паттерн вибрации: пауза, вибро, пауза… Повторяется, пока играет будильник. */
const VIBRATION_PATTERN = [0, 600, 900];

/**
 * Возвращает `stop` — остановку звука по требованию.
 *
 * Полагаться только на очистку эффекта нельзя: она срабатывает в момент
 * размонтирования, то есть уже во время перехода на следующий экран. Обращения
 * к нативным модулям в этот момент — источник сбоев, закрывающих приложение,
 * поэтому звук глушится явно и заранее, пока экран ещё жив.
 */
export function useAlarmSound(active: boolean): { stop: () => void } {
  const player = useAudioPlayer(alarmSound);
  const rampTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const stopped = useRef(false);

  // Общая остановка: вызывается и из cleanup, и вручную перед переходом.
  // Повторный вызов безвреден.
  const stop = useCallback(() => {
    if (stopped.current) return;
    stopped.current = true;

    if (rampTimer.current) {
      clearInterval(rampTimer.current);
      rampTimer.current = null;
    }
    Vibration.cancel();
    try {
      player.pause();
    } catch {
      // Плеер уже освобождён — глушить нечего.
    }
    // Возвращаем обычный режим, иначе приложение продолжит перебивать
    // чужую музыку после того, как будильник отзвонил.
    if (Platform.OS === 'ios') {
      setAudioModeAsync({ playsInSilentMode: false }).catch(() => {});
    }
  }, [player]);

  useEffect(() => {
    if (!active) return;

    stopped.current = false;
    let cancelled = false;

    // §6.10: будильник обязан звучать, даже если телефон в беззвучном режиме —
    // иначе он бесполезен как будильник.
    setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: false,
      interruptionMode: 'doNotMix',
    }).catch(() => {
      // Не удалось выставить режим — звук всё равно пробуем воспроизвести,
      // просто в беззвучном режиме его может быть не слышно.
    });

    try {
      player.loop = true;
      player.volume = RAMP_FROM;
      player.play();
    } catch {
      // Плеер мог быть освобождён при быстром размонтировании — не роняем экран
      // испытания из-за звука.
    }

    const startedAt = Date.now();
    rampTimer.current = setInterval(() => {
      if (cancelled) return;
      const progress = Math.min(1, (Date.now() - startedAt) / RAMP_MS);
      try {
        player.volume = RAMP_FROM + (RAMP_TO - RAMP_FROM) * progress;
      } catch {
        // см. выше
      }
      if (progress >= 1 && rampTimer.current) {
        clearInterval(rampTimer.current);
        rampTimer.current = null;
      }
    }, RAMP_TICK_MS);

    Vibration.vibrate(VIBRATION_PATTERN, true);

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, player, stop]);

  return { stop };
}
