/**
 * Испытание B — 3 примера подряд. docs/SPEC.md §6.11 B.
 *
 * Множители 4–11, четыре варианта ответа. Неверный ответ не меняет пример:
 * задача — заставить проснуться, а не пролистать.
 */

import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors, fonts, radius, spacing } from '../../design/tokens';
import { scale, type } from '../../design/type';

const REQUIRED = 3;
const MIN_FACTOR = 4;
const MAX_FACTOR = 11;

interface Problem {
  a: number;
  b: number;
  answer: number;
  options: number[];
}

function randomInt(min: number, max: number): number {
  return min + Math.floor(Math.random() * (max - min + 1));
}

function makeProblem(): Problem {
  const a = randomInt(MIN_FACTOR, MAX_FACTOR);
  const b = randomInt(MIN_FACTOR, MAX_FACTOR);
  const answer = a * b;

  // §6.11 B: три близких неверных варианта. Далёкие числа выдают правильный
  // ответ с первого взгляда и не будят.
  const distractors = new Set<number>();
  while (distractors.size < 3) {
    const delta = randomInt(1, 12) * (Math.random() < 0.5 ? -1 : 1);
    const candidate = answer + delta;
    if (candidate > 0 && candidate !== answer) distractors.add(candidate);
  }

  const options = [answer, ...distractors].sort(() => Math.random() - 0.5);
  return { a, b, answer, options };
}

export function MathChallenge({ onSolved }: { onSolved: () => void }) {
  const [solved, setSolved] = useState(0);
  const [problem, setProblem] = useState<Problem>(makeProblem);
  const [wrongOption, setWrongOption] = useState<number | null>(null);

  const answer = useCallback(
    (option: number) => {
      if (option !== problem.answer) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        setWrongOption(option);
        setTimeout(() => setWrongOption(null), 600);
        return;
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const next = solved + 1;
      if (next >= REQUIRED) {
        onSolved();
        return;
      }
      setSolved(next);
      setProblem(makeProblem());
    },
    [onSolved, problem.answer, solved],
  );

  const progress = useMemo(
    () => Array.from({ length: REQUIRED }, (_, i) => i < solved),
    [solved],
  );

  return (
    <View style={styles.container}>
      <View style={styles.progressRow}>
        {progress.map((done, i) => (
          <View
            key={i}
            style={[styles.progressBar, done ? styles.progressBarDone : null]}
          />
        ))}
      </View>

      <Text style={styles.problem}>
        {problem.a} × {problem.b} = ?
      </Text>

      <View style={styles.options}>
        {problem.options.map((option) => (
          <Pressable
            key={option}
            accessibilityRole="button"
            onPress={() => answer(option)}
            style={({ pressed }) => [
              styles.option,
              wrongOption === option ? styles.optionWrong : null,
              pressed ? styles.optionPressed : null,
            ]}
          >
            <Text
              style={[
                styles.optionLabel,
                wrongOption === option ? styles.optionLabelWrong : null,
              ]}
            >
              {option}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.lg },

  progressRow: { flexDirection: 'row', gap: spacing.sm },
  progressBar: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.line2,
  },
  progressBarDone: { backgroundColor: colors.ink },

  problem: {
    ...type.display,
    fontSize: scale(46),
    textAlign: 'center',
  },

  options: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  option: {
    width: '47.5%',
    minHeight: 68,
    borderRadius: radius.cardSm,
    backgroundColor: colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.line2,
  },
  optionPressed: { transform: [{ scale: 0.97 }] },
  optionWrong: { borderColor: colors.bad, backgroundColor: '#FFE9EA' },
  optionLabel: {
    fontFamily: fonts.extrabold,
    fontSize: scale(28),
    color: colors.ink,
  },
  optionLabelWrong: { color: colors.bad },
});
