/**
 * <Button> — §5.4.
 * Варианты: primary (чёрный), lime, ghost (белый + тень), outline.
 * Состояния: default / pressed (scale .97) / disabled (opacity .4) / loading.
 */

import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts, radius, shadow, spacing } from '../design/tokens';
import { scale } from '../design/type';

export type ButtonVariant = 'primary' | 'lime' | 'ghost' | 'outline';

interface Props {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

const PALETTE: Record<ButtonVariant, { bg: string; fg: string; border?: string }> = {
  primary: { bg: colors.black, fg: colors.card },
  lime: { bg: colors.lime, fg: colors.ink },
  ghost: { bg: colors.card, fg: colors.ink },
  outline: { bg: 'transparent', fg: colors.ink, border: colors.line2 },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
}: Props) {
  const pressed = useSharedValue(0);
  const palette = PALETTE[variant];
  const inactive = disabled || loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - pressed.value * 0.03 }],
  }));

  const containerStyle = useMemo(
    () => [
      styles.base,
      { backgroundColor: palette.bg },
      palette.border ? { borderWidth: 1.5, borderColor: palette.border } : null,
      variant === 'ghost' ? shadow.sm : null,
      inactive ? styles.inactive : null,
    ],
    [palette, variant, inactive],
  );

  return (
    <Animated.View style={[animatedStyle, style]}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled: inactive, busy: loading }}
        disabled={inactive}
        onPress={onPress}
        onPressIn={() => {
          pressed.value = withTiming(1, { duration: 90 });
        }}
        onPressOut={() => {
          pressed.value = withTiming(0, { duration: 130 });
        }}
        style={containerStyle}
      >
        {/* Индикатор кладётся поверх, а не вместо текста: иначе кнопка меняет
            ширину при переходе в loading и «дёргается». */}
        <Text style={[styles.label, { color: palette.fg, opacity: loading ? 0 : 1 }]}>
          {label}
        </Text>
        {loading ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <ActivityIndicator color={palette.fg} style={styles.spinner} />
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactive: { opacity: 0.4 },
  label: {
    fontFamily: fonts.extrabold,
    fontSize: scale(16),
    letterSpacing: -0.2,
    textAlign: 'center',
  },
  spinner: { flex: 1 },
});
