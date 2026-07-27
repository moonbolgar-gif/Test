/**
 * Видео-кружок с фронтальной камеры. docs/SPEC.md §6.10, §4.3.
 *
 * §4.3: фронтальная камера, квадрат, без звука по умолчанию, максимум 60 секунд,
 * файл остаётся локально и не загружается никуда сам (§4.4).
 *
 * Размер увеличен против §6.10 (104 pt) по решению владельца продукта: на 104 pt
 * лицо неразличимо, и непонятно, пишется ли вообще что-то.
 *
 * Подсветка лица: у фронтальной камеры iPhone нет вспышки, поэтому источником
 * света работает экран. Тёплое белое кольцо вокруг кружка даёт направленный свет
 * и блик в глазах — лицо читается даже в темноте. Тёплый оттенок, а не чистый
 * белый, потому что холодный свет делает кожу землистой.
 *
 * Устойчивость: ни один метод здесь не бросает исключений наружу и не может
 * подвесить вызывающий код. Экран испытания обязан завершиться независимо от
 * того, что происходит с камерой.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Circle } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { colors, fonts } from '../../design/tokens';
import { scale } from '../../design/type';

const SIZE = 150;
const RING_STROKE = 5;
const GLOW_SIZE = 272;
/** §4.3 — максимальная длина записи. */
export const MAX_DURATION_SEC = 60;
/** Сколько ждём файл, прежде чем считать запись потерянной. */
const STOP_TIMEOUT_MS = 4000;

/** Тёплый белый — на нём кожа выглядит живой, в отличие от чистого #FFF. */
const LIGHT = '#FFF4DC';

export interface CameraCircleHandle {
  /** Никогда не бросает и не висит дольше STOP_TIMEOUT_MS. */
  stopAndSave: () => Promise<string | null>;
}

interface Props {
  /** Доля окна испытания, прошедшая к текущему моменту (0..1). */
  progress: number;
  /** §6.8 — настройка «Авто-запись кружка». */
  recording: boolean;
}

export const CameraCircle = forwardRef<CameraCircleHandle, Props>(function CameraCircle(
  { progress, recording },
  ref,
) {
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [active, setActive] = useState(false);

  const camera = useRef<CameraView>(null);
  // Промис записи резолвится только после stopRecording, поэтому храним его,
  // а не await-им на месте.
  const recordingPromise = useRef<Promise<{ uri: string } | undefined> | null>(null);

  // Пульсация света: живой источник читается как «идёт запись» лучше,
  // чем статичное пятно.
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, [pulse]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: 0.5 + pulse.value * 0.22,
    transform: [{ scale: 1 + pulse.value * 0.04 }],
  }));

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission().catch(() => setFailed(true));
    }
  }, [permission, requestPermission]);

  const granted = permission?.granted === true;

  // Запись стартует автоматически, как только камера готова (§4.3).
  useEffect(() => {
    if (!granted || !ready || !recording || failed || recordingPromise.current) return;
    try {
      const promise = camera.current?.recordAsync({ maxDuration: MAX_DURATION_SEC });
      if (!promise) return;
      // Ошибку промиса гасим здесь: необработанный reject в RN всплывает
      // как красный экран, хотя провал записи не должен ничего ломать.
      recordingPromise.current = promise.catch(() => undefined);
      setActive(true);
    } catch {
      setFailed(true);
    }
  }, [failed, granted, ready, recording]);

  useImperativeHandle(ref, () => ({
    stopAndSave: async () => {
      const promise = recordingPromise.current;
      recordingPromise.current = null;
      setActive(false);
      if (!promise) return null;

      try {
        camera.current?.stopRecording();
      } catch {
        // Камера могла уже размонтироваться — файл всё равно попробуем забрать.
      }

      try {
        // Гонка с таймаутом: если нативная сторона не отдаст файл, экран
        // победы не должен ждать её вечно.
        const result = await Promise.race([
          promise,
          new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), STOP_TIMEOUT_MS)),
        ]);
        return result?.uri ?? null;
      } catch {
        return null;
      }
    },
  }));

  const r = (SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const lighting = granted && recording && !failed;

  return (
    <View style={styles.wrap}>
      {/* Подсветка. Три вложенных круга вместо радиального градиента: в RN его
          нет без дополнительной зависимости, а сложение полупрозрачных слоёв
          даёт достаточно мягкий спад. */}
      {lighting ? (
        <Animated.View style={[styles.glowWrap, glowStyle]} pointerEvents="none">
          <View style={[styles.glow, styles.glowOuter]} />
          <View style={[styles.glow, styles.glowMid]} />
          <View style={[styles.glow, styles.glowInner]} />
        </Animated.View>
      ) : null}

      <View style={styles.circle}>
        {granted && !failed ? (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="front"
            mode="video"
            // §4.3: по умолчанию без звука. Заодно снимает необходимость
            // спрашивать доступ к микрофону.
            mute
            onCameraReady={() => setReady(true)}
            onMountError={() => setFailed(true)}
          />
        ) : (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderGlyph}>{failed ? '⚠️' : '🎥'}</Text>
          </View>
        )}
      </View>

      <Svg width={SIZE} height={SIZE} style={styles.ring} pointerEvents="none">
        <Circle
          cx={SIZE / 2} cy={SIZE / 2} r={r}
          stroke={colors.ink} strokeOpacity={0.14} strokeWidth={RING_STROKE} fill="none"
        />
        <Circle
          cx={SIZE / 2} cy={SIZE / 2} r={r}
          stroke={colors.ink} strokeWidth={RING_STROKE} fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - Math.min(Math.max(progress, 0), 1))}
          strokeLinecap="round"
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>

      <View style={styles.badge}>
        {active ? <View style={styles.recDot} /> : null}
        <Text style={styles.badgeText}>
          {failed
            ? 'камера недоступна'
            : !granted
              ? 'нет доступа к камере'
              : active
                ? 'REC · битва пишется'
                : recording
                  ? 'запуск камеры…'
                  : 'запись выключена'}
        </Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },

  glowWrap: {
    position: 'absolute',
    width: GLOW_SIZE,
    height: GLOW_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: { position: 'absolute', backgroundColor: LIGHT },
  glowOuter: {
    width: GLOW_SIZE, height: GLOW_SIZE, borderRadius: GLOW_SIZE / 2, opacity: 0.16,
  },
  glowMid: {
    width: GLOW_SIZE * 0.78, height: GLOW_SIZE * 0.78, borderRadius: GLOW_SIZE / 2, opacity: 0.3,
  },
  glowInner: {
    width: GLOW_SIZE * 0.62, height: GLOW_SIZE * 0.62, borderRadius: GLOW_SIZE / 2, opacity: 0.55,
  },

  circle: {
    width: SIZE - RING_STROKE * 2,
    height: SIZE - RING_STROKE * 2,
    borderRadius: SIZE,
    overflow: 'hidden',
    backgroundColor: colors.limeSoft,
  },
  ring: { position: 'absolute' },

  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderGlyph: { fontSize: 40 },

  badge: {
    position: 'absolute',
    bottom: -26,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.ink,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 100,
  },
  recDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.bad },
  badgeText: {
    fontFamily: fonts.bold,
    fontSize: scale(10.5),
    color: colors.lime,
  },
});
