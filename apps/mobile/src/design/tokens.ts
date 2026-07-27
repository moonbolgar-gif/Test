/**
 * Дизайн-токены RISE. docs/SPEC.md §5.
 *
 * Значения перенесены из §5.1–5.3 без изменений. Всё, что рисуется в приложении,
 * берёт цвета, размеры и тени отсюда — литералов в компонентах быть не должно.
 */

export const colors = {
  bg: '#ECEEF0',
  card: '#FFFFFF',
  ink: '#16181D',
  inkSoft: '#5C616B',
  inkFaint: '#9AA0AB',
  lime: '#D6F84C',
  limeDeep: '#C2E82F',
  limeSoft: '#EEFBB6',
  black: '#16181D',
  good: '#34C77B',
  bad: '#FF5A5F',
  blue: '#7CC4FF',
  line: '#EEF0F2',
  line2: '#E2E5EA',
} as const;

/**
 * §5.1 — тёмная поверхность. В ТЗ она отведена под экран RISE+ и промо-карточки;
 * по решению владельца продукта расширена на экраны-события (победа, провал,
 * импакт-герой), где нужна премиальная подача. Рутинные экраны остаются светлыми.
 *
 * Исключение — экран срабатывания §6.10: он обязан оставаться сплошным лаймовым.
 * Тёмный фон там сломал бы сразу две вещи: контраст, которым будильник будит,
 * и подсветку лица для фронтальной камеры.
 */
export const darkSurface = {
  top: '#23262E',
  mid: '#16181D',
  bottom: '#0E0F13',
} as const;

/** Текст и поверхности поверх тёмного фона. */
export const onDark = {
  text: '#FFFFFF',
  textSoft: '#A8AEBA',
  textFaint: '#6E7482',
  /** Стеклянная карточка: заливка, граница и её подсветка сверху. */
  glass: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.10)',
  glassStrong: 'rgba(255,255,255,0.10)',
} as const;

export const radius = { card: 28, cardSm: 18, pill: 100, icon: 15 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 20, xl: 28, xxl: 40 } as const;

/**
 * §5.3 задаёт тени в CSS-нотации. React Native их не понимает, поэтому здесь
 * эквиваленты: iOS через shadow*, Android через elevation.
 */
export const shadow = {
  sm: {
    shadowColor: '#141820',
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 10 },
    elevation: 6,
  },
  lg: {
    shadowColor: '#141820',
    shadowOpacity: 0.32,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 26 },
    elevation: 14,
  },
} as const;

/** Начертания Plus Jakarta Sans, зарегистрированные в src/design/fonts.ts. */
export const fonts = {
  regular: 'Jakarta_400Regular',
  medium: 'Jakarta_500Medium',
  semibold: 'Jakarta_600SemiBold',
  bold: 'Jakarta_700Bold',
  extrabold: 'Jakarta_800ExtraBold',
  /** §5.2 — акцентный Fraunces italic, только для эмоциональных слов. */
  accent: 'Fraunces_600SemiBold_Italic',
} as const;
