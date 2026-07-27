/**
 * Экран победы. docs/SPEC.md §6.12.
 *
 * Эмоциональный пик продукта — единственный момент, когда усилие окупается.
 * Поэтому итог не сворачивается в строку, а разворачивается по частям: серия,
 * сохранённые деньги, награды, утро команды. Каждый блок появляется отдельно,
 * чтобы взгляд успевал на нём остановиться.
 *
 * Тёмная подача (§5.1 + решение владельца продукта): событие должно
 * отличаться от рутины. Дом и Команда остаются светлыми.
 *
 * Чего не хватает до §4.3: композитинга — слои живут поверх видео в интерфейсе,
 * но не вплавлены в файл. Это `RiseVideoModule` либо ffmpeg, Фаза 3.
 */

import { useEffect, useState } from 'react';
import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { VideoView, useVideoPlayer } from 'expo-video';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';

import { AnimatedNumber } from '../components/AnimatedNumber';
import { Button } from '../components/Button';
import { Confetti, StreakFlame } from '../components/animated';
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
import { colors, fonts, onDark, radius, shadow, spacing } from '../design/tokens';
import { stagger } from '../design/motion';
import { scale } from '../design/type';
import { formatMoney, pluralDays } from '../lib/format';
import { useStore } from '../lib/store';

/** §4.3 — превью карточки 9:16 поверх записанного видео. */
function ShareCardPreview({ streak, videoUri }: { streak: number; videoUri: string | null }) {
  // Плеер создаётся всегда: хук нельзя вызывать условно. При null источнике
  // expo-video просто ничего не показывает.
  const player = useVideoPlayer(videoUri, (instance) => {
    try {
      instance.loop = true;
      instance.muted = true;
      instance.play();
    } catch {
      // Битый файл не должен ронять экран победы — карточка покажется без видео.
    }
  });

  return (
    <View style={styles.shareCard}>
      {videoUri ? (
        <VideoView
          player={player}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          nativeControls={false}
        />
      ) : null}

      <View style={styles.scrimTop} pointerEvents="none" />
      <View style={styles.scrimBottom} pointerEvents="none" />

      <View style={styles.shareContent}>
        <Text style={styles.shareLogo}>RISE</Text>
        <View style={styles.shareCenter}>
          <Text style={styles.shareStreak}>{streak}</Text>
          <Text style={styles.shareStreakLabel}>DAY STREAK 🔥</Text>
        </View>
        <Text style={styles.shareHook}>я победил будильник 💪{'\n'}а ты сможешь?</Text>
      </View>
    </View>
  );
}

export function WinScreen({ navigation }: { navigation: { popToTop: () => void } }) {
  const outcome = useStore((s) => s.lastOutcome);
  const profile = useStore((s) => s.profile);
  const markShared = useStore((s) => s.markShared);
  const [shareBusy, setShareBusy] = useState(false);

  // §5.5: тактильная волна в такт появлению блоков. Один импульс на длинном
  // экране теряется, поэтому их два.
  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const second = setTimeout(
      () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
      700,
    );
    return () => clearTimeout(second);
  }, []);

  if (!outcome) return null;

  const isMoneyMode = outcome.mode !== 'free' && outcome.stakeCents > 0;

  const title = outcome.mode === 'stake'
    ? 'Деньги целы.'
    : outcome.mode === 'squad'
      ? outcome.squad?.perfectRound ? 'Команда не подвела!' : 'Ты своих не подвёл.'
      : 'Серия спасена.';

  const share = async (): Promise<void> => {
    setShareBusy(true);
    markShared();
    const message = `я победил будильник 💪 серия ${outcome.streakAfter} ${pluralDays(outcome.streakAfter)}\nа ты сможешь? rise.app`;
    try {
      // §4.4: файл уходит только по явному действию пользователя.
      await Share.share(
        outcome.videoUri && Platform.OS === 'ios'
          ? { url: outcome.videoUri, message }
          : { message },
      );
    } catch {
      // Пользователь закрыл системный лист — это не ошибка.
    } finally {
      setShareBusy(false);
    }
  };

  return (
    <DarkSurface tone="win">
      <SafeAreaView style={styles.screen}>
        <Confetti />

        <Animated.ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View entering={ZoomIn.delay(stagger(0)).springify()} style={styles.headline}>
            <Text style={styles.emoji}>🎉</Text>
            <DarkEyebrow color={colors.good}>ТЫ ПОБЕДИЛ СОН</DarkEyebrow>
            <DarkTitle>{title}</DarkTitle>
          </Animated.View>

          {/* Серия — главный счётчик экрана. Досчитывается от прежнего значения,
              чтобы был виден именно прирост, а не просто число. */}
          <Animated.View entering={FadeInDown.delay(stagger(1)).springify()}>
            <GlassCard accent style={styles.streakCard}>
              <View style={styles.streakTop}>
                <StreakFlame size={24} />
                <DarkEyebrow>СЕРИЯ ПОДЪЁМОВ</DarkEyebrow>
              </View>
              <View style={styles.streakRow}>
                <AnimatedNumber
                  value={outcome.streakAfter}
                  from={outcome.streakBefore}
                  delay={420}
                  style={styles.streakValue}
                />
                <Text style={styles.streakUnit}>{pluralDays(outcome.streakAfter)}</Text>
              </View>
              <DarkBody>
                {outcome.streakAfter === 1
                  ? 'Первый день. Дальше будет проще — и сложнее одновременно.'
                  : outcome.streakAfter % 7 === 0
                    ? `Ровно ${outcome.streakAfter / 7} недел${outcome.streakAfter === 7 ? 'я' : 'и'} без единого пропуска.`
                    : `День ${outcome.streakAfter}. Огонёк горит, не дай ему погаснуть.`}
              </DarkBody>
            </GlassCard>
          </Animated.View>

          {/* §6.12: при денежном режиме прямо говорим, что деньги остались. */}
          {isMoneyMode ? (
            <Animated.View entering={FadeInDown.delay(stagger(2)).springify()}>
              <GlassCard style={styles.moneyCard}>
                <View style={styles.moneyIcon}>
                  <Text style={styles.moneyGlyph}>💚</Text>
                </View>
                <View style={styles.moneyText}>
                  <DarkEyebrow color={colors.good}>ДЕНЬГИ ОСТАЛИСЬ У ТЕБЯ</DarkEyebrow>
                  <AnimatedNumber
                    value={outcome.stakeCents}
                    delay={620}
                    format={formatMoney}
                    style={styles.moneyValue}
                  />
                  <DarkCaption>
                    Списан только сервисный сбор. Сама сумма никуда не ушла.
                  </DarkCaption>
                </View>
              </GlassCard>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(stagger(3)).springify()} style={styles.rewards}>
            <RewardTile
              icon="⚡️"
              value={`+${outcome.pointsEarned}`}
              label={profile.isPremium ? 'поинтов · ×1.5' : 'поинтов'}
            />
            <RewardTile
              icon="🌳"
              value={outcome.treeEarned ? '+1' : `${profile.trees}`}
              label={outcome.treeEarned ? 'новое дерево' : 'деревьев'}
              highlight={outcome.treeEarned}
            />
          </Animated.View>

          {/* §6.6 — итог командного челленджа. */}
          {outcome.squad ? (
            <Animated.View entering={FadeInDown.delay(stagger(4)).springify()}>
              <GlassCard style={styles.squadCard}>
                <DarkEyebrow>УТРО КОМАНДЫ</DarkEyebrow>

                {outcome.squad.members.map((member) => (
                  <View key={member.id} style={styles.squadRow}>
                    <Avatar id={member.id} name={member.name} size={34} dimmed={!member.wokeUp} />
                    <View style={styles.squadText}>
                      <DarkLabel>{member.name}</DarkLabel>
                      <DarkCaption>
                        {member.wokeUp
                          ? `встал в ${member.wokeUpAt}`
                          : `проспал · взнос ${formatMoney(member.forfeitedCents)} в фонд`}
                      </DarkCaption>
                    </View>
                    <Text style={member.wokeUp ? styles.squadOk : styles.squadFail}>
                      {member.wokeUp ? '✓' : '😴'}
                    </Text>
                  </View>
                ))}

                {outcome.voucherEarned ? (
                  <View style={styles.voucherBox}>
                    <Text style={styles.voucherGlyph}>🎟️</Text>
                    <View style={styles.voucherText}>
                      <DarkLabel>
                        Награда {formatMoney(outcome.voucherEarned.amountCents)} — в профиле
                      </DarkLabel>
                      {/* §14.1: принципиальная формулировка, а не юридическая
                          придирка. Деньги проспавших уходят в обезличенный фонд,
                          награду выдаёт платформа из своего. */}
                      <DarkCaption>
                        Платформа выдаёт её из фонда наград. Это не деньги тех, кто проспал.
                      </DarkCaption>
                    </View>
                  </View>
                ) : null}
              </GlassCard>
            </Animated.View>
          ) : null}

          <Animated.View entering={FadeInDown.delay(stagger(5)).springify()} style={styles.shareBlock}>
            <ShareCardPreview streak={outcome.streakAfter} videoUri={outcome.videoUri} />
            <DarkCaption>
              {outcome.videoUri ? 'Готово к Stories · 9:16' : 'Видео не записано · 9:16'}
            </DarkCaption>
          </Animated.View>
        </Animated.ScrollView>

        <Animated.View entering={FadeIn.delay(stagger(6))} style={styles.actions}>
          <Button label="📲 Поделиться" variant="lime" onPress={share} loading={shareBusy} />
          <Button label="На главную" variant="outlineDark" onPress={() => navigation.popToTop()} />
        </Animated.View>
      </SafeAreaView>
    </DarkSurface>
  );
}

function RewardTile({
  icon, value, label, highlight = false,
}: { icon: string; value: string; label: string; highlight?: boolean }) {
  return (
    <View style={[styles.tile, highlight ? styles.tileHighlight : null]}>
      <Text style={styles.tileIcon}>{icon}</Text>
      <Text style={styles.tileValue}>{value}</Text>
      <Text style={styles.tileLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.lg },

  headline: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.sm },
  emoji: { fontSize: 52 },

  streakCard: { gap: spacing.sm },
  streakTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  streakRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  streakValue: {
    fontFamily: fonts.extrabold,
    fontSize: scale(66),
    lineHeight: scale(66) * 1.02,
    letterSpacing: scale(66) * -0.04,
    color: onDark.text,
  },
  streakUnit: {
    fontFamily: fonts.extrabold,
    fontSize: scale(20),
    color: colors.lime,
  },

  moneyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  moneyIcon: {
    width: 52, height: 52, borderRadius: radius.icon,
    backgroundColor: 'rgba(52,199,123,0.16)',
    alignItems: 'center', justifyContent: 'center',
  },
  moneyGlyph: { fontSize: 24 },
  moneyText: { flex: 1, gap: 2 },
  moneyValue: {
    fontFamily: fonts.extrabold,
    fontSize: scale(30),
    color: colors.good,
    letterSpacing: -0.8,
  },

  rewards: { flexDirection: 'row', gap: spacing.md },
  tile: {
    flex: 1,
    backgroundColor: onDark.glass,
    borderWidth: 1,
    borderColor: onDark.glassBorder,
    borderRadius: radius.card,
    padding: spacing.md,
    gap: 2,
  },
  tileHighlight: {
    borderColor: 'rgba(214,248,76,0.45)',
    backgroundColor: 'rgba(214,248,76,0.10)',
  },
  tileIcon: { fontSize: 22 },
  tileValue: { fontFamily: fonts.extrabold, fontSize: scale(24), color: onDark.text },
  tileLabel: { fontFamily: fonts.medium, fontSize: scale(12), color: onDark.textFaint },

  squadCard: { gap: spacing.sm },
  squadRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  squadText: { flex: 1, gap: 1 },
  squadOk: { fontSize: 16, color: colors.good },
  squadFail: { fontSize: 16 },
  voucherBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: 'rgba(214,248,76,0.10)',
    borderRadius: radius.cardSm,
    padding: spacing.md,
    marginTop: spacing.xs,
  },
  voucherGlyph: { fontSize: 24 },
  voucherText: { flex: 1, gap: 2 },

  shareBlock: { alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  shareCard: {
    width: 176,
    aspectRatio: 9 / 16,
    backgroundColor: '#000',
    borderRadius: radius.cardSm,
    overflow: 'hidden',
    ...shadow.lg,
  },
  shareContent: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    padding: spacing.md,
    justifyContent: 'space-between',
  },
  scrimTop: {
    position: 'absolute',
    top: 0, left: 0, right: 0, height: 56,
    backgroundColor: 'rgba(14,15,19,0.45)',
  },
  scrimBottom: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0, height: 130,
    backgroundColor: 'rgba(14,15,19,0.5)',
  },
  shareLogo: {
    fontFamily: fonts.extrabold, fontSize: scale(14),
    color: colors.lime, letterSpacing: 1,
  },
  shareCenter: { alignItems: 'center' },
  shareStreak: {
    fontFamily: fonts.extrabold, fontSize: scale(54),
    color: colors.card, letterSpacing: -2,
  },
  shareStreakLabel: {
    fontFamily: fonts.extrabold, fontSize: scale(10),
    color: colors.lime, letterSpacing: 1.4,
  },
  shareHook: {
    fontFamily: fonts.bold, fontSize: scale(11),
    color: colors.card, lineHeight: 15,
  },

  actions: { gap: spacing.sm, padding: spacing.lg, paddingTop: spacing.sm },
  secondary: { borderColor: onDark.glassBorder },
});
