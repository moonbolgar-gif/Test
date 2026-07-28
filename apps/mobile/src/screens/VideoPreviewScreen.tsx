/**
 * Просмотр записанного видео. docs/SPEC.md §4.3, §4.4, §6.12.
 *
 * Отдельный экран, а не блок на экране итога — намеренно. Видеоплеер рядом с
 * только что работавшей камерой оказался самым тяжёлым местом приложения, и
 * держать его на пути «испытание → итог» нельзя: этот путь обязан проходиться
 * всегда. Здесь плеер живёт один, и его сбой не мешает узнать результат.
 *
 * §4.4 — приватность: видео по умолчанию не покидает устройство. Отсюда три
 * выхода: поделиться, сохранить в галерею, удалить. Если пользователь ничего
 * не выбрал и просто закрыл экран, файл удаляется — это и обещано в интерфейсе.
 */

import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as MediaLibrary from 'expo-media-library';
import { VideoView, useVideoPlayer } from 'expo-video';

import { Button } from '../components/Button';
import { DarkCaption, DarkSurface, DarkTitle } from '../components/dark';
import { colors, fonts, onDark, radius, spacing } from '../design/tokens';
import { scale } from '../design/type';
import { useStore } from '../lib/store';

export function VideoPreviewScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const outcome = useStore((s) => s.lastOutcome);
  const clearVideo = useStore((s) => s.clearVideo);
  const uri = outcome?.videoUri ?? null;

  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  // Решение пользователя хранится в ref: очистка при выходе читает его уже
  // после того, как экран начал размонтироваться.
  const keep = useRef(false);

  const player = useVideoPlayer(uri, (instance) => {
    try {
      instance.loop = true;
      instance.muted = true;
      instance.play();
    } catch {
      // Битый файл не должен ронять экран — останется чёрный прямоугольник.
    }
  });

  // §4.4: не сохранил и не поделился — файл не остаётся на устройстве.
  useEffect(() => {
    return () => {
      if (!keep.current) clearVideo();
    };
  }, [clearVideo]);

  const share = async (): Promise<void> => {
    if (!uri) return;
    keep.current = true;
    setBusy(true);
    try {
      await Share.share(
        Platform.OS === 'ios'
          ? { url: uri, message: 'я победил будильник 💪 rise.app' }
          : { message: 'я победил будильник 💪 rise.app' },
      );
    } catch {
      // Пользователь закрыл системный лист — это не ошибка.
    } finally {
      setBusy(false);
    }
  };

  const saveToGallery = async (): Promise<void> => {
    if (!uri) return;
    setBusy(true);
    try {
      const permission = await MediaLibrary.requestPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Нужен доступ к галерее',
          'Разреши доступ в настройках, чтобы сохранить запись.',
        );
        return;
      }
      await MediaLibrary.saveToLibraryAsync(uri);
      keep.current = true;
      setSaved(true);
    } catch {
      Alert.alert('Не удалось сохранить', 'Попробуй ещё раз или поделись напрямую.');
    } finally {
      setBusy(false);
    }
  };

  const discard = (): void => {
    keep.current = false;
    navigation.goBack();
  };

  return (
    <DarkSurface tone="neutral">
      <SafeAreaView style={styles.screen}>
        <View style={styles.header}>
          <DarkTitle>Твоя утренняя битва</DarkTitle>
          <DarkCaption>
            {saved
              ? 'Сохранено в галерею'
              : 'Если закроешь, не сохранив, запись удалится'}
          </DarkCaption>
        </View>

        <View style={styles.frame}>
          {uri ? (
            <VideoView
              player={player}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              nativeControls={false}
            />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyGlyph}>🎥</Text>
              <Text style={styles.emptyText}>Запись не велась</Text>
            </View>
          )}
        </View>

        <View style={styles.actions}>
          <Button label="📲 Поделиться" variant="lime" onPress={share} loading={busy} />
          <Button
            label={saved ? '✓ Сохранено в галерею' : '⬇︎ Сохранить на телефон'}
            variant="outlineDark"
            onPress={saveToGallery}
            disabled={saved || !uri}
          />
          <Pressable accessibilityRole="button" onPress={discard} style={styles.discard}>
            <Text style={styles.discardText}>Удалить запись</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </DarkSurface>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, padding: spacing.lg, justifyContent: 'space-between' },
  header: { gap: spacing.xs, alignItems: 'center', marginTop: spacing.sm },

  frame: {
    flex: 1,
    marginVertical: spacing.lg,
    borderRadius: radius.card,
    overflow: 'hidden',
    backgroundColor: '#000',
    borderWidth: 1,
    borderColor: onDark.glassBorder,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  emptyGlyph: { fontSize: 44 },
  emptyText: { fontFamily: fonts.bold, fontSize: scale(14), color: onDark.textFaint },

  actions: { gap: spacing.sm },
  discard: { alignSelf: 'center', padding: spacing.md },
  discardText: {
    fontFamily: fonts.bold,
    fontSize: scale(14),
    color: colors.bad,
  },
});
