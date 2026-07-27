/**
 * RISE+. docs/SPEC.md §6.18 — «самый красивый экран приложения».
 *
 * В демо покупка не совершается. По §8.4 подписка продаётся исключительно через
 * StoreKit / Google Play Billing — продажа через Stripe означает бан в App Store,
 * поэтому здесь заглушка, а не какой-либо платёжный вызов.
 */

import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Button } from '../components/Button';
import { MASCOT_STAGES, Mascot } from '../components/animated';
import { colors, darkSurface, fonts, radius, spacing } from '../design/tokens';
import { scale } from '../design/type';

const FEATURES = [
  {
    icon: '🦊',
    title: 'Живой маскот',
    text: 'Растёт и эволюционирует с каждым подъёмом. Настроения, формы, реакции на твои победы.',
    tag: null,
  },
  {
    icon: '⚡️',
    title: 'Режим силы',
    text: 'Множитель ×1.5 на всё: поинты, деревья, место в лидерборде, шанс на награды.',
    tag: '×1.5',
  },
  {
    icon: '🎬',
    title: 'Кастом видео-кружков',
    text: 'Эксклюзивные рамки, эффекты, анимации серии и фоновая музыка для твоих Stories.',
    tag: null,
  },
  {
    icon: '🌳',
    title: 'Двойной импакт',
    text: 'Удваиваем твой вклад в посадку деревьев.',
    tag: null,
  },
];

/** Светящаяся орба с медленным дрейфом (§6.18). */
function Orb({
  color, size, left, top, opacity, duration,
}: {
  color: string; size: number; left: number; top: number; opacity: number; duration: number;
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
      { translateX: drift.value * 40 - 20 },
      { translateY: drift.value * 30 - 15 },
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

export function RisePlusScreen({ navigation }: { navigation: { goBack: () => void } }) {
  return (
    <View style={styles.root}>
      <LinearGradient
        colors={[darkSurface.top, darkSurface.mid, darkSurface.bottom]}
        style={StyleSheet.absoluteFill}
      />
      {/* Орбы намеренно без blur: BlurView поверх градиента на Android даёт
          заметное падение кадров, а мягкость здесь достигается прозрачностью. */}
      <Orb color={colors.lime} size={220} left={-60} top={40} opacity={0.28} duration={7000} />
      <Orb color={colors.blue} size={180} left={220} top={140} opacity={0.16} duration={9000} />

      <SafeAreaView style={styles.safe}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="закрыть"
            onPress={() => navigation.goBack()}
            style={styles.close}
          >
            <Text style={styles.closeGlyph}>✕</Text>
          </Pressable>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>RISE+</Text>
          </View>
          <View style={styles.close} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeInDown.delay(50)} style={styles.headline}>
            <Text style={styles.wordmark}>
              RISE<Text style={styles.plus}>+</Text>
            </Text>
            <Text style={styles.tagline}>режим силы</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(150)} style={styles.mascotRing}>
            <View style={styles.mascotInner}>
              <Mascot stage={3} size={68} />
            </View>
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(270)} style={styles.stages}>
            {MASCOT_STAGES.map((glyph, index) => (
              <Text
                key={glyph}
                style={[styles.stage, index === 2 ? styles.stageCurrent : null]}
              >
                {glyph}
              </Text>
            ))}
          </Animated.View>

          <Animated.Text entering={FadeInDown.delay(390)} style={styles.mascotNote}>
            Твой маскот эволюционирует вместе с дисциплиной. Бросишь — откатится назад.
            Не бросишь 😏
          </Animated.Text>

          {FEATURES.map((feature, index) => (
            <Animated.View
              key={feature.title}
              entering={FadeInDown.delay(390 + index * 120)}
              style={styles.feature}
            >
              <Text style={styles.featureIcon}>{feature.icon}</Text>
              <View style={styles.featureText}>
                <View style={styles.featureTitleRow}>
                  <Text style={styles.featureTitle}>{feature.title}</Text>
                  {feature.tag ? (
                    <View style={styles.featureTag}>
                      <Text style={styles.featureTagText}>{feature.tag}</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={styles.featureBody}>{feature.text}</Text>
              </View>
            </Animated.View>
          ))}

          <View style={styles.priceBlock}>
            <Text style={styles.price}>$1.99</Text>
            <Text style={styles.priceNote}>в месяц · отмена в любой момент</Text>
            <View style={styles.coffee}>
              <Text style={styles.coffeeText}>☕️ дешевле одной чашки кофе</Text>
            </View>
          </View>

          <Button
            label="Попробовать 7 дней бесплатно"
            variant="lime"
            onPress={() => navigation.goBack()}
          />
          <Text style={styles.fineprint}>
            Демо: покупка не совершается. В релизе — только через App Store и Google Play.
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: darkSurface.mid },
  safe: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  closeGlyph: { color: colors.card, fontSize: scale(20) },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  badgeText: { fontFamily: fonts.extrabold, fontSize: scale(12), color: colors.card },

  headline: { alignItems: 'center', gap: 2 },
  wordmark: {
    fontFamily: fonts.extrabold,
    fontSize: scale(40),
    color: colors.card,
    letterSpacing: -1.5,
  },
  plus: { fontFamily: fonts.accent, fontStyle: 'italic', color: colors.lime },
  tagline: { fontFamily: fonts.accent, fontStyle: 'italic', fontSize: scale(16), color: colors.lime },

  mascotRing: {
    alignSelf: 'center',
    width: 148, height: 148, borderRadius: 74,
    backgroundColor: colors.lime,
    alignItems: 'center', justifyContent: 'center',
  },
  mascotInner: {
    width: 132, height: 132, borderRadius: 66,
    backgroundColor: darkSurface.bottom,
    alignItems: 'center', justifyContent: 'center',
  },

  stages: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, alignItems: 'center' },
  stage: { fontSize: 20, opacity: 0.35 },
  stageCurrent: { fontSize: 30, opacity: 1 },

  mascotNote: {
    fontFamily: fonts.medium,
    fontSize: scale(13),
    color: colors.inkFaint,
    textAlign: 'center',
    lineHeight: 19,
  },

  feature: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    borderRadius: radius.cardSm,
    padding: spacing.md,
  },
  featureIcon: { fontSize: 24 },
  featureText: { flex: 1, gap: 4 },
  featureTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  featureTitle: { fontFamily: fonts.extrabold, fontSize: scale(15), color: colors.card },
  featureTag: {
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.lime,
  },
  featureTagText: { fontFamily: fonts.extrabold, fontSize: scale(11), color: colors.ink },
  featureBody: {
    fontFamily: fonts.medium,
    fontSize: scale(12.5),
    color: colors.inkFaint,
    lineHeight: 18,
  },

  priceBlock: { alignItems: 'center', gap: 4, marginTop: spacing.sm },
  price: {
    fontFamily: fonts.extrabold,
    fontSize: scale(46),
    color: colors.card,
    letterSpacing: -1.5,
  },
  priceNote: { fontFamily: fonts.medium, fontSize: scale(12.5), color: colors.inkFaint },
  coffee: {
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  coffeeText: { fontFamily: fonts.bold, fontSize: scale(12), color: colors.card },

  fineprint: {
    fontFamily: fonts.medium,
    fontSize: scale(11.5),
    color: colors.inkFaint,
    textAlign: 'center',
  },
});
