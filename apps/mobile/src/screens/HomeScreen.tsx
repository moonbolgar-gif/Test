/**
 * Дом. docs/SPEC.md §6.4.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { timeUntil } from '../features/alarm/schedule';

import { LinearGradient } from 'expo-linear-gradient';

import { AnimatedNumber } from '../components/AnimatedNumber';
import { Button } from '../components/Button';
import { Mascot, MASCOT_NAMES, StreakFlame } from '../components/animated';
import { DarkEyebrow, Orb } from '../components/dark';
import { Avatar, Card, Pill, StatCard } from '../components/primitives';
import { colors, darkSurface, fonts, onDark, radius, spacing } from '../design/tokens';
import { scale, type } from '../design/type';
import { WEEKDAY_LABELS, WEEK_ORDER, formatMoney, formatRepeatDays, formatTime, pluralDays } from '../lib/format';
import { useMascotStage, useStore, type DemoAlarm } from '../lib/store';
import { BUILD } from '../lib/version';

/** Недельная полоса Пн–Вс (§6.4). */
function WeekStrip({ done }: { done: number[] }) {
  return (
    <View style={styles.week}>
      {WEEK_ORDER.map((day) => {
        const isDone = done.includes(day);
        return (
          <View key={day} style={styles.weekCell}>
            <View style={[styles.weekBox, isDone ? styles.weekBoxDone : null]}>
              {isDone ? <Text style={styles.weekCheck}>✓</Text> : null}
            </View>
            <Text style={styles.weekLabel}>{WEEKDAY_LABELS[day]}</Text>
          </View>
        );
      })}
    </View>
  );
}

function modeLabel(alarm: DemoAlarm): string {
  const challenge = {
    pattern: 'Графический ключ',
    math: '3 примера',
    shake: 'Тряска ×20',
  }[alarm.challengeType];

  // §14.2: «на кону», не «ставка».
  const stake = {
    free: 'Серия на кону',
    stake: `На кону ${formatMoney(alarm.stakeCents)}`,
    squad: `Командный челлендж ${formatMoney(alarm.stakeCents)}`,
  }[alarm.mode];

  return `${stake} · ${challenge}`;
}

export function HomeScreen({ navigation }: { navigation: { navigate: (r: string, p?: object) => void } }) {
  const profile = useStore((s) => s.profile);
  const alarms = useStore((s) => s.alarms);
  const startRun = useStore((s) => s.startRun);
  const createTestAlarm = useStore((s) => s.createTestAlarm);
  const videoEnabled = useStore((s) => s.videoEnabled);
  const toggleVideo = useStore((s) => s.toggleVideo);
  const stage = useMascotStage();

  // Ближайший по времени, а не первый в списке: пользователь мог добавить
  // будильник на более раннее утро.
  const next = alarms
    .filter((a) => a.isActive)
    .sort((a, b) => a.nextFireAt - b.nextFireAt)[0];

  // Обратный отсчёт до срабатывания обновляется раз в полминуты — чаще незачем,
  // подпись показывает минуты.
  const [, tick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(timer);
  }, []);

  const simulate = (alarmId: string): void => {
    startRun(alarmId);
    navigation.navigate('AlarmRing');
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Avatar id={profile.id} name={profile.name} size={40} />
          <Text style={[type.title, styles.greeting]}>Доброе утро, {profile.name}</Text>
          <View style={styles.streakPill}>
            <StreakFlame size={15} />
            <Text style={styles.streakPillText}>{profile.streak}</Text>
          </View>
        </View>

        {/* Тёмный герой: главный показатель продукта должен читаться как статус,
            а не как ещё одна карточка в списке. Остальной экран остаётся светлым
            по §5.1. */}
        <View style={styles.hero}>
          <LinearGradient
            colors={[darkSurface.top, darkSurface.mid, darkSurface.bottom]}
            style={StyleSheet.absoluteFill}
          />
          <Orb color={colors.lime} size={200} left={-60} top={-70} opacity={0.2} duration={7800} />
          <Orb color={colors.blue} size={150} left={210} top={40} opacity={0.13} duration={9800} />

          <View style={styles.heroTop}>
            <StreakFlame size={18} />
            <DarkEyebrow>ТЕКУЩАЯ СЕРИЯ ПОДЪЁМОВ</DarkEyebrow>
          </View>

          <View style={styles.heroRow}>
            <AnimatedNumber value={profile.streak} delay={120} style={styles.heroValue} />
            <Text style={styles.heroUnit}>{pluralDays(profile.streak)}</Text>
          </View>

          <WeekStrip done={profile.weekDone} />
        </View>

        <View style={styles.stats}>
          <StatCard value={formatMoney(profile.savedCents)} label="Сохранено" tone="good" />
          <StatCard value={formatMoney(profile.lostCents)} label="Потеряно во сне" tone="bad" />
        </View>

        <Card style={styles.mascotCard}>
          <Mascot stage={stage} size={44} />
          <View style={styles.mascotText}>
            <Text style={type.label}>{MASCOT_NAMES[stage - 1]}</Text>
            <Text style={type.caption}>
              {profile.isPremium
                ? 'Маскот растёт вместе с твоей серией'
                : 'Эволюция маскота — в RISE+'}
            </Text>
          </View>
        </Card>

        <Text style={[type.eyebrow, styles.sectionTitle]}>ЗАВТРАШНИЙ БУДИЛЬНИК</Text>

        {next ? (
          <Pressable onPress={() => navigation.navigate('AlarmCreate')}>
            <Card style={styles.alarmCard}>
              <Text style={styles.alarmIcon}>⏰</Text>
              <View style={styles.alarmText}>
                <Text style={styles.alarmTime}>{formatTime(next.hour, next.minute)}</Text>
                <Text style={type.caption}>{modeLabel(next)}</Text>
                <View style={styles.alarmPills}>
                  <Pill label={formatRepeatDays(next.repeatDays)} />
                  <Pill label={`через ${timeUntil(next.nextFireAt)}`} tone="lime" />
                </View>
              </View>
            </Card>
          </Pressable>
        ) : (
          <Card style={styles.empty}>
            <Text style={styles.emptyIcon}>🌙</Text>
            <Text style={type.label}>Пока ни одного будильника</Text>
            <Text style={[type.caption, styles.emptyText]}>
              Поставь первый — и серия начнётся завтра утром.
            </Text>
          </Card>
        )}

        <Button
          label="+ Новый будильник"
          variant="lime"
          onPress={() => navigation.navigate('AlarmCreate')}
        />

        {/* §6.2, экран 5: обязательная проверка будильника. Пользователь должен
            своими глазами убедиться, что телефон звонит, а не поверить на слово. */}
        <Button
          label="⏰ Проверить будильник (1 минута)"
          variant="primary"
          onPress={createTestAlarm}
        />

        {next ? (
          <Button
            label="▶︎ Промотать до утра"
            variant="ghost"
            onPress={() => simulate(next.id)}
          />
        ) : null}

        <Button
          label={videoEnabled ? '🎥 Запись видео: вкл' : '🎥 Запись видео: выкл'}
          variant="ghost"
          onPress={toggleVideo}
        />

        {/* §4.1: будильник звонит, пока приложение живо. Надёжное срабатывание
            при выгруженном приложении — нативный модуль и Фаза 0. Пока его нет,
            приложение обязано говорить об этом прямо. */}
        <Text style={[type.caption, styles.demoNote]}>
          Будильник звонит, пока приложение открыто или свёрнуто. При полностью
          закрытом приложении разбудить он пока не может.
        </Text>

        {/* Видимая метка сборки — чтобы сразу было понятно, обновилось ли
            приложение на телефоне. См. lib/version.ts. */}
        <Text style={[type.caption, styles.build]}>{BUILD}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },

  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  greeting: { flex: 1, fontSize: scale(16) },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.card,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  streakPillText: { fontFamily: fonts.extrabold, fontSize: scale(14), color: colors.ink },

  hero: {
    gap: spacing.sm,
    borderRadius: radius.card,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  heroValue: {
    fontFamily: fonts.extrabold,
    fontSize: scale(56),
    letterSpacing: scale(56) * -0.04,
    color: onDark.text,
  },
  heroUnit: { fontFamily: fonts.extrabold, fontSize: scale(20), color: colors.lime },

  week: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing.xs },
  weekCell: { alignItems: 'center', gap: 5 },
  weekBox: {
    width: 34, height: 34,
    borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekBoxDone: { backgroundColor: colors.lime, borderColor: colors.lime },
  weekCheck: { color: colors.ink, fontSize: scale(15), fontFamily: fonts.extrabold },
  weekLabel: { fontFamily: fonts.bold, fontSize: scale(11), color: onDark.textFaint },

  stats: { flexDirection: 'row', gap: spacing.md },

  mascotCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  mascotText: { flex: 1, gap: 2 },

  sectionTitle: { marginTop: spacing.xs },

  alarmCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  alarmIcon: { fontSize: 30 },
  alarmText: { flex: 1, gap: 3 },
  alarmTime: { ...type.h2, fontSize: scale(24) },
  alarmPills: { flexDirection: 'row', gap: spacing.sm, marginTop: 4, flexWrap: 'wrap' },

  empty: { alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.xl },
  emptyIcon: { fontSize: 40 },
  emptyText: { textAlign: 'center' },

  simulate: { marginTop: spacing.xs },
  demoNote: { textAlign: 'center', paddingHorizontal: spacing.md },
  build: { textAlign: 'center', opacity: 0.5 },
});
