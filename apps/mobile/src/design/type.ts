/**
 * Типографика. docs/SPEC.md §5.2.
 *
 * §5.2 требует clamp-подобного масштабирования по ширине экрана и отдельно
 * оговаривает, что крупные цифры не должны обрезаться на узких экранах
 * (iPhone SE, 375pt). Поэтому размеры не константы, а функция от ширины.
 */

import { Dimensions, type TextStyle } from 'react-native';

import { colors, fonts } from './tokens';

/** Ширина, под которую нарисован макет. */
const BASE_WIDTH = 390;
/** iPhone SE — нижняя граница, ниже которой не масштабируем. */
const MIN_WIDTH = 320;
/** Выше этой ширины текст не растёт: на планшете крупный шрифт выглядит нелепо. */
const MAX_WIDTH = 430;

/**
 * Масштаб по ширине экрана, ограниченный сверху и снизу.
 *
 * Коэффициент 0.5 намеренно смягчает масштабирование: при линейном пересчёте
 * display-цифры на SE ужимаются сильнее, чем нужно, и теряют вес в композиции.
 */
export function scale(size: number, width = Dimensions.get('window').width): number {
  const clamped = Math.min(Math.max(width, MIN_WIDTH), MAX_WIDTH);
  const ratio = 1 + ((clamped - BASE_WIDTH) / BASE_WIDTH) * 0.5;
  return Math.round(size * ratio);
}

type TypeStyle = TextStyle & { fontFamily: string };

function build(width?: number) {
  const s = (size: number) => scale(size, width);

  return {
    h1: {
      fontFamily: fonts.extrabold,
      fontSize: s(34),
      lineHeight: s(34) * 1.03,
      letterSpacing: s(34) * -0.03,
      color: colors.ink,
    },
    h2: {
      fontFamily: fonts.extrabold,
      fontSize: s(26),
      lineHeight: s(26) * 1.06,
      letterSpacing: s(26) * -0.03,
      color: colors.ink,
    },
    title: {
      fontFamily: fonts.extrabold,
      fontSize: s(18),
      color: colors.ink,
    },
    body: {
      fontFamily: fonts.medium,
      fontSize: s(15),
      lineHeight: s(15) * 1.5,
      color: colors.inkSoft,
    },
    label: {
      fontFamily: fonts.bold,
      fontSize: s(14.5),
      color: colors.ink,
    },
    caption: {
      fontFamily: fonts.medium,
      fontSize: s(13),
      color: colors.inkFaint,
    },
    eyebrow: {
      fontFamily: fonts.extrabold,
      fontSize: s(11.5),
      letterSpacing: s(11.5) * 0.16,
      textTransform: 'uppercase',
      color: colors.ink,
    },
    /** Цифры стрика. Самый уязвимый к обрезанию стиль — см. §5.2. */
    display: {
      fontFamily: fonts.extrabold,
      fontSize: s(60),
      lineHeight: s(60) * 1.02,
      letterSpacing: s(60) * -0.04,
      color: colors.ink,
    },
    /** §5.2 — Fraunces italic для эмоциональных слов. */
    accent: {
      fontFamily: fonts.accent,
      fontStyle: 'italic',
    },
  } satisfies Record<string, TypeStyle | TextStyle>;
}

export const type = build();

/** Пересчёт под конкретную ширину — для useWindowDimensions в компонентах. */
export const typeFor = build;
