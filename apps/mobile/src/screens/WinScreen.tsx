/**
 * Экран победы. docs/SPEC.md §6.12.
 *
 * Карточка 9:16 показывает настоящее записанное видео с наложенными слоями
 * из §4.3: логотип, счётчик серии, хук-подпись.
 *
 * Чего не хватает до §4.3: композитинга — слои живут поверх видео в интерфейсе,
 * но не вплавлены в файл. Экспортированный ролик уйдёт в Stories без них.
 * Это `RiseVideoModule` либо ffmpeg, Фаза 3.
 */

import { Platform, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VideoView, useVideoPlayer } from 'expo-video';

import { Button } from '../components/Button';
import { Confetti } from '../components/animated';
import { Card } from '../components/primitives';
import { colors, fonts, radius, spacing } from '../design/tokens';
import { scale, type } from '../design/type';
import { formatMoney, pluralDays } from '../lib/format';
import { useStore } from '../lib/store';

/** Превью шеринг-карточки 9:16 (§6.12) поверх записанного видео. */
function ShareCardPreview({ streak, videoUri }: { streak: number; videoUri: string | null }) {
  const player = useVideoPlayer(videoUri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
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

      {/* §4.3: тёмный градиент сверху и снизу — ради читаемости подписей.
          Два полупрозрачных прямоугольника вместо градиента: на маленьком
          превью разница не видна, а зависимости меньше. */}
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
    const message = `я победил будильник 💪 серия ${profile.streak} ${pluralDays(profile.streak)}\nа ты сможешь? rise.app`;
    try {
      // §4.3: файл уходит только по явному действию пользователя (§4.4).
      // На iOS системный лист принимает локальный файл через url.
      await Share.share(
        outcome?.videoUri && Platform.OS === 'ios'
          ? { url: outcome.videoUri, message }
          : { message },
      );
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

        <ShareCardPreview streak={profile.streak} videoUri={outcome?.videoUri ?? null} />
        <Text style={[type.caption, styles.shareNote]}>
          {outcome?.videoUri ? 'Готово к Stories · 9:16' : 'Видео не записано · 9:16'}
        </Text>

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
    overflow: 'hidden',
  },
  shareContent: {
    ...StyleSheet.absoluteFillObject,
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
