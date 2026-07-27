/**
 * Экран срабатывания. docs/SPEC.md §6.10 — ключевой экран продукта.
 *
 * Отличия демо-режима от §6.10, которые обязательно закрыть перед релизом:
 *   - экран открывается вручную, а не по системному будильнику (§4.1);
 *   - нет звука с нарастанием громкости и вибрации;
 *   - нет записи видео-кружка (§4.3) — кружок показывает заглушку;
 *   - кнопки навигации не заблокированы.
 * Всё перечисленное требует нативных модулей и относится к Фазе 0.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Svg, { Circle } from 'react-native-svg';

import { Button } from '../components/Button';
import { MathChallenge } from '../features/challenge/MathChallenge';
import { PatternChallenge } from '../features/challenge/PatternChallenge';
import { ShakeChallenge } from '../features/challenge/ShakeChallenge';
import { colors, fonts, radius, spacing } from '../design/tokens';
import { scale, type } from '../design/type';
import { formatCountdown, formatMoney } from '../lib/format';
import { remainingWindowMs } from '../lib/demoServer';
import { useStore } from '../lib/store';
import { CHALLENGE_WINDOW_MS } from '@rise/shared';

const CIRCLE_SIZE = 104;
const RING_STROKE = 4;

/** Кружок с прогресс-кольцом, заполняющимся по мере истечения окна (§6.10). */
function VideoCircle({ progress }: { progress: number }) {
  const r = (CIRCLE_SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <View style={styles.circleWrap}>
      <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE} style={StyleSheet.absoluteFill}>
        <Circle
          cx={CIRCLE_SIZE / 2} cy={CIRCLE_SIZE / 2} r={r}
          stroke={colors.ink} strokeOpacity={0.15} strokeWidth={RING_STROKE} fill="none"
        />
        <Circle
          cx={CIRCLE_SIZE / 2} cy={CIRCLE_SIZE / 2} r={r}
          stroke={colors.ink} strokeWidth={RING_STROKE} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - progress)}
          strokeLinecap="round"
          transform={`rotate(-90 ${CIRCLE_SIZE / 2} ${CIRCLE_SIZE / 2})`}
        />
      </Svg>
      <View style={styles.circleInner}>
        <Text style={styles.circleGlyph}>🎥</Text>
      </View>
    </View>
  );
}

export function AlarmRingScreen({ navigation }: { navigation: { replace: (route: string) => void } }) {
  const run = useStore((s) => s.activeRun);
  const completeRun = useStore((s) => s.completeRun);
  const failRun = useStore((s) => s.failRun);

  const [remaining, setRemaining] = useState(() =>
    run ? remainingWindowMs(run.id) : 0,
  );
  const settled = useRef(false);

  // §6.10: аппаратная кнопка «назад» на экране срабатывания не работает —
  // испытание нельзя закрыть, его можно только пройти или провалить.
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => subscription.remove();
  }, []);

  const finish = useCallback(
    (won: boolean) => {
      if (settled.current) return;
      settled.current = true;
      if (won) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        completeRun();
        navigation.replace('Win');
      } else {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        failRun();
        navigation.replace('Fail');
      }
    },
    [completeRun, failRun, navigation],
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

  const elapsed = 1 - remaining / CHALLENGE_WINDOW_MS;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <View style={styles.stakeBadge}>
          <Text style={styles.stakeLabel}>{stakeLabel}</Text>
        </View>
        <Text style={styles.countdown}>⏳ {formatCountdown(remaining)}</Text>
      </View>

      <View style={styles.top}>
        <Text style={styles.time}>
          {new Date().getHours().toString().padStart(2, '0')}:
          {new Date().getMinutes().toString().padStart(2, '0')}
        </Text>
        <View style={styles.circleColumn}>
          <VideoCircle progress={elapsed} />
          <Text style={styles.recBadge}>● запись — не в демо</Text>
        </View>
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
  // §6.10: сплошной лаймовый фон — максимальный контраст, будит.
  screen: {
    flex: 1,
    backgroundColor: colors.lime,
    padding: spacing.lg,
    gap: spacing.md,
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

  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  time: {
    ...type.display,
    fontSize: scale(62),
  },
  circleColumn: { alignItems: 'center', gap: 6 },
  circleWrap: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleInner: {
    width: CIRCLE_SIZE - RING_STROKE * 4,
    height: CIRCLE_SIZE - RING_STROKE * 4,
    borderRadius: CIRCLE_SIZE,
    backgroundColor: colors.limeSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleGlyph: { fontSize: 30 },
  recBadge: {
    fontFamily: fonts.bold,
    fontSize: scale(10),
    color: colors.inkSoft,
  },

  challengeTitle: { marginTop: spacing.xs },
  challenge: { flex: 1, justifyContent: 'center' },
});
