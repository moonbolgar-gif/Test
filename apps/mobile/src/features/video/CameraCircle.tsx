/**
 * Видео-кружок с фронтальной камеры. docs/SPEC.md §6.10, §4.3.
 *
 * §4.3: фронтальная камера, квадрат, без звука по умолчанию, максимум 60 секунд,
 * файл остаётся локально и не загружается никуда сам (§4.4).
 *
 * Подсветка лица: у фронтальной камеры iPhone нет вспышки, поэтому источником
 * света работает сам экран — лаймовый фон §6.10 плюс белый ореол вокруг кружка
 * и поднятая до максимума яркость. Ореол даёт блик в глазах, из-за которого лицо
 * читается даже в темноте, а не выглядит серым пятном.
 */

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Svg, { Circle } from 'react-native-svg';

import { colors, fonts } from '../../design/tokens';
import { scale } from '../../design/type';

const SIZE = 104;               // §6.10
const RING_STROKE = 4;
const HALO_SIZE = 168;
/** §4.3 — максимальная длина записи. */
export const MAX_DURATION_SEC = 60;

export interface CameraCircleHandle {
  /** Возвращает путь к файлу или null, если записать не удалось. */
  stopAndSave: () => Promise<string | null>;
}

interface Props {
  /** Доля окна испытания, прошедшая к текущему моменту (0..1). */
  progress: number;
  /** §6.8 — настройка «Авто-запись кружка». */
  recording: boolean;
  onStateChange?: (state: 'idle' | 'recording' | 'denied' | 'error') => void;
}

export const CameraCircle = forwardRef<CameraCircleHandle, Props>(function CameraCircle(
  { progress, recording, onStateChange },
  ref,
) {
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  const camera = useRef<CameraView>(null);
  // Промис записи резолвится только после stopRecording, поэтому храним его,
  // а не await-им на месте.
  const recordingPromise = useRef<Promise<{ uri: string } | undefined> | null>(null);

  useEffect(() => {
    if (!permission) return;
    if (!permission.granted && permission.canAskAgain) {
      requestPermission().catch(() => setFailed(true));
    }
  }, [permission, requestPermission]);

  const granted = permission?.granted === true;

  useEffect(() => {
    onStateChange?.(
      failed ? 'error' : !granted ? 'denied' : recording && ready ? 'recording' : 'idle',
    );
  }, [failed, granted, onStateChange, ready, recording]);

  // Запись стартует автоматически, как только камера готова (§4.3).
  useEffect(() => {
    if (!granted || !ready || !recording || recordingPromise.current) return;
    try {
      recordingPromise.current =
        camera.current?.recordAsync({ maxDuration: MAX_DURATION_SEC }) ?? null;
    } catch {
      setFailed(true);
    }
  }, [granted, ready, recording]);

  useImperativeHandle(ref, () => ({
    stopAndSave: async () => {
      if (!recordingPromise.current) return null;
      try {
        camera.current?.stopRecording();
        const result = await recordingPromise.current;
        return result?.uri ?? null;
      } catch {
        return null;
      } finally {
        recordingPromise.current = null;
      }
    },
  }));

  const r = (SIZE - RING_STROKE) / 2;
  const circumference = 2 * Math.PI * r;
  const active = granted && recording && !failed;

  return (
    <View style={styles.wrap}>
      {/* Ореол-подсветка. Три слоя вместо радиального градиента: в RN его нет
          без дополнительной зависимости, а сложение полупрозрачных кругов даёт
          достаточно мягкий край. */}
      {active ? (
        <>
          <View style={[styles.halo, styles.haloOuter]} />
          <View style={[styles.halo, styles.haloMid]} />
          <View style={[styles.halo, styles.haloInner]} />
        </>
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
          stroke={colors.ink} strokeOpacity={0.15} strokeWidth={RING_STROKE} fill="none"
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

      <Text style={styles.badge}>
        {failed
          ? 'камера недоступна'
          : !granted
            ? 'нет доступа к камере'
            : active
              ? '● REC · битва пишется'
              : 'запись выключена'}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { width: SIZE, alignItems: 'center', justifyContent: 'center' },

  halo: { position: 'absolute', backgroundColor: '#FFFFFF' },
  haloOuter: {
    width: HALO_SIZE, height: HALO_SIZE, borderRadius: HALO_SIZE / 2, opacity: 0.18,
  },
  haloMid: {
    width: HALO_SIZE * 0.82, height: HALO_SIZE * 0.82, borderRadius: HALO_SIZE / 2, opacity: 0.28,
  },
  haloInner: {
    width: HALO_SIZE * 0.66, height: HALO_SIZE * 0.66, borderRadius: HALO_SIZE / 2, opacity: 0.4,
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
  placeholderGlyph: { fontSize: 28 },

  badge: {
    position: 'absolute',
    bottom: -18,
    width: 160,
    textAlign: 'center',
    fontFamily: fonts.bold,
    fontSize: scale(10),
    color: colors.inkSoft,
  },
});
