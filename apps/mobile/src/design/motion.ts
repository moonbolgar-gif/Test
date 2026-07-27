/**
 * Параметры движения. Единый источник для всех анимаций приложения.
 *
 * Принцип: интерфейс должен ощущаться физическим, а не «проигрывать анимации».
 * Поэтому почти всё построено на пружинах, а не на линейных таймингах — пружина
 * реагирует на прерывание естественно, а `withTiming` при быстрых повторных
 * нажатиях выглядит дёргано.
 *
 * Длительности подобраны по ощущению отклика: до 100 мс воспринимается как
 * мгновенно, 200–300 мс — как «предмет сдвинулся», больше 400 мс на реакцию
 * нажатия читается как тормоза.
 */

import { Easing, type WithSpringConfig, type WithTimingConfig } from 'react-native-reanimated';

export const spring = {
  /** Нажатия и мелкие отклики: быстро, без перелёта. */
  press: { damping: 26, stiffness: 420, mass: 0.7 } satisfies WithSpringConfig,
  /** Появление элементов: чуть мягче, с еле заметным перелётом. */
  enter: { damping: 18, stiffness: 200, mass: 0.9 } satisfies WithSpringConfig,
  /** Празднование: заметный перелёт, читается как «прыжок». */
  celebrate: { damping: 11, stiffness: 170, mass: 1 } satisfies WithSpringConfig,
  /** Крупные перестроения макета. */
  layout: { damping: 22, stiffness: 160, mass: 1 } satisfies WithSpringConfig,
} as const;

export const timing = {
  fast: { duration: 140, easing: Easing.out(Easing.quad) } satisfies WithTimingConfig,
  base: { duration: 260, easing: Easing.out(Easing.cubic) } satisfies WithTimingConfig,
  slow: { duration: 520, easing: Easing.out(Easing.cubic) } satisfies WithTimingConfig,
  /** Для счётчиков: замедление к концу делает финальное число «весомым». */
  count: { duration: 900, easing: Easing.out(Easing.exp) } satisfies WithTimingConfig,
} as const;

/**
 * Каскад появления. §6.18 задаёт задержки 50/150/270/390/510/630 мс —
 * шаг растёт, потому что равномерный каскад читается как механический список,
 * а нарастающий — как разворачивающаяся сцена.
 */
export function stagger(index: number, base = 50): number {
  return base + index * 120;
}
