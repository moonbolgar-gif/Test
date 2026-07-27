/**
 * Испытание A — графический ключ ×2. docs/SPEC.md §6.11 A.
 *
 * Показывается эталонный узор, его надо повторить на сетке 3×3. Два раза подряд,
 * каждый раз новый узор.
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import Svg, { Line } from 'react-native-svg';

import { colors, fonts, radius, spacing } from '../../design/tokens';
import { scale, type } from '../../design/type';

/** §6.11 A: пул предустановленных узоров по 5–7 точек. */
const PATTERNS: number[][] = [
  [0, 1, 2, 5, 8],
  [0, 3, 6, 7, 8],
  [6, 3, 0, 1, 2, 5],
  [0, 4, 8, 7, 6],
  [2, 1, 0, 3, 4, 5],
  [8, 5, 2, 1, 0, 3],
  [1, 4, 7, 6, 3, 0],
];

const GRID = 3;
const NODE_HIT_RADIUS = 26;
const REQUIRED_ROUNDS = 2;

function randomPattern(exclude?: number[]): number[] {
  const candidates = exclude
    ? PATTERNS.filter((p) => p.join() !== exclude.join())
    : PATTERNS;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Мелкая сетка-эталон, которую надо повторить. */
function PatternPreview({ pattern }: { pattern: number[] }) {
  const cell = 14;
  const size = cell * GRID;
  const center = (index: number) => ({
    x: (index % GRID) * cell + cell / 2,
    y: Math.floor(index / GRID) * cell + cell / 2,
  });

  return (
    <View style={styles.preview}>
      <Svg width={size} height={size}>
        {pattern.slice(0, -1).map((node, i) => {
          const from = center(node);
          const to = center(pattern[i + 1]);
          return (
            <Line
              key={i}
              x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke={colors.ink} strokeWidth={2} strokeLinecap="round"
            />
          );
        })}
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        {Array.from({ length: GRID * GRID }, (_, i) => {
          const { x, y } = center(i);
          const active = pattern.includes(i);
          return (
            <View
              key={i}
              style={[
                styles.previewDot,
                {
                  left: x - 2.5,
                  top: y - 2.5,
                  backgroundColor: active ? colors.ink : colors.line2,
                },
              ]}
            />
          );
        })}
      </View>
    </View>
  );
}

export function PatternChallenge({ onSolved }: { onSolved: () => void }) {
  const [round, setRound] = useState(0);
  const [target, setTarget] = useState<number[]>(() => randomPattern());
  const [drawn, setDrawn] = useState<number[]>([]);
  const [error, setError] = useState(false);

  const gridRef = useRef<View>(null);
  const layout = useRef({ x: 0, y: 0, size: 0 });
  // Размеры живут в ref (их читает обработчик жеста), но линии рисуются в render,
  // поэтому готовность сетки дублируется состоянием — иначе первый кадр после
  // измерения не перерисуется.
  const [gridReady, setGridReady] = useState(false);
  // PanResponder пересоздавать нельзя — он захватывает замыкание на момент
  // создания, поэтому текущий путь читается через ref, а не из состояния.
  const drawnRef = useRef<number[]>([]);

  const nodeAt = useCallback((pageX: number, pageY: number): number | null => {
    const { x, y, size } = layout.current;
    if (size === 0) return null;
    const step = size / GRID;
    for (let i = 0; i < GRID * GRID; i++) {
      const cx = x + (i % GRID) * step + step / 2;
      const cy = y + Math.floor(i / GRID) * step + step / 2;
      if (Math.hypot(pageX - cx, pageY - cy) < NODE_HIT_RADIUS) return i;
    }
    return null;
  }, []);

  const addNode = useCallback((pageX: number, pageY: number) => {
    const node = nodeAt(pageX, pageY);
    if (node === null || drawnRef.current.includes(node)) return;
    drawnRef.current = [...drawnRef.current, node];
    setDrawn(drawnRef.current);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [nodeAt]);

  const finish = useCallback(() => {
    const path = drawnRef.current;
    drawnRef.current = [];
    setDrawn([]);

    if (path.join() === target.join()) {
      const next = round + 1;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (next >= REQUIRED_ROUNDS) {
        onSolved();
        return;
      }
      setRound(next);
      setTarget(randomPattern(target));
      return;
    }

    // §6.11 A: не совпало — узор перегенерируется, раунд не засчитан.
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    setError(true);
    setTimeout(() => setError(false), 900);
    setTarget(randomPattern(target));
  }, [onSolved, round, target]);

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => addNode(e.nativeEvent.pageX, e.nativeEvent.pageY),
        onPanResponderMove: (e) => addNode(e.nativeEvent.pageX, e.nativeEvent.pageY),
        onPanResponderRelease: finish,
        onPanResponderTerminate: finish,
      }),
    [addNode, finish],
  );

  const step = layout.current.size / GRID;
  const localCenter = (index: number) => ({
    x: (index % GRID) * step + step / 2,
    y: Math.floor(index / GRID) * step + step / 2,
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={type.eyebrow}>Повтори узор</Text>
          <Text style={[type.caption, styles.progress]}>{round}/{REQUIRED_ROUNDS}</Text>
        </View>
        <PatternPreview pattern={target} />
      </View>

      <View
        ref={gridRef}
        style={[styles.grid, error ? styles.gridError : null]}
        // Координаты сетки нужны в системе окна, потому что PanResponder отдаёт
        // pageX/pageY. onLayout даёт размеры относительно родителя, поэтому
        // положение измеряется отдельно через measureInWindow.
        onLayout={() => {
          gridRef.current?.measureInWindow((x, y, width) => {
            layout.current = { x, y, size: width };
            setGridReady(true);
          });
        }}
        {...responder.panHandlers}
      >
        {gridReady ? (
          <Svg style={StyleSheet.absoluteFill}>
            {drawn.slice(0, -1).map((node, i) => {
              const from = localCenter(node);
              const to = localCenter(drawn[i + 1]);
              return (
                <Line
                  key={i}
                  x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                  stroke={colors.ink} strokeWidth={5} strokeLinecap="round"
                />
              );
            })}
          </Svg>
        ) : null}

        {Array.from({ length: GRID * GRID }, (_, i) => {
          const active = drawn.includes(i);
          return (
            <View key={i} style={styles.cell} pointerEvents="none">
              <View
                style={[
                  styles.node,
                  active ? styles.nodeActive : null,
                ]}
              />
            </View>
          );
        })}
      </View>

      {error ? <Text style={styles.errorText}>✗ Не тот узор</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  progress: { marginTop: 2 },
  preview: {
    width: 42, height: 42,
    padding: 0,
    backgroundColor: colors.card,
    borderRadius: radius.icon,
    borderWidth: 1,
    borderColor: colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewDot: { position: 'absolute', width: 5, height: 5, borderRadius: 2.5 },

  grid: {
    aspectRatio: 1,
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: radius.card,
    flexDirection: 'row',
    flexWrap: 'wrap',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  gridError: { borderColor: colors.bad },
  cell: {
    width: `${100 / GRID}%`,
    height: `${100 / GRID}%`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  node: {
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: colors.line2,
  },
  // §6.11 A: при попадании узел увеличивается в 1.5 раза.
  nodeActive: {
    width: 27, height: 27, borderRadius: 13.5,
    backgroundColor: colors.ink,
  },
  errorText: {
    ...type.label,
    fontFamily: fonts.bold,
    fontSize: scale(14),
    color: colors.bad,
    textAlign: 'center',
  },
});
