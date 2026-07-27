/**
 * Испытание C — тряхни телефон ×20. docs/SPEC.md §6.11 C.
 *
 * Порог суммы модулей ускорения > 32, дебаунс 250 мс. Значения из §6.11
 * рассчитаны на единицы g, которые отдаёт expo-sensors.
 */

import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Accelerometer } from 'expo-sensors';

import { colors, fonts, radius, spacing } from '../../design/tokens';
import { scale, type } from '../../design/type';

const REQUIRED = 20;
const THRESHOLD = 32;
const DEBOUNCE_MS = 250;
const SAMPLE_INTERVAL_MS = 60;

export function ShakeChallenge({ onSolved }: { onSolved: () => void }) {
  const [count, setCount] = useState(0);
  const [available, setAvailable] = useState<boolean | null>(null);

  const lastShakeAt = useRef(0);
  // Счётчик читается и пишется из обработчика сенсора, поэтому дублируется в ref:
  // замыкание подписки видит только первое значение состояния.
  const countRef = useRef(0);
  const solvedRef = useRef(false);

  const register = (): void => {
    if (solvedRef.current) return;

    const now = Date.now();
    if (now - lastShakeAt.current < DEBOUNCE_MS) return;
    lastShakeAt.current = now;

    countRef.current += 1;
    setCount(countRef.current);

    // §5.5: haptic на каждую засчитанную тряску, selection каждые 5.
    if (countRef.current % 5 === 0) {
      Haptics.selectionAsync();
    } else {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (countRef.current >= REQUIRED) {
      solvedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSolved();
    }
  };

  useEffect(() => {
    let subscription: { remove: () => void } | null = null;
    let cancelled = false;

    Accelerometer.isAvailableAsync()
      .then((ok) => {
        if (cancelled) return;
        setAvailable(ok);
        if (!ok) return;

        Accelerometer.setUpdateInterval(SAMPLE_INTERVAL_MS);
        subscription = Accelerometer.addListener(({ x, y, z }) => {
          const magnitude = (Math.abs(x) + Math.abs(y) + Math.abs(z)) * 10;
          if (magnitude > THRESHOLD) register();
        });
      })
      .catch(() => {
        if (!cancelled) setAvailable(false);
      });

    return () => {
      cancelled = true;
      subscription?.remove();
    };
    // Подписка ставится один раз: пересоздание сбрасывало бы дебаунс.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progress = Math.min(count / REQUIRED, 1);

  return (
    <View style={styles.container}>
      <Text style={styles.counter}>
        {count}
        <Text style={styles.counterTotal}>/{REQUIRED}</Text>
      </Text>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${progress * 100}%` }]} />
      </View>

      <Text style={[type.caption, styles.hint]}>
        {available === false
          ? 'Акселерометр недоступен на этом устройстве'
          : 'Тряхни телефон'}
      </Text>

      {/* §6.11 C: резервная кнопка для симулятора. В проде скрыта — здесь она
          видна, потому что вся сборка является демонстрационной. */}
      {(__DEV__ || available === false || Platform.OS === 'web') ? (
        <Pressable
          accessibilityRole="button"
          onPress={register}
          style={({ pressed }) => [styles.fallback, pressed ? styles.fallbackPressed : null]}
        >
          <Text style={styles.fallbackLabel}>Тряхнуть (демо)</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md, alignItems: 'center' },
  counter: {
    ...type.display,
    fontSize: scale(64),
  },
  counterTotal: {
    fontFamily: fonts.extrabold,
    fontSize: scale(28),
    color: colors.inkFaint,
  },
  track: {
    width: '100%',
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.line2,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: colors.ink, borderRadius: 5 },
  hint: { textAlign: 'center' },
  fallback: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: colors.line2,
  },
  fallbackPressed: { transform: [{ scale: 0.97 }] },
  fallbackLabel: {
    fontFamily: fonts.bold,
    fontSize: scale(14),
    color: colors.inkSoft,
  },
});
