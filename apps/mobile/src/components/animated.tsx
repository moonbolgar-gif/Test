/**
 * Анимированные компоненты §5.4: StreakFlame, Mascot, Confetti, Toast.
 */

import { useEffect, useMemo } from 'react';
import { Dimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing,
  FadeInUp,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts, radius, shadow, spacing } from '../design/tokens';
import { scale, type } from '../design/type';

// ─── StreakFlame ─────────────────────────────────────────────────────────────

/** Огонёк стрика с анимацией «дыхания» (§5.4). */
export function StreakFlame({ size = 28 }: { size?: number }) {
  const breath = useSharedValue(0);

  useEffect(() => {
    breath.value = withRepeat(
      withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [breath]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + breath.value * 0.12 }],
    opacity: 0.85 + breath.value * 0.15,
  }));

  return (
    <Animated.Text style={[{ fontSize: size }, style]} accessibilityLabel="стрик">
      🔥
    </Animated.Text>
  );
}

// ─── Mascot ──────────────────────────────────────────────────────────────────

/** §7.4 — пять стадий эволюции. Индекс 1..5. */
export const MASCOT_STAGES = ['😴', '🙂', '🦊', '🔥', '👑'] as const;
export const MASCOT_NAMES = [
  'Соня',
  'Просыпающийся',
  'Бодрый',
  'Огненный',
  'Король утра',
] as const;

/** §7.4 — стадия по стрику. */
export function mascotStageForStreak(streak: number): number {
  if (streak >= 60) return 5;
  if (streak >= 21) return 4;
  if (streak >= 7) return 3;
  if (streak >= 3) return 2;
  return 1;
}

/** Маскот с анимацией покачивания (§5.4). */
export function Mascot({ stage, size = 64 }: { stage: number; size?: number }) {
  const sway = useSharedValue(0);

  useEffect(() => {
    sway.value = withRepeat(
      withTiming(1, { duration: 2200, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [sway]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { rotate: `${-4 + sway.value * 8}deg` },
      { translateY: -sway.value * 3 },
    ],
  }));

  const index = Math.min(Math.max(stage, 1), MASCOT_STAGES.length) - 1;

  return (
    <Animated.Text
      style={[{ fontSize: size }, style]}
      accessibilityLabel={`маскот: ${MASCOT_NAMES[index]}`}
    >
      {MASCOT_STAGES[index]}
    </Animated.Text>
  );
}

// ─── Confetti ────────────────────────────────────────────────────────────────

const CONFETTI_COUNT = 44;                          // §5.4
const CONFETTI_COLORS = [colors.lime, colors.blue, colors.good, '#FFB27C', '#B69CFF'];

function ConfettiPiece({ index }: { index: number }) {
  const progress = useSharedValue(0);

  // Параметры считаются один раз: пересчёт на каждом кадре сделал бы полёт дёрганым.
  const config = useMemo(() => {
    const width = Dimensions.get('window').width;
    // Псевдослучайность, детерминированная по индексу — конфетти не должно
    // перестраиваться при каждом ререндере.
    const rand = (seed: number) => {
      const x = Math.sin(index * 12.9898 + seed * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    return {
      startX: rand(1) * width,
      drift: (rand(2) - 0.5) * 160,
      // §5.4: длительность 1.4–2.3 сек.
      duration: 1400 + rand(3) * 900,
      delay: rand(4) * 350,
      size: 7 + rand(5) * 7,
      color: CONFETTI_COLORS[Math.floor(rand(6) * CONFETTI_COLORS.length)],
      spin: (rand(7) - 0.5) * 900,
    };
  }, [index]);

  useEffect(() => {
    progress.value = withDelay(
      config.delay,
      withTiming(1, { duration: config.duration, easing: Easing.out(Easing.quad) }),
    );
  }, [config, progress]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: progress.value * Dimensions.get('window').height * 0.9 },
      { translateX: progress.value * config.drift },
      { rotate: `${progress.value * config.spin}deg` },
    ],
    opacity: 1 - Math.max(0, progress.value - 0.75) * 4,
  }));

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: -20,
          left: config.startX,
          width: config.size,
          height: config.size * 1.6,
          backgroundColor: config.color,
          borderRadius: 2,
        },
        style,
      ]}
    />
  );
}

export function Confetti() {
  const pieces = useMemo(
    () => Array.from({ length: CONFETTI_COUNT }, (_, i) => i),
    [],
  );
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {pieces.map((i) => (
        <ConfettiPiece key={i} index={i} />
      ))}
    </View>
  );
}

// ─── Toast ───────────────────────────────────────────────────────────────────

/** Всплывающее сообщение сверху, 2.5 сек (§5.4). Управляется из useToast. */
export function Toast({ message }: { message: string }) {
  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOut.duration(180)}
      style={[styles.toast, shadow.lg]}
      pointerEvents="none"
    >
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ─── Пульсация (CTA на экране RISE+) ─────────────────────────────────────────

export function usePulse(active = true) {
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (!active) return;
    pulse.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 900, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [active, pulse]);

  return useAnimatedStyle(() => ({
    shadowOpacity: 0.3 + pulse.value * 0.45,
    shadowRadius: 14 + pulse.value * 16,
  }));
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    top: 8,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: colors.black,
    borderRadius: radius.cardSm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    zIndex: 100,
  },
  toastText: {
    ...type.label,
    color: colors.card,
    fontFamily: fonts.bold,
    fontSize: scale(14),
    textAlign: 'center',
  },
});
