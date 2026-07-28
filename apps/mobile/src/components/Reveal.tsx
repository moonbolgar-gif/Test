/**
 * Появление блока и досчитывающееся число — на встроенной анимации React Native.
 *
 * Почему не Reanimated, которым сделано остальное: экраны итога (§6.12, §6.13)
 * — единственное место, где пользователь узнаёт, засчитано ли испытание и целы
 * ли деньги. Здесь надёжность важнее возможностей. Встроенный Animated работает
 * без воркетов и без слоя, который приходится синхронизировать с нативной
 * стороной, поэтому на этих экранах используется он.
 *
 * Остальные экраны продолжают жить на Reanimated — там цена сбоя ниже.
 */

import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

/** Блок, всплывающий снизу с задержкой. */
export function Reveal({
  children,
  delay = 0,
  distance = 18,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 420,
      delay,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [delay, progress]);

  return (
    <Animated.View
      style={[
        {
          opacity: progress,
          transform: [
            {
              translateY: progress.interpolate({
                inputRange: [0, 1],
                outputRange: [distance, 0],
              }),
            },
          ],
        },
        style,
      ]}
    >
      {children}
    </Animated.View>
  );
}

/**
 * Число, досчитывающее до значения.
 *
 * Реализовано на таймере, а не на анимированном значении: текст всё равно
 * обновляется в JS, а таймер не требует моста между потоками и не может
 * оставить висящую подписку.
 */
export function CountUp({
  value,
  from = 0,
  delay = 0,
  duration = 900,
  format = (n: number) => String(n),
  style,
}: {
  value: number;
  from?: number;
  delay?: number;
  duration?: number;
  format?: (value: number) => string;
  style?: StyleProp<TextStyle>;
}) {
  const [shown, setShown] = useState(from);

  useEffect(() => {
    if (value === from) {
      setShown(value);
      return;
    }

    let frame: ReturnType<typeof setInterval> | null = null;
    const start = Date.now() + delay;

    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed < 0) return;

      // Замедление к концу делает финальное число «весомым».
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setShown(Math.round(from + (value - from) * eased));

      if (t >= 1 && frame) {
        clearInterval(frame);
        frame = null;
      }
    }, 32);
    frame = timer;

    return () => {
      if (frame) clearInterval(frame);
    };
  }, [delay, duration, from, value]);

  return <Animated.Text style={style}>{format(shown)}</Animated.Text>;
}
