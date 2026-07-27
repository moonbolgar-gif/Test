/**
 * Импакт. docs/SPEC.md §6.15.
 *
 * Формулировки намеренно осторожные: §6.15 предупреждает, что до договора
 * с эко-фондом нельзя утверждать, будто деревья уже посажены — это гринвошинг
 * и юридический риск. Пока говорим «направляем средства».
 */

import { ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '../components/Button';
import { Card } from '../components/primitives';
import { colors, fonts, radius, spacing } from '../design/tokens';
import { scale, type } from '../design/type';
import { useStore } from '../lib/store';

const COMMUNITY_TREES = 12_480;
const COMMUNITY_GOAL = 15_000;

/** §6.15: партнёрские награды показываются заблюренными с плашкой «Скоро». */
const PARTNERS = [
  { icon: '🎵', name: 'Spotify Premium', condition: 'за серию 30 дней' },
  { icon: '✈️', name: 'Telegram Premium', condition: 'за серию 21 день' },
  { icon: '🎧', name: 'YouTube Premium', condition: 'за серию 30 дней' },
  { icon: '👟', name: 'Nike-дроп', condition: 'топ челленджа' },
];

export function ImpactScreen() {
  const profile = useStore((s) => s.profile);
  const progress = Math.min(COMMUNITY_TREES / COMMUNITY_GOAL, 1);

  const share = (): void => {
    Share.share({
      message: `Я направил на посадку ${profile.trees} деревьев, просто просыпаясь 🌳 rise.app`,
    }).catch(() => {});
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Card tone="lime" style={styles.hero}>
          <Text style={styles.heroIcon}>🌳</Text>
          <Text style={styles.heroValue}>{COMMUNITY_TREES.toLocaleString('ru-RU')}</Text>
          <Text style={type.body}>деревьев оплатило сообщество</Text>
          <View style={styles.track}>
            <View style={[styles.trackFill, { width: `${progress * 100}%` }]} />
          </View>
          <Text style={type.caption}>
            Цель: {COMMUNITY_GOAL.toLocaleString('ru-RU')} к концу месяца
          </Text>
        </Card>

        <Card style={styles.personal}>
          <Text style={type.eyebrow}>🌱 ТВОЙ ЛИЧНЫЙ ВКЛАД</Text>
          <Text style={styles.personalValue}>{profile.trees} деревьев</Text>
          <Text style={type.caption}>за {profile.totalWakes} подъёмов</Text>
        </Card>

        <Text style={type.body}>
          Каждый подъём вовремя и каждый сервисный сбор идут на посадку деревьев через
          эко-фонды. Просыпаешься — планета зеленеет 🌍
        </Text>

        <Button label="📲 Поделиться вкладом" variant="primary" onPress={share} />

        <Text style={[type.eyebrow, styles.section]}>🎁 НАГРАДЫ ОТ ПАРТНЁРОВ</Text>
        {PARTNERS.map((partner) => (
          <Card key={partner.name} style={styles.partner}>
            {/* Содержимое приглушено, поверх — плашка «Скоро». Настоящий blur
                на статичной карточке избыточен и стоит кадров. */}
            <View style={styles.partnerContent}>
              <Text style={styles.partnerIcon}>{partner.icon}</Text>
              <View style={styles.partnerText}>
                <Text style={type.label}>{partner.name}</Text>
                <Text style={type.caption}>{partner.condition}</Text>
              </View>
            </View>
            <View style={styles.lockOverlay}>
              <Text style={styles.lockLabel}>🔒 Скоро</Text>
            </View>
          </Card>
        ))}

        <Text style={[type.caption, styles.partnerCta]}>
          Хочешь, чтобы твой бренд был здесь? Стать партнёром →
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  hero: { gap: spacing.xs, alignItems: 'flex-start' },
  heroIcon: { fontSize: 34 },
  heroValue: { ...type.display, fontSize: scale(44) },
  track: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(22,24,29,0.15)',
    marginTop: spacing.xs,
  },
  trackFill: { height: '100%', borderRadius: 4, backgroundColor: colors.ink },

  personal: { gap: 2 },
  personalValue: { ...type.h2, marginTop: spacing.xs },

  section: { marginTop: spacing.sm },

  partner: { padding: spacing.md, overflow: 'hidden' },
  partnerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    opacity: 0.25,
  },
  partnerIcon: { fontSize: 26 },
  partnerText: { flex: 1, gap: 2 },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockLabel: {
    fontFamily: fonts.extrabold,
    fontSize: scale(12.5),
    color: colors.inkSoft,
    backgroundColor: colors.bg,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  partnerCta: { textAlign: 'center', marginTop: spacing.xs },
});
