/**
 * Экран провала. docs/SPEC.md §6.13.
 *
 * Тон по §16: без унижения, с надеждой. Ссылка «Оспорить списание» обязательна
 * (§14.3) — без неё продукт теряет доверие, а вместе с ним пользователей.
 */

import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { Card } from '../components/primitives';
import { colors, fonts, spacing } from '../design/tokens';
import { scale, type } from '../design/type';
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

  const title = isMoneyMode
    ? `${formatMoney(stakeCents)} списано.`
    : 'Серия обнулена.';

  // §16: тон без унижения. Прежняя длина серии называется прямо — потеря
  // должна ощущаться, иначе механика не работает, — но следом идёт надежда.
  const lost = outcome?.streakBefore ?? 0;
  const subtitle = lost > 0
    ? `Ты потерял серию из ${lost} ${pluralDays(lost)}. Завтра можно начать заново.`
    : isMoneyMode
      ? 'Завтра новый шанс. Вот куда ушли деньги.'
      : 'Завтра можно начать заново.';

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        <Text style={styles.emoji}>💸</Text>
        <Text style={[type.eyebrow, styles.eyebrow]}>БУДИЛЬНИК ПОБЕДИЛ</Text>
        <Text style={[type.h1, styles.title]}>{title}</Text>
        <Text style={[type.body, styles.subtitle]}>{subtitle}</Text>

        {isMoneyMode ? (
          <Card style={styles.receipt}>
            {breakdown ? (
              <>
                <Row label="💚 Благотворительность" value={breakdown.charity} />
                <Row label="🏢 Платформа" value={breakdown.platform} />
                <Row label="🎁 Фонд наград" value={breakdown.reward_pool} />
                <Row label="🌱 Сервисный сбор" value={breakdown.fee} />
                <View style={styles.divider} />
                <View style={styles.row}>
                  <Text style={type.label}>Итого</Text>
                  <Text style={[styles.total]}>
                    −{formatMoney(stakeCents + breakdown.fee)}
                  </Text>
                </View>
              </>
            ) : (
              <Text style={type.caption}>Загружаем разбивку…</Text>
            )}
          </Card>
        ) : null}

        {/* §6.6: в командном режиме показываем, как утро прошло у остальных —
            иначе непонятно, подвёл ли пользователь только себя. */}
        {outcome?.squad ? (
          <Card style={styles.squad}>
            <Text style={type.eyebrow}>УТРО КОМАНДЫ</Text>
            {outcome.squad.members.map((member) => (
              <View key={member.id} style={styles.squadRow}>
                <Text style={type.body}>
                  {member.wokeUp ? '✓' : '😴'} {member.name}
                </Text>
                <Text style={type.caption}>
                  {member.wokeUp
                    ? `встал в ${member.wokeUpAt}`
                    : `взнос ${formatMoney(member.forfeitedCents)} в фонд`}
                </Text>
              </View>
            ))}
          </Card>
        ) : null}

        {isMoneyMode ? (
          <Pressable
            accessibilityRole="button"
            onPress={() =>
              Alert.alert(
                'Оспорить списание',
                'В демо форма не отправляется. По §14.3 первое обращение в течение 30 дней одобряется автоматически.',
              )
            }
          >
            <Text style={styles.dispute}>Оспорить списание</Text>
          </Pressable>
        ) : null}
      </View>

      <Button label="На главную" variant="primary" onPress={() => navigation.popToTop()} />
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.row}>
      <Text style={type.body}>{label}</Text>
      <Text style={type.label}>{formatMoney(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.sm },
  emoji: { fontSize: 52 },
  eyebrow: { color: colors.bad },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: spacing.md },

  receipt: { width: '100%', gap: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  divider: { height: 1, backgroundColor: colors.line, marginVertical: spacing.xs },
  total: {
    fontFamily: fonts.extrabold,
    fontSize: scale(16),
    color: colors.bad,
  },

  dispute: {
    ...type.label,
    color: colors.inkSoft,
    textDecorationLine: 'underline',
    marginTop: spacing.md,
  },

  squad: { width: '100%', gap: spacing.sm, marginTop: spacing.sm },
  squadRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
