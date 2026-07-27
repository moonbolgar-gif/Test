/**
 * Тёмная премиальная поверхность и элементы поверх неё. docs/SPEC.md §5.1, §6.18.
 *
 * Используется на экранах-событиях: победа, провал, RISE+, герой импакта.
 * Рутинные экраны (Дом, Команда, Профиль) остаются светлыми — если тёмным станет
 * всё, «премиальные» моменты перестанут выделяться и приём перестанет работать.
 */

import { type ReactNode, useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, darkSurface, fonts, onDark, radius, spacing } from '../design/tokens';
import { scale } from '../design/type';

// ─── Светящаяся орба ─────────────────────────────────────────────────────────

/**
 * Мягкое цветное пятно, медленно дрейфующее по фону (§6.18).
 *
 * Намеренно без BlurView: размытие поверх градиента заметно роняет кадры на
 * Android, а нужная мягкость достигается низкой прозрачностью и большим радиусом.
 */
export function Orb({
  color, size, left, top, opacity = 0.24, duration = 8000,
}: {
  color: string;
  size: number;
  left: number;
  top: number;
  opacity?: number;
  duration?: number;
}) {
  const drift = useSharedValue(0);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [drift, duration]);

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateX: drift.value * 46 - 23 },
      { translateY: drift.value * 34 - 17 },
      { scale: 1 + drift.value * 0.08 },
    ],
  }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left, top,
          width: size, height: size,
          borderRadius: size / 2,
          backgroundColor: color,
          opacity,
        },
        style,
      ]}
    />
  );
}

// ─── Поверхность ─────────────────────────────────────────────────────────────

export function DarkSurface({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  /** Оттенок свечения под настроение экрана. */
  tone?: 'neutral' | 'win' | 'fail';
}) {
  const accent = tone === 'fail' ? colors.bad : colors.lime;
  const secondary = tone === 'fail' ? '#8A5CF6' : colors.blue;

  return (
    <View style={styles.surface}>
      <LinearGradient
        colors={[darkSurface.top, darkSurface.mid, darkSurface.bottom]}
        style={StyleSheet.absoluteFill}
      />
      <Orb color={accent} size={260} left={-80} top={-30} opacity={0.22} duration={7400} />
      <Orb color={secondary} size={200} left={200} top={120} opacity={0.14} duration={9600} />
      {children}
    </View>
  );
}

// ─── Стеклянная карточка ─────────────────────────────────────────────────────

export function GlassCard({
  children,
  style,
  accent = false,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Подсветить границу лаймом — для карточки, на которой держится экран. */
  accent?: boolean;
}) {
  return (
    <View
      style={[
        styles.glass,
        accent ? styles.glassAccent : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ─── Типографика поверх тёмного ──────────────────────────────────────────────

export function DarkTitle({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <Text style={[styles.title, style as never]}>{children}</Text>;
}

export function DarkEyebrow({ children, color }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.eyebrow, color ? { color } : null]}>{children}</Text>;
}

export function DarkBody({ children }: { children: ReactNode }) {
  return <Text style={styles.body}>{children}</Text>;
}

export function DarkCaption({ children }: { children: ReactNode }) {
  return <Text style={styles.caption}>{children}</Text>;
}

export function DarkLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.label}>{children}</Text>;
}

const styles = StyleSheet.create({
  surface: { flex: 1, backgroundColor: darkSurface.mid },

  glass: {
    backgroundColor: onDark.glass,
    borderWidth: 1,
    borderColor: onDark.glassBorder,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  glassAccent: {
    borderColor: 'rgba(214,248,76,0.35)',
    backgroundColor: 'rgba(214,248,76,0.07)',
  },

  title: {
    fontFamily: fonts.extrabold,
    fontSize: scale(30),
    lineHeight: scale(30) * 1.06,
    letterSpacing: scale(30) * -0.03,
    color: onDark.text,
    textAlign: 'center',
  },
  eyebrow: {
    fontFamily: fonts.extrabold,
    fontSize: scale(11.5),
    letterSpacing: scale(11.5) * 0.16,
    textTransform: 'uppercase',
    color: colors.lime,
  },
  body: {
    fontFamily: fonts.medium,
    fontSize: scale(14.5),
    lineHeight: scale(14.5) * 1.5,
    color: onDark.textSoft,
  },
  caption: {
    fontFamily: fonts.medium,
    fontSize: scale(12.5),
    lineHeight: scale(12.5) * 1.45,
    color: onDark.textFaint,
  },
  label: {
    fontFamily: fonts.bold,
    fontSize: scale(14.5),
    color: onDark.text,
  },
});
