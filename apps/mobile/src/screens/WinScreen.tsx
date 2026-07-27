/**
 * Экран победы. docs/SPEC.md §6.12.
 */

import { Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { Confetti } from '../components/animated';
import { Card } from '../components/primitives';
import { colors, fonts, radius, spacing } from '../design/tokens';
import { scale, type } from '../design/type';
import { formatMoney, pluralDays } from '../lib/format';
import { useStore } from '../lib/store';

/** Превью шеринг-карточки 9:16 (§6.12). Настоящий композитинг — §4.3, Фаза 3. */
function ShareCardPreview({ streak }: { streak: number }) {
  return (
    <View style={styles.shareCard}>
      <Text style={styles.shareLogo}>RISE</Text>
      <View style={styles.shareCenter}>
        <Text style={styles.shareStreak}>{streak}</Text>
        <Text style={styles.shareStreakLabel}>DAY STREAK 🔥</Text>
      </View>
      <Text style={styles.shareHook}>я победил будильник 💪{'\n'}а ты сможешь?</Text>
    </View>
  );
}

export function WinScreen({ navigation }: { navigation: { popToTop: () => void } }) {
  const outcome = useStore((s) => s.lastOutcome);
  const profile = useStore((s) => s.profile);
  const markShared = useStore((s) => s.markShared);

  const title = outcome?.mode === 'stake'
    ? 'Деньги целы.'
    : outcome?.mode === 'squad'
      ? 'Команда не подвела!'
      : 'Серия спасена.';

  const subtitle = outcome?.mode === 'stake'
    ? `${formatMoney(outcome.stakeCents)} остались у тебя!`
    : outcome?.mode === 'squad'
      ? 'Все встали вовремя. Командная серия растёт.'
      : 'Ты победил себя сегодня. Серия растёт!';

  const share = async (): Promise<void> => {
    markShared();
    try {
      await Share.share({
        message: `я победил будильник 💪 серия ${profile.streak} ${pluralDays(profile.streak)}\nа ты сможешь? rise.app`,
      });
    } catch {
      // Пользователь закрыл системный лист — это не ошибка.
    }
  };

  return (
    <SafeAreaView style={styles.screen}>
      <Confetti />

      <View style={styles.content}>
        <Text style={styles.emoji}>🎉</Text>
        <Text style={[type.eyebrow, styles.eyebrow]}>ТЫ ПОБЕДИЛ СОН</Text>
        <Text style={[type.h1, styles.title]}>{title}</Text>
        <Text style={[type.body, styles.subtitle]}>{subtitle}</Text>

        <ShareCardPreview streak={profile.streak} />
        <Text style={[type.caption, styles.shareNote]}>Готово к Stories · 9:16</Text>

        {profile.streak > 0 && profile.streak % 10 === 0 ? (
          <Card tone="lime" style={styles.reward}>
            <Text style={type.label}>🌳 Ты посадил дерево!</Text>
          </Card>
        ) : null}
      </View>

      <View style={styles.actions}>
        <Button label="📲 Поделиться" variant="lime" onPress={share} />
        <Button label="На главную" variant="ghost" onPress={() => navigation.popToTop()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.lg,
    justifyContent: 'space-between',
  },
  content: { alignItems: 'center', gap: spacing.sm, flex: 1, justifyContent: 'center' },
  emoji: { fontSize: 52 },
  eyebrow: { color: colors.good },
  title: { textAlign: 'center' },
  subtitle: { textAlign: 'center', marginBottom: spacing.md },

  shareCard: {
    width: 168,
    aspectRatio: 9 / 16,
    backgroundColor: colors.black,
    borderRadius: radius.cardSm,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  shareLogo: {
    fontFamily: fonts.extrabold,
    fontSize: scale(14),
    color: colors.lime,
    letterSpacing: 1,
  },
  shareCenter: { alignItems: 'center' },
  shareStreak: {
    fontFamily: fonts.extrabold,
    fontSize: scale(52),
    color: colors.card,
    letterSpacing: -2,
  },
  shareStreakLabel: {
    fontFamily: fonts.extrabold,
    fontSize: scale(10),
    color: colors.lime,
    letterSpacing: 1.4,
  },
  shareHook: {
    fontFamily: fonts.bold,
    fontSize: scale(11),
    color: colors.card,
    lineHeight: 15,
  },
  shareNote: { marginTop: spacing.xs },

  reward: { marginTop: spacing.md, paddingVertical: spacing.md },

  actions: { gap: spacing.sm },
});
