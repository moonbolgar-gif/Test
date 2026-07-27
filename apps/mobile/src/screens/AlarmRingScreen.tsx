/**
 * Экран срабатывания. docs/SPEC.md §6.10 — ключевой экран продукта.
 *
 * Что здесь работает по-настоящему: звук с нарастанием громкости, вибрация,
 * запись видео с фронтальной камеры, подсветка лица экраном, экран не гаснет,
 * аппаратная кнопка «назад» заблокирована, окно испытания отсчитывается вне экрана.
 *
 * Чего не хватает до §6.10 и почему: срабатывания при выгруженном приложении.
 * Это `RiseAlarmModule` (§4.1), нативный код, Фаза 0.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Brightness from 'expo-brightness';
import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';

import { Button } from '../components/Button';
import { useAlarmSound } from '../features/alarm/useAlarmSound';
import { MathChallenge } from '../features/challenge/MathChallenge';
import { PatternChallenge } from '../features/challenge/PatternChallenge';
import { ShakeChallenge } from '../features/challenge/ShakeChallenge';
import { CameraCircle, type CameraCircleHandle } from '../features/video/CameraCircle';
import { colors, fonts, radius, spacing } from '../design/tokens';
import { scale, type } from '../design/type';
import { formatCountdown, formatMoney } from '../lib/format';
import { remainingWindowMs } from '../lib/demoServer';
import { useStore } from '../lib/store';
import { CHALLENGE_WINDOW_MS } from '@rise/shared';

export function AlarmRingScreen({ navigation }: { navigation: { replace: (route: string) => void } }) {
  const run = useStore((s) => s.activeRun);
  const completeRun = useStore((s) => s.completeRun);
  const failRun = useStore((s) => s.failRun);
  const attachVideo = useStore((s) => s.attachVideo);

  const [remaining, setRemaining] = useState(() => (run ? remainingWindowMs(run.id) : 0));
  const camera = useRef<CameraCircleHandle>(null);
  const settled = useRef(false);

  // §6.10: экран не гаснет, пока звонит будильник.
  useKeepAwake();
  useAlarmSound(run !== null);

  // Подсветка лица: экран поднимается на максимальную яркость, потому что
  // у фронтальной камеры нет вспышки. Прежнее значение возвращается на выходе,
  // иначе телефон останется слепящим после испытания.
  useEffect(() => {
    let previous: number | null = null;
    let cancelled = false;

    Brightness.getBrightnessAsync()
      .then((value) => {
        if (cancelled) return;
        previous = value;
        return Brightness.setBrightnessAsync(1);
      })
      .catch(() => {
        // Яркость недоступна — экран всё равно светит лаймовым фоном §6.10.
      });

    return () => {
      cancelled = true;
      if (previous !== null) {
        Brightness.setBrightnessAsync(previous).catch(() => {});
      }
    };
  }, []);

  // §6.10: аппаратная кнопка «назад» не работает — испытание нельзя закрыть,
  // его можно только пройти или провалить.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const finish = useCallback(
    (won: boolean) => {
      if (settled.current) return;
      settled.current = true;

      const runId = run?.id ?? null;

      // Переход происходит НЕМЕДЛЕННО, до всякой работы с камерой.
      //
      // Раньше здесь стоял `await camera.stopAndSave()`, и сбой нативной записи
      // уносил с собой весь переход: пользователь решал испытание и оставался
      // ни с чем. Цикл «испытание → итог» обязан замыкаться независимо от того,
      // что происходит с камерой, поэтому файл догоняет результат позже
      // (см. attachVideo).
      if (won) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        completeRun(null);
        navigation.replace('Win');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        failRun(null);
        navigation.replace('Fail');
      }

      // Запись останавливается фоном. Ошибки гасятся: провал записи не должен
      // ни на что влиять — испытание уже засчитано.
      const handle = camera.current;
      if (handle && runId) {
        handle
          .stopAndSave()
          .then((uri) => attachVideo(runId, uri))
          .catch(() => {});
      }
    },
    [attachVideo, completeRun, failRun, navigation, run],
  );

  // Окно отсчитывает demoServer (§4.2), экран только опрашивает остаток.
  useEffect(() => {
    if (!run) return;
    const timer = setInterval(() => {
      const left = remainingWindowMs(run.id);
      setRemaining(left);
      if (left <= 0) finish(false);
    }, 250);
    return () => clearInterval(timer);
  }, [finish, run]);

  const surrender = useCallback(() => {
    if (!run) return;
    // §6.10: при денежном режиме сдача подтверждается диалогом.
    if (run.mode === 'free') {
      finish(false);
      return;
    }
    Alert.alert(
      'Уверен?',
      `На кону ${formatMoney(run.stakeCents)}. Сдашься — сумма спишется.`,
      [
        { text: 'Продолжить испытание', style: 'cancel' },
        { text: 'Сдаюсь', style: 'destructive', onPress: () => finish(false) },
      ],
    );
  }, [finish, run]);

  if (!run) return null;

  // §14.2: «на кону», не «ставка».
  const stakeLabel = {
    free: 'СЕРИЯ ПОД УГРОЗОЙ',
    stake: `${formatMoney(run.stakeCents)} НА КОНУ`,
    squad: `${formatMoney(run.stakeCents)} — КОМАНДНЫЙ ЧЕЛЛЕНДЖ`,
  }[run.mode];

  const challengeTitle = {
    pattern: 'Графический ключ ×2',
    math: '3 примера подряд',
    shake: 'Тряхни телефон ×20',
  }[run.challengeType];

  const now = new Date();
  const elapsed = 1 - remaining / CHALLENGE_WINDOW_MS;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.stakeBadge}>
          <Text style={styles.stakeLabel}>{stakeLabel}</Text>
        </View>
        <Text style={styles.countdown}>⏳ {formatCountdown(remaining)}</Text>
      </View>

      <Text style={styles.time}>
        {String(now.getHours()).padStart(2, '0')}:{String(now.getMinutes()).padStart(2, '0')}
      </Text>

      {/* Камера по центру и крупно: на прежних 104 pt лицо было неразличимо,
          и не читалось, идёт ли запись вообще. */}
      <View style={styles.cameraBlock}>
        <CameraCircle ref={camera} progress={elapsed} recording={run.autoRecord} />
      </View>

      <Text style={[type.eyebrow, styles.challengeTitle]}>{challengeTitle}</Text>

      <View style={styles.challenge}>
        {run.challengeType === 'pattern' ? (
          <PatternChallenge onSolved={() => finish(true)} />
        ) : run.challengeType === 'math' ? (
          <MathChallenge onSolved={() => finish(true)} />
        ) : (
          <ShakeChallenge onSolved={() => finish(true)} />
        )}
      </View>

      <Button label="😴 Сдаюсь" variant="outline" onPress={surrender} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // §6.10: сплошной лаймовый фон — максимальный контраст, будит, и заодно
  // работает источником света для фронтальной камеры.
  screen: {
    flex: 1,
    backgroundColor: colors.lime,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stakeBadge: {
    backgroundColor: colors.ink,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radius.pill,
    flexShrink: 1,
  },
  stakeLabel: {
    fontFamily: fonts.extrabold,
    fontSize: scale(11),
    letterSpacing: 1,
    color: colors.lime,
  },
  countdown: {
    fontFamily: fonts.extrabold,
    fontSize: scale(17),
    color: colors.ink,
  },

  time: {
    ...type.display,
    fontSize: scale(44),
    textAlign: 'center',
  },
  cameraBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xl,
  },

  challengeTitle: { textAlign: 'center' },
  challenge: { flex: 1, justifyContent: 'center' },
});
