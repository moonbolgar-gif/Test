/**
 * Онбординг. docs/SPEC.md §6.2 — три экрана мотивации, затем разрешения
 * и обязательная проверка будильника.
 *
 * §6.2 называет экран разрешений критичным и требует объяснять, зачем нужно
 * каждое, ДО системного диалога. Причина простая: пользователь, отказавший в
 * уведомлениях, получит неработающий будильник и удалит приложение, решив, что
 * оно сломано.
 */

import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useCameraPermissions } from 'expo-camera';
import Animated, { FadeIn, FadeInDown, FadeOut } from 'react-native-reanimated';

import { Button } from '../components/Button';
import { Avatar, Card, Pill } from '../components/primitives';
import { StreakFlame } from '../components/animated';
import { colors, fonts, radius, shadow, spacing } from '../design/tokens';
import { stagger } from '../design/motion';
import { scale, type } from '../design/type';
import { requestNotificationPermission } from '../features/alarm/notifications';
import { useStore } from '../lib/store';

type Step = 0 | 1 | 2 | 3 | 4;
const LAST_STEP: Step = 4;

export function OnboardingScreen({ navigation }: { navigation: { replace: (r: string) => void } }) {
  const [step, setStep] = useState<Step>(0);
  const [notificationsGranted, setNotificationsGranted] = useState<boolean | null>(null);
  const [cameraPermission, requestCamera] = useCameraPermissions();
  const [testArmed, setTestArmed] = useState(false);

  const createTestAlarm = useStore((s) => s.createTestAlarm);
  const finishOnboarding = useStore((s) => s.finishOnboarding);

  const next = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setStep((s) => (s < LAST_STEP ? ((s + 1) as Step) : s));
  }, []);

  const done = useCallback(() => {
    finishOnboarding();
    navigation.replace('MainTabs');
  }, [finishOnboarding, navigation]);

  const askNotifications = useCallback(async () => {
    const granted = await requestNotificationPermission();
    setNotificationsGranted(granted);
    Haptics.notificationAsync(
      granted
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
  }, []);

  const askCamera = useCallback(async () => {
    await requestCamera();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, [requestCamera]);

  const armTest = useCallback(() => {
    createTestAlarm();
    setTestArmed(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [createTestAlarm]);

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.dots}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.dot, i === step ? styles.dotActive : null]} />
          ))}
        </View>
        {step < 3 ? (
          <Pressable accessibilityRole="button" onPress={done} hitSlop={12}>
            <Text style={styles.skip}>Пропустить</Text>
          </Pressable>
        ) : (
          <View style={styles.skipSpacer} />
        )}
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        key={step}
      >
        {step === 0 ? (
          <Animated.View entering={FadeIn.duration(320)} exiting={FadeOut} style={styles.slide}>
            <Animated.View entering={FadeInDown.delay(stagger(0))} style={styles.iconCard}>
              <Text style={styles.iconGlyph}>⏰</Text>
            </Animated.View>
            <Animated.Text entering={FadeInDown.delay(stagger(1))} style={type.h1}>
              Страх потери будит{' '}
              <Text style={styles.accent}>лучше</Text> будильника.
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(stagger(2))} style={type.body}>
              На кону твоя серия и репутация, а если захочешь — реальные деньги.
              Проспал — теряешь. Это работает.
            </Animated.Text>
          </Animated.View>
        ) : null}

        {step === 1 ? (
          <Animated.View entering={FadeIn.duration(320)} style={styles.slide}>
            <Animated.Text entering={FadeInDown.delay(stagger(0))} style={type.h2}>
              Вставать <Text style={styles.accent}>вместе</Text> проще
            </Animated.Text>

            <Animated.View entering={FadeInDown.delay(stagger(1))}>
              <Card style={styles.squadDemo}>
                <View style={styles.squadRow}>
                  {[
                    { id: 'd1', name: 'Даша', up: true },
                    { id: 'd2', name: 'Дэн', up: true },
                    { id: 'd3', name: 'Марк', up: false },
                    { id: 'd4', name: 'Лена', up: true },
                  ].map((m) => (
                    <View key={m.id} style={styles.squadMember}>
                      <Avatar id={m.id} name={m.name} size={44} dimmed={!m.up} />
                      <Text style={styles.squadStatus}>{m.up ? '✓' : '😴'}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.squadFooter}>
                  <StreakFlame size={16} />
                  <Text style={type.label}>Командная серия 12 дней</Text>
                </View>
              </Card>
            </Animated.View>

            <Animated.View entering={FadeInDown.delay(stagger(2))}>
              <Card tone="lime">
                <Text style={type.label}>🎬 Твоя битва — это контент</Text>
                <Text style={[type.body, styles.limeBody]}>
                  Кружок с подсветкой пишет, как ты воюешь со сном. Один тап — и он в Stories.
                </Text>
              </Card>
            </Animated.View>
          </Animated.View>
        ) : null}

        {step === 2 ? (
          <Animated.View entering={FadeIn.duration(320)} style={styles.slide}>
            <Animated.View entering={FadeInDown.delay(stagger(0))} style={styles.iconCard}>
              <StreakFlame size={54} />
            </Animated.View>
            <Animated.Text entering={FadeInDown.delay(stagger(1))} style={type.h1}>
              Один огонёк. Не дай ему{' '}
              <Text style={styles.accent}>погаснуть</Text>.
            </Animated.Text>
            <Animated.View entering={FadeInDown.delay(stagger(2))} style={styles.bullets}>
              <Bullet icon="🆓" text="Бесплатно навсегда" />
              <Bullet icon="💎" text="Деньги — потом и по желанию" />
              <Bullet icon="🔒" text="Видео остаётся у тебя на устройстве" />
            </Animated.View>
          </Animated.View>
        ) : null}

        {step === 3 ? (
          <Animated.View entering={FadeIn.duration(320)} style={styles.slide}>
            <Animated.Text entering={FadeInDown.delay(stagger(0))} style={type.h2}>
              Разреши RISE тебя разбудить
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(stagger(1))} style={type.body}>
              Без этих доступов будильник не сработает. Мы объясняем каждый —
              решать тебе.
            </Animated.Text>

            <Animated.View entering={FadeInDown.delay(stagger(2))}>
              <PermissionRow
                icon="🔔"
                title="Уведомления"
                reason="Без этого будильник не сможет тебя разбудить"
                required
                state={notificationsGranted}
                onPress={askNotifications}
              />
              <PermissionRow
                icon="🎥"
                title="Камера"
                reason="Чтобы записать твою утреннюю битву. Видео остаётся у тебя"
                required={false}
                state={cameraPermission?.granted ?? null}
                onPress={askCamera}
              />
            </Animated.View>

            {notificationsGranted === false ? (
              <Animated.View entering={FadeIn}>
                <Card style={styles.warning}>
                  <Text style={[type.caption, styles.warningText]}>
                    Уведомления запрещены. Открой Настройки → RISE → Уведомления и включи
                    их, иначе будильник промолчит.
                  </Text>
                </Card>
              </Animated.View>
            ) : null}
          </Animated.View>
        ) : null}

        {step === 4 ? (
          <Animated.View entering={FadeIn.duration(320)} style={styles.slide}>
            <Animated.View entering={FadeInDown.delay(stagger(0))} style={styles.iconCard}>
              <Text style={styles.iconGlyph}>{testArmed ? '⏳' : '🔔'}</Text>
            </Animated.View>
            <Animated.Text entering={FadeInDown.delay(stagger(1))} style={type.h2}>
              {testArmed ? 'Заблокируй телефон' : 'Проверим, что всё работает'}
            </Animated.Text>
            <Animated.Text entering={FadeInDown.delay(stagger(2))} style={type.body}>
              {testArmed
                ? 'Через минуту RISE зазвонит. Не закрывай приложение полностью — пока '
                  + 'настоящий будильник не подключён, оно должно оставаться в памяти.'
                : 'Поставим будильник на минуту вперёд. Ты своими глазами увидишь, '
                  + 'как он звонит — и только потом решишь, доверять ли ему утро.'}
            </Animated.Text>

            {!testArmed ? (
              <Animated.View entering={FadeInDown.delay(stagger(3))}>
                <Button label="Проверить сейчас" variant="lime" onPress={armTest} />
              </Animated.View>
            ) : (
              <Animated.View entering={FadeIn}>
                <Card tone="lime" style={styles.armed}>
                  <Text style={type.label}>✅ Тестовый будильник поставлен</Text>
                  <Text style={type.caption}>Сработает меньше чем через минуту</Text>
                </Card>
              </Animated.View>
            )}
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label={step === LAST_STEP ? 'Начать пользоваться →' : 'Дальше →'}
          variant={step === LAST_STEP ? 'primary' : 'lime'}
          onPress={step === LAST_STEP ? done : next}
        />
      </View>
    </SafeAreaView>
  );
}

function Bullet({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletIcon}>{icon}</Text>
      <Text style={type.label}>{text}</Text>
    </View>
  );
}

function PermissionRow({
  icon, title, reason, required, state, onPress,
}: {
  icon: string;
  title: string;
  reason: string;
  required: boolean;
  state: boolean | null;
  onPress: () => void;
}) {
  const granted = state === true;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={granted}
      onPress={onPress}
      style={({ pressed }) => [
        styles.permission,
        granted ? styles.permissionGranted : null,
        pressed && !granted ? styles.permissionPressed : null,
      ]}
    >
      <Text style={styles.permissionIcon}>{icon}</Text>
      <View style={styles.permissionText}>
        <View style={styles.permissionTitleRow}>
          <Text style={type.label}>{title}</Text>
          {required ? <Pill label="обязательно" tone="bad" /> : <Pill label="можно позже" />}
        </View>
        <Text style={[type.caption, styles.permissionReason]}>{reason}</Text>
      </View>
      <Text style={styles.permissionState}>{granted ? '✓' : '→'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xl, flexGrow: 1 },
  slide: { gap: spacing.md, flex: 1, justifyContent: 'center' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.line2 },
  dotActive: { width: 22, backgroundColor: colors.ink },
  skip: { ...type.caption, fontFamily: fonts.bold },
  skipSpacer: { width: 70 },

  iconCard: {
    width: 120, height: 120,
    borderRadius: radius.card,
    backgroundColor: colors.lime,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.sm,
  },
  iconGlyph: { fontSize: 54 },
  accent: { fontFamily: fonts.accent, fontStyle: 'italic' },
  limeBody: { color: colors.ink, marginTop: 4 },

  squadDemo: { gap: spacing.md },
  squadRow: { flexDirection: 'row', justifyContent: 'space-between' },
  squadMember: { alignItems: 'center', gap: 4 },
  squadStatus: { fontSize: 14 },
  squadFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    paddingTop: spacing.md,
  },

  bullets: { gap: spacing.sm },
  bullet: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.cardSm,
    padding: spacing.md,
  },
  bulletIcon: { fontSize: 20 },

  permission: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.card,
    borderRadius: radius.cardSm,
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  permissionGranted: { borderColor: colors.good, backgroundColor: '#F1FBF6' },
  permissionPressed: { transform: [{ scale: 0.985 }] },
  permissionIcon: { fontSize: 24 },
  permissionText: { flex: 1, gap: 4 },
  permissionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  permissionReason: { lineHeight: 17 },
  permissionState: { fontFamily: fonts.extrabold, fontSize: scale(18), color: colors.inkSoft },

  warning: { backgroundColor: '#FFF4F4' },
  warningText: { color: colors.bad, lineHeight: 18 },

  armed: { gap: 4 },

  footer: { padding: spacing.lg, paddingTop: spacing.sm },
});
