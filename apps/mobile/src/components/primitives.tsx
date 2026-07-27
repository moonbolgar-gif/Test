/**
 * Мелкие переиспользуемые компоненты §5.4: Card, Pill, OptionRow, Avatar, StatCard.
 */

import { type ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { colors, fonts, radius, shadow, spacing } from '../design/tokens';
import { scale, type } from '../design/type';

// ─── Card ────────────────────────────────────────────────────────────────────

export function Card({
  children,
  style,
  tone = 'white',
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'white' | 'lime';
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: tone === 'lime' ? colors.lime : colors.card },
        shadow.sm,
        style,
      ]}
    >
      {children}
    </View>
  );
}

// ─── Pill ────────────────────────────────────────────────────────────────────

export function Pill({
  label,
  tone = 'neutral',
  style,
}: {
  label: string;
  tone?: 'neutral' | 'lime' | 'good' | 'bad' | 'dark';
  style?: StyleProp<ViewStyle>;
}) {
  const palette = {
    neutral: { bg: colors.line, fg: colors.inkSoft },
    lime: { bg: colors.lime, fg: colors.ink },
    good: { bg: '#E4F7ED', fg: colors.good },
    bad: { bg: '#FFE9EA', fg: colors.bad },
    dark: { bg: colors.black, fg: colors.card },
  }[tone];

  return (
    <View style={[styles.pill, { backgroundColor: palette.bg }, style]}>
      <Text style={[styles.pillLabel, { color: palette.fg }]}>{label}</Text>
    </View>
  );
}

// ─── OptionRow ───────────────────────────────────────────────────────────────

export function OptionRow({
  icon,
  title,
  description,
  selected = false,
  onPress,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  selected?: boolean;
  onPress?: () => void;
  /** Раскрывающийся блок под строкой — например, слайдер суммы в §6.6. */
  children?: ReactNode;
}) {
  return (
    <View
      style={[
        styles.option,
        selected ? styles.optionSelected : styles.optionIdle,
      ]}
    >
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        onPress={onPress}
        style={styles.optionHeader}
      >
        <View style={styles.optionIcon}>
          <Text style={styles.optionIconGlyph}>{icon}</Text>
        </View>
        <View style={styles.optionText}>
          <Text style={type.label}>{title}</Text>
          <Text style={[type.caption, styles.optionDescription]}>{description}</Text>
        </View>
        <View style={[styles.radio, selected ? styles.radioOn : null]}>
          {selected ? <View style={styles.radioDot} /> : null}
        </View>
      </Pressable>
      {selected && children ? <View style={styles.optionBody}>{children}</View> : null}
    </View>
  );
}

// ─── Avatar ──────────────────────────────────────────────────────────────────

/** §5.4: цвет по хешу id — один и тот же пользователь всегда одного цвета. */
const AVATAR_COLORS = ['#7CC4FF', '#D6F84C', '#FFB27C', '#B69CFF', '#7CE8C0', '#FF9CB4'];

export function avatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function Avatar({
  id,
  name,
  size = 44,
  dimmed = false,
}: {
  id: string;
  name: string;
  size?: number;
  dimmed?: boolean;
}) {
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatarColor(id),
          opacity: dimmed ? 0.45 : 1,
        },
      ]}
    >
      <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>
        {name.trim().charAt(0).toUpperCase() || '?'}
      </Text>
    </View>
  );
}

// ─── StatCard ────────────────────────────────────────────────────────────────

export function StatCard({
  value,
  label,
  tone = 'neutral',
  style,
}: {
  value: string;
  label: string;
  tone?: 'neutral' | 'good' | 'bad';
  style?: StyleProp<ViewStyle>;
}) {
  const valueColor = {
    neutral: colors.ink,
    good: colors.good,
    bad: colors.bad,
  }[tone];

  return (
    <Card style={[styles.stat, style]}>
      <Text style={[styles.statValue, { color: valueColor }]} numberOfLines={1}
        adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      <Text style={[type.caption, styles.statLabel]}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    padding: spacing.lg,
  },

  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  pillLabel: {
    fontFamily: fonts.extrabold,
    fontSize: scale(12.5),
  },

  option: {
    borderRadius: radius.cardSm,
    borderWidth: 2,
    marginBottom: spacing.md,
    overflow: 'hidden',
  },
  optionIdle: { borderColor: colors.line2, backgroundColor: colors.card },
  optionSelected: { borderColor: colors.ink, backgroundColor: colors.limeSoft },
  optionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.md,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.icon,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line2,
  },
  optionIconGlyph: { fontSize: 22 },
  optionText: { flex: 1, gap: 2 },
  optionDescription: { lineHeight: 17 },
  optionBody: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: colors.ink },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.ink,
  },

  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: {
    fontFamily: fonts.extrabold,
    color: colors.ink,
  },

  stat: { flex: 1, padding: spacing.md, gap: 2 },
  statValue: {
    fontFamily: fonts.extrabold,
    fontSize: scale(24),
    letterSpacing: -0.5,
  },
  statLabel: { fontSize: scale(12) },
});
