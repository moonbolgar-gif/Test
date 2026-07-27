/**
 * Число, которое досчитывает до значения. Используется для серии, поинтов и сумм.
 *
 * Смысл не в украшательстве: досчитывающееся число заставляет взгляд задержаться
 * на нём и превращает «стало 5» в событие. Для §6.12, где счётчик серии —
 * эмоциональный центр экрана, это ключевой приём.
 */

import { useEffect, useState } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import {
  useAnimatedReaction,
  useSharedValue,
  withDelay,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';

import { timing } from '../design/motion';

interface Props {
  value: number;
  /** С какого значения начинать. По умолчанию — с нуля. */
  from?: number;
  delay?: number;
  style?: StyleProp<TextStyle>;
  /** Преобразование числа в строку: деньги, проценты и т.п. */
  format?: (value: number) => string;
}

export function AnimatedNumber({
  value,
  from = 0,
  delay = 0,
  style,
  format = (n) => String(Math.round(n)),
}: Props) {
  const progress = useSharedValue(from);
  const [shown, setShown] = useState(from);

  useEffect(() => {
    progress.value = from;
    progress.value = withDelay(delay, withTiming(value, timing.count));
  }, [delay, from, progress, value]);

  // Текст обновляется из JS-потока: рисовать цифры на UI-потоке нечем, а
  // округлённое значение меняется куда реже, чем идут кадры.
  useAnimatedReaction(
    () => Math.round(progress.value),
    (current, previous) => {
      if (current !== previous) runOnJS(setShown)(current);
    },
  );

  return <Text style={style}>{format(shown)}</Text>;
}
