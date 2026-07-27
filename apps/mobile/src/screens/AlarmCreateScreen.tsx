/**
 * Создание будильника. docs/SPEC.md §6.5 → §6.6 → §6.8 → §6.9.
 *
 * Четыре шага одним экраном: Время → Режим → Испытание → Договор на утро.
 * Выбор друзей (§6.7) в демо пропущен — команда одна и уже собрана.
 */

import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { Button } from '../components/Button';
import { Card, OptionRow, Pill } from '../components/primitives';
import { colors, fonts, radius, spacing } from '../design/tokens';
import { scale, type } from '../design/type';
import {
  fetchServiceFee,
  fetchStakeSplit,
  splitStake,
  type ServiceFeeConfig,
  type StakeSplitConfig,
} from '../lib/demoServer';
import { WEEKDAY_LABELS, WEEK_ORDER, formatMoney, formatTime } from '../lib/format';
import { useStore } from '../lib/store';
import type { AlarmMode, ChallengeType, Weekday } from '@rise/shared';

const STEPS = ['Время', 'Режим', 'Испытание', 'Готово'] as const;

/** §14.1 — суммы ограничены $1–$10, шаг $1. */
const MIN_STAKE = 100;
const MAX_STAKE = 1000;
const STAKE_STEP = 100;

export function AlarmCreateScreen({ navigation }: { navigation: { goBack: () => void } }) {
  const createAlarm = useStore((s) => s.createAlarm);

  const [step, setStep] = useState(0);
  const [hour, setHour] = useState(7);
  const [minute, setMinute] = useState(0);
  const [days, setDays] = useState<Weekday[]>([1, 2, 3, 4, 5]);
  const [mode, setMode] = useState<AlarmMode>('free');
  const [stakeCents, setStakeCents] = useState(500);
  const [challenge, setChallenge] = useState<ChallengeType>('pattern');
  const [autoRecord, setAutoRecord] = useState(true);

  const [split, setSplit] = useState<StakeSplitConfig | null>(null);
  const [fee, setFee] = useState<ServiceFeeConfig | null>(null);

  // §8.2: доли распределения приходят с сервера, в клиенте их нет.
  useEffect(() => {
    Promise.all([fetchStakeSplit(), fetchServiceFee()]).then(([s, f]) => {
      setSplit(s);
      setFee(f);
    });
  }, []);

  const toggleDay = (day: Weekday): void => {
    Haptics.selectionAsync();
    setDays((current) =>
      current.includes(day) ? current.filter((d) => d !== day) : [...current, day],
    );
  };

  const submit = (): void => {
    createAlarm({
      hour,
      minute,
      repeatDays: days,
      challengeType: challenge,
      mode,
      stakeCents: mode === 'free' ? 0 : stakeCents,
      autoRecord,
    });
    navigation.goBack();
  };

  const parts = split ? splitStake(stakeCents, split) : null;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.stepper}>
        {STEPS.map((label, i) => (
          <View key={label} style={styles.stepItem}>
            <View style={[styles.stepDot, i <= step ? styles.stepDotActive : null]} />
            <Text style={[styles.stepLabel, i === step ? styles.stepLabelActive : null]}>
              {label}
            </Text>
          </View>
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {step === 0 ? (
          <>
            <Text style={[type.h2, styles.heading]}>Во сколько встаём?</Text>
            <Text style={styles.clock}>{formatTime(hour, minute)}</Text>

            <Card style={styles.steppers}>
              <StepperRow
                label="Часы"
                onDecrement={() => setHour((h) => (h + 23) % 24)}
                onIncrement={() => setHour((h) => (h + 1) % 24)}
              />
              <View style={styles.divider} />
              <StepperRow
                label="Минуты"
                onDecrement={() => setMinute((m) => (m + 55) % 60)}
                onIncrement={() => setMinute((m) => (m + 5) % 60)}
              />
            </Card>

            <Text style={[type.eyebrow, styles.subheading]}>ПОВТОР</Text>
            <View style={styles.days}>
              {WEEK_ORDER.map((day) => {
                const active = days.includes(day);
                return (
                  <Pressable
                    key={day}
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: active }}
                    onPress={() => toggleDay(day)}
                    style={[styles.day, active ? styles.dayActive : null]}
                  >
                    <Text style={[styles.dayLabel, active ? styles.dayLabelActive : null]}>
                      {WEEKDAY_LABELS[day]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.presets}>
              <Preset label="Будни" onPress={() => setDays([1, 2, 3, 4, 5])} />
              <Preset label="Каждый день" onPress={() => setDays([0, 1, 2, 3, 4, 5, 6])} />
              <Preset label="Один раз" onPress={() => setDays([])} />
            </View>
          </>
        ) : null}

        {step === 1 ? (
          <>
            <Text style={[type.h2, styles.heading]}>Насколько серьёзно?</Text>
            <Text style={[type.body, styles.sub]}>
              Выбери, что поставить на кон против сна.
            </Text>

            <OptionRow
              icon="🆓" title="Просто серия" description="Бесплатно · на кону серия"
              selected={mode === 'free'} onPress={() => setMode('free')}
            />

            <OptionRow
              icon="💸" title="На кону деньги"
              description="Проспал — сумма спишется"
              selected={mode === 'stake'} onPress={() => setMode('stake')}
            >
              <View style={styles.stakeBox}>
                <Text style={styles.stakeValue}>{formatMoney(stakeCents)}</Text>
                <View style={styles.stakeControls}>
                  <RoundButton
                    label="−"
                    onPress={() => setStakeCents((c) => Math.max(MIN_STAKE, c - STAKE_STEP))}
                  />
                  <View style={styles.track}>
                    <View
                      style={[
                        styles.trackFill,
                        {
                          width: `${((stakeCents - MIN_STAKE) / (MAX_STAKE - MIN_STAKE)) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                  <RoundButton
                    label="+"
                    onPress={() => setStakeCents((c) => Math.min(MAX_STAKE, c + STAKE_STEP))}
                  />
                </View>

                {parts && fee ? (
                  <View style={styles.breakdown}>
                    <BreakdownRow label="💚 Благотворительность" value={parts.charity} />
                    <BreakdownRow label="🏢 Платформа" value={parts.platform} />
                    <BreakdownRow label="🎁 Фонд наград" value={parts.reward_pool} />
                    <View style={styles.divider} />
                    <Text style={type.caption}>
                      🌱 Сервисный сбор {formatMoney(fee.cents)} — идёт на деревья.
                      Проснёшься — платишь только его.
                    </Text>
                  </View>
                ) : (
                  <Text style={type.caption}>Загружаем разбивку…</Text>
                )}
              </View>
            </OptionRow>

            <OptionRow
              icon="👥" title="Командный челлендж"
              description="Скиньтесь с друзьями"
              selected={mode === 'squad'} onPress={() => setMode('squad')}
            >
              <Text style={type.caption}>
                Кто проспал — взнос уходит в резервный фонд платформы. Проснувшимся
                платформа дарит награду из фонда, а не деньги проигравшего.
              </Text>
            </OptionRow>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <Text style={[type.h2, styles.heading]}>Утреннее испытание</Text>
            <Text style={[type.body, styles.sub]}>Что разбудит тебя по-настоящему?</Text>

            <OptionRow
              icon="🔗" title="Графический ключ ×2" description="Повтори узор"
              selected={challenge === 'pattern'} onPress={() => setChallenge('pattern')}
            />
            <OptionRow
              icon="🧮" title="3 примера подряд" description="Разбуди мозг"
              selected={challenge === 'math'} onPress={() => setChallenge('math')}
            />
            <OptionRow
              icon="📳" title="Тряхни телефон ×20" description="Заставляет двигаться"
              selected={challenge === 'shake'} onPress={() => setChallenge('shake')}
            />

            <Card style={styles.toggleCard}>
              <View style={styles.toggleText}>
                <Text style={type.label}>🎥 Авто-запись кружка</Text>
                <Text style={type.caption}>Запишет битву. Остаётся у тебя</Text>
              </View>
              <Pressable
                accessibilityRole="switch"
                accessibilityState={{ checked: autoRecord }}
                onPress={() => setAutoRecord((v) => !v)}
                style={[styles.switch, autoRecord ? styles.switchOn : null]}
              >
                <View style={[styles.knob, autoRecord ? styles.knobOn : null]} />
              </Pressable>
            </Card>
            <Text style={type.caption}>
              🔒 Видео остаётся у тебя, пока ты не решишь поделиться. В демо запись
              не ведётся.
            </Text>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <View style={styles.moonWrap}>
              <Text style={styles.moon}>🌙</Text>
            </View>
            <Text style={[type.h2, styles.heading]}>Договор на утро</Text>

            <Card style={styles.receipt}>
              <ReceiptRow label="Подъём" value={formatTime(hour, minute)} />
              {mode !== 'free' ? (
                <ReceiptRow label="На кону" value={formatMoney(stakeCents)} />
              ) : null}
              <ReceiptRow
                label="Испытание"
                value={{
                  pattern: 'Графический ключ ×2',
                  math: '3 примера подряд',
                  shake: 'Тряска ×20',
                }[challenge]}
              />
              <ReceiptRow label="Окно" value="5 минут" />
            </Card>

            <Text style={type.caption}>
              {mode === 'stake'
                ? `Не справишься — ${formatMoney(stakeCents)} спишутся и распределятся.`
                : mode === 'squad'
                  ? 'Проспал — взнос в фонд. Проснулся — награда из фонда.'
                  : 'Не справишься — серия обнулится.'}
            </Text>
          </>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {step > 0 ? (
          <Button
            label="Назад"
            variant="ghost"
            onPress={() => setStep((s) => s - 1)}
            style={styles.footerButton}
          />
        ) : null}
        <Button
          label={step === STEPS.length - 1 ? '🔒 Поставить и лечь спать' : 'Дальше →'}
          variant="lime"
          onPress={() => (step === STEPS.length - 1 ? submit() : setStep((s) => s + 1))}
          style={styles.footerButton}
        />
      </View>
    </SafeAreaView>
  );
}

// ─── Мелкие части экрана ─────────────────────────────────────────────────────

function StepperRow({
  label, onDecrement, onIncrement,
}: { label: string; onDecrement: () => void; onIncrement: () => void }) {
  return (
    <View style={styles.stepperRow}>
      <Text style={type.label}>{label}</Text>
      <View style={styles.stepperControls}>
        <RoundButton label="−" onPress={onDecrement} />
        <RoundButton label="+" onPress={onIncrement} />
      </View>
    </View>
  );
}

function RoundButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === '+' ? 'увеличить' : 'уменьшить'}
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.round, pressed ? styles.roundPressed : null]}
    >
      <Text style={styles.roundLabel}>{label}</Text>
    </Pressable>
  );
}

function Preset({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Pill label={label} />
    </Pressable>
  );
}

function BreakdownRow({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={type.caption}>{label}</Text>
      <Text style={[type.caption, styles.breakdownValue]}>{formatMoney(value)}</Text>
    </View>
  );
}

function ReceiptRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={type.body}>{label}</Text>
      <Text style={type.label}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },

  stepper: {
    flexDirection: 'row',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  stepItem: { flex: 1, gap: 5 },
  stepDot: { height: 4, borderRadius: 2, backgroundColor: colors.line2 },
  stepDotActive: { backgroundColor: colors.ink },
  stepLabel: { fontFamily: fonts.bold, fontSize: scale(11), color: colors.inkFaint },
  stepLabelActive: { color: colors.ink },

  heading: { marginTop: spacing.xs },
  sub: { marginBottom: spacing.xs },
  subheading: { marginTop: spacing.sm },

  clock: { ...type.display, textAlign: 'center', marginVertical: spacing.sm },

  steppers: { gap: spacing.sm },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepperControls: { flexDirection: 'row', gap: spacing.sm },
  divider: { height: 1, backgroundColor: colors.line },

  round: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: colors.bg,
    alignItems: 'center', justifyContent: 'center',
  },
  roundPressed: { transform: [{ scale: 0.94 }], backgroundColor: colors.line2 },
  roundLabel: { fontFamily: fonts.extrabold, fontSize: scale(22), color: colors.ink },

  days: { flexDirection: 'row', justifyContent: 'space-between' },
  day: {
    width: 42, height: 42, borderRadius: 14,
    backgroundColor: colors.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: 'transparent',
  },
  dayActive: { backgroundColor: colors.lime, borderColor: colors.ink },
  dayLabel: { fontFamily: fonts.bold, fontSize: scale(12), color: colors.inkSoft },
  dayLabelActive: { color: colors.ink },
  presets: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },

  stakeBox: { gap: spacing.sm },
  stakeValue: { ...type.display, fontSize: scale(38), textAlign: 'center' },
  stakeControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  track: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.line2 },
  trackFill: { height: '100%', borderRadius: 4, backgroundColor: colors.ink },

  breakdown: {
    gap: 6,
    backgroundColor: colors.card,
    borderRadius: radius.cardSm,
    padding: spacing.md,
  },
  breakdownRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  breakdownValue: { color: colors.ink, fontFamily: fonts.bold },

  toggleCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  toggleText: { flex: 1, gap: 2 },
  switch: {
    width: 52, height: 31, borderRadius: 16,
    backgroundColor: colors.line2,
    padding: 3,
    justifyContent: 'center',
  },
  switchOn: { backgroundColor: colors.ink },
  knob: {
    width: 25, height: 25, borderRadius: 13,
    backgroundColor: colors.card,
  },
  knobOn: { alignSelf: 'flex-end' },

  moonWrap: {
    alignSelf: 'center',
    width: 92, height: 92, borderRadius: radius.card,
    backgroundColor: colors.lime,
    alignItems: 'center', justifyContent: 'center',
    marginTop: spacing.sm,
  },
  moon: { fontSize: 44 },
  receipt: { gap: spacing.sm },

  footer: {
    flexDirection: 'row',
    gap: spacing.sm,
    padding: spacing.lg,
    paddingTop: spacing.sm,
  },
  footerButton: { flex: 1 },
});
