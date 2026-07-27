/**
 * Экран провала. docs/SPEC.md §6.13.
 *
 * Тон по §16: без унижения, с надеждой. Потеря должна ощущаться — иначе вся
 * механика продукта не работает, — но экран не должен добивать. Поэтому цифра
 * потери названа прямо, а рядом сразу стоит «завтра можно начать заново».
 *
 * Ссылка «Оспорить списание» обязательна (§14.3): без неё продукт теряет доверие,
 * а вместе с ним пользователей.
 */

import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';

import { Button } from '../components/Button';
import {
  DarkBody,
  DarkCaption,
  DarkEyebrow,
  DarkLabel,
  DarkSurface,
  DarkTitle,
  GlassCard,
} from '../components/dark';
import { Avatar } from '../components/primitives';
import { colors, fonts, onDark, radius, spacing } from '../design/tokens';
import { stagger } from '../design/motion';
import { scale } from '../design/type';
import { fetchServiceFee, fetchStakeSplit, splitStake } from '../lib/demoServer';
import { formatMoney, pluralDays } from '../lib/format';
import { useStore } from '../lib/store';

interface Breakdown {
  charity: number;
  platform: number;
  reward_pool: number;
  fee: number;
}

export function FailScreen({ navigation }: { navigation: { popToTop: () => void } }) {
  const outcome = useStore((s) => s.lastOutcome);
  const [breakdown, setBreakdown] = useState<Breakdown | null>(null);

  const stakeCents = outcome?.stakeCents ?? 0;
  const isMoneyMode = outcome?.mode !== 'free' && stakeCents > 0;

  // §5.5: провал — notificationError, один раз. Повторять не нужно, экран
  // и без того неприятный.
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  }, []);

  // §8.2: доли приходят с сервера, а не заданы в компоненте.
  useEffect(() => {
    if (!isMoneyMode) return;
    let cancelled = false;
    Promise.all([fetchStakeSplit(), fetchServiceFee()]).then(([split, fee]) => {
      if (cancelled) return;
      const parts = splitStake(stakeCents, split);
      setBreakdown({ ...parts, fee: fee.cents });
    });
    return () => {
      cancelled = true;
    };
  }, [isMoneyMode, stakeCents]);

  const title = isMoneyMode ? `${formatMoney(stakeCents)} списано.` : 'Серия обнулена.';

  const lost = outcome?.streakBefore ?? 0;
  const subtitle = lost > 0
    ? `Ты потерял серию из ${lost} ${pluralDays(lost)}. Завтра можно начать заново.`
    : isMoneyMode
      ? 'Завтра новый шанс. Вот куда ушли деньги.'
      : 'Завтра можно начать заново.';

  return (
    <DarkSurface tone="fail">
      <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Animated.View entering={FadeIn.delay(stagger(0)).duration(400)} style={styles.headline}>
            <Text style={styles.emoji}>💸</Text>
            <DarkEyebrow color={colors.bad}>БУДИЛЬНИК ПОБЕДИЛ</DarkEyebrow>
            <DarkTitle>{title}</DarkTitle>
            <View style={styles.subtitle}>
              <DarkBody>{subtitle}</DarkBody>
            </View>
          </Animated.View>

          {isMoneyMode ? (
            <Animated.View entering={FadeInDown.delay(stagger(1)).springify()}>
              <GlassCard style={styles.receipt}>
                <DarkEyebrow>КУДА УШЛИ ДЕНЬГИ</DarkEyebrow>
                {breakdown ? (
                  <>
                    <Row label="💚 Благотворительность" value={breakdown.charity} />
                    <Row label="🏢 Платформа" value={breakdown.platform} />
                    <Row label="🎁 Фонд наград" value={breakdown.reward_pool} />
                    <Row label="🌱 Сервисный сбор" value={breakdown.fee} />
                    <View style={styles.divider} />
                    <View style={styles.row}>
                      <DarkLabel>Итого</DarkLabel>
                      <Text style={styles.total}>
                        −{formatMoney(stakeCents + breakdown.fee)}
                      </Text>
                    </View>
                  </>
                ) : (
                  <DarkCaption>Загружаем разбивку…</DarkCaption>
                )}
              </GlassCard>
            </Animated.View>
          ) : null}

          {/* §6.6: в командном режиме показываем, как утро прошло у остальных —
              иначе непонятно, подвёл ли пользователь только себя. */}
          {outcome?.squad ? (
            <Animated.View entering={FadeInDown.delay(stagger(2)).springify()}>
              <GlassCard style={styles.squad}>
                <DarkEyebrow>УТРО КОМАНДЫ</DarkEyebrow>
                {outcome.squad.members.map((member) => (
                  <View key={member.id} style={styles.squadRow}>
                    <Avatar id={member.id} name={member.name} size={32} dimmed={!member.wokeUp} />
                    <View style={styles.squadText}>
                      <DarkLabel>{member.name}</DarkLabel>
                      <DarkCaption>
                        {member.wokeUp
                          ? `встал в ${member.wokeUpAt}`
                          : `проспал · взнос ${formatMoney(member.forfeitedCents)} в фонд`}
                      </DarkCaption>
                    </View>
                    <Text style={member.wokeUp ? styles.ok : styles.fail}>
                      {member.wokeUp ? '✓' : '😴'}
                    </Text>
                  </View>
                ))}
              </GlassCard>
            </Animated.View>
          ) : null}

          {isMoneyMode ? (
            <Animated.View entering={FadeIn.delay(stagger(3))}>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  Alert.alert(
                    'Оспорить списание',
                    'В демо форма не отправляется. По §14.3 первое обращение в течение '
                    + '30 дней одобряется автоматически, а решение приходит за 72 часа.',
                  )
                }
                style={styles.disputeButton}
              >
                <Text style={styles.dispute}>Оспорить списание</Text>
              </Pressable>
            </Animated.View>
          ) : null}
        </ScrollView>

        <Animated.View entering={FadeIn.delay(stagger(4))} style={styles.actions}>
          <Button label="Завтра отыграюсь" variant="lime" onPress={() => navigation.popToTop()} />
        </Animated.View>
      </SafeAreaView>
    </DarkSurface>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.row}>
      <DarkBody>{label}</DarkBody>
      <DarkLabel>{formatMoney(value)}</DarkLabel>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: spacing.lg,
    gap: spacing.md,
    flexGrow: 1,
    justifyContent: 'center',
  },

  headline: { alignItems: 'center', gap: spacing.xs },
  emoji: { fontSize: 52 },
  subtitle: { paddingHorizontal: spacing.md, marginTop: 2 },

  receipt: { gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: {
    height: 1,
    backgroundColor: onDark.glassBorder,
    marginVertical: spacing.xs,
  },
  total: {
    fontFamily: fonts.extrabold,
    fontSize: scale(17),
    color: colors.bad,
  },

  squad: { gap: spacing.sm },
  squadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  squadText: { flex: 1, gap: 1 },
  ok: { fontSize: 15, color: colors.good },
  fail: { fontSize: 15 },

  disputeButton: { alignSelf: 'center', padding: spacing.sm },
  dispute: {
    fontFamily: fonts.bold,
    fontSize: scale(14),
    color: onDark.textSoft,
    textDecorationLine: 'underline',
  },

  actions: { padding: spacing.lg, paddingTop: spacing.sm },
});
