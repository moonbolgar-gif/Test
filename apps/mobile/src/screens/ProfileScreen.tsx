/**
 * Профиль. docs/SPEC.md §6.16.
 */

import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Mascot } from '../components/animated';
import { Avatar, Card, Pill } from '../components/primitives';
import { colors, darkSurface, fonts, radius, spacing } from '../design/tokens';
import { scale, type } from '../design/type';
import { formatMoney, pluralDays } from '../lib/format';
import { useMascotStage, useStore } from '../lib/store';

const ACHIEVEMENTS = [
  { icon: '🌅', label: 'Первый подъём', unlocked: true },
  { icon: '🔥', label: 'Серия 7', unlocked: true },
  { icon: '👑', label: 'Серия 30', unlocked: false },
  { icon: '👥', label: 'Собрал команду', unlocked: true },
  { icon: '🎬', label: '10 публикаций', unlocked: false },
  { icon: '🌳', label: '50 деревьев', unlocked: false },
];

export function ProfileScreen({ navigation }: { navigation: { navigate: (r: string) => void } }) {
  const profile = useStore((s) => s.profile);
  const vouchers = useStore((s) => s.vouchers);
  const revealVoucher = useStore((s) => s.revealVoucher);
  const stage = useMascotStage();

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={type.h2}>Профиль</Text>
          <Avatar id={profile.id} name={profile.name} size={44} />
        </View>

        <Card tone="lime" style={styles.hero}>
          <Text style={styles.heroIcon}>🔥</Text>
          <Text style={styles.heroValue}>{profile.streak}</Text>
          <Text style={type.body}>{pluralDays(profile.streak)} подряд</Text>
          <Text style={type.caption}>
            Рекорд: {profile.bestStreak} {pluralDays(profile.bestStreak)} · {profile.points} поинтов
          </Text>
        </Card>

        {profile.isPremium ? (
          <Card style={styles.premiumActive}>
            <Text style={type.label}>RISE+ активен</Text>
          </Card>
        ) : (
          <Pressable onPress={() => navigation.navigate('RisePlus')}>
            <View style={styles.promo}>
              <Mascot stage={3} size={40} />
              <View style={styles.promoText}>
                <Text style={styles.promoTitle}>
                  RISE+ · <Text style={styles.promoAccent}>режим силы</Text>
                </Text>
                <Text style={styles.promoSub}>Живой маскот, ×1.5 ко всему, кастом видео</Text>
              </View>
              <Pill label="$1.99" tone="lime" />
            </View>
          </Pressable>
        )}

        <Text style={type.eyebrow}>ДОСТИЖЕНИЯ</Text>
        <View style={styles.achievements}>
          {ACHIEVEMENTS.map((achievement) => (
            <View
              key={achievement.label}
              style={[styles.achievement, achievement.unlocked ? null : styles.locked]}
            >
              <Text style={styles.achievementIcon}>{achievement.icon}</Text>
              <Text style={styles.achievementLabel} numberOfLines={2}>
                {achievement.label}
              </Text>
            </View>
          ))}
        </View>

        <Text style={type.eyebrow}>🎟️ МОИ НАГРАДЫ</Text>
        {vouchers.length > 0 ? (
          vouchers.map((voucher) => (
            <Pressable key={voucher.id} onPress={() => revealVoucher(voucher.id)}>
              <Card tone="lime" style={styles.voucher}>
                <Text style={styles.voucherIcon}>{voucher.icon}</Text>
                <View style={styles.voucherText}>
                  <Text style={type.label}>{voucher.brand}</Text>
                  <Text style={type.caption}>
                    {voucher.revealed ? `КОД: ${voucher.code}` : 'Нажми, чтобы использовать'}
                  </Text>
                </View>
                <Text style={styles.voucherValue}>{formatMoney(voucher.amountCents)}</Text>
              </Card>
            </Pressable>
          ))
        ) : (
          <Card style={styles.empty}>
            <Text style={[type.caption, styles.emptyText]}>
              Пока пусто. Проходи испытания и выигрывай челленджи — награды появятся здесь 🎟️
            </Text>
          </Card>
        )}

        <Card style={styles.links}>
          {['Настройки', 'Помощь', 'Условия использования', 'Политика конфиденциальности'].map(
            (label) => (
              <Pressable
                key={label}
                accessibilityRole="link"
                onPress={() => Alert.alert(label, 'В демо этот раздел не реализован.')}
                style={styles.link}
              >
                <Text style={type.body}>{label}</Text>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ),
          )}
          <Pressable
            accessibilityRole="link"
            onPress={() =>
              Alert.alert(
                'Удалить аккаунт',
                'В демо аккаунта нет. В проде удаление обязательно по правилам сторов (§14.4).',
              )
            }
            style={styles.link}
          >
            <Text style={[type.body, styles.danger]}>Удалить аккаунт</Text>
          </Pressable>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  hero: { alignItems: 'flex-start', gap: 2 },
  heroIcon: { fontSize: 30 },
  heroValue: { ...type.display },

  premiumActive: { alignItems: 'center' },

  promo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: darkSurface.mid,
    borderRadius: radius.card,
    padding: spacing.lg,
  },
  promoText: { flex: 1, gap: 3 },
  promoTitle: { fontFamily: fonts.extrabold, fontSize: scale(17), color: colors.card },
  promoAccent: { fontFamily: fonts.accent, fontStyle: 'italic', color: colors.lime },
  promoSub: { fontFamily: fonts.medium, fontSize: scale(12.5), color: colors.inkFaint },

  achievements: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  achievement: {
    width: '30.5%',
    aspectRatio: 1,
    backgroundColor: colors.card,
    borderRadius: radius.cardSm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    padding: spacing.sm,
  },
  locked: { opacity: 0.4 },
  achievementIcon: { fontSize: 26 },
  achievementLabel: {
    fontFamily: fonts.bold,
    fontSize: scale(10.5),
    color: colors.inkSoft,
    textAlign: 'center',
  },

  voucher: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  voucherIcon: { fontSize: 26 },
  voucherText: { flex: 1, gap: 2 },
  voucherValue: { fontFamily: fonts.extrabold, fontSize: scale(18), color: colors.ink },

  empty: { paddingVertical: spacing.lg },
  emptyText: { textAlign: 'center' },

  links: { paddingVertical: spacing.xs },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
  },
  chevron: { fontSize: scale(22), color: colors.inkFaint },
  danger: { color: colors.bad },
});
