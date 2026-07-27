/**
 * Перехват ошибок отрисовки.
 *
 * Без него любая ошибка в React-дереве оставляет пользователя перед пустым
 * экраном или выбрасывает из приложения. Для будильника это особенно плохо:
 * человек не поймёт, сработало испытание или нет, и потерял ли он деньги.
 *
 * Границу ставим на всё приложение и отдельно на экран срабатывания — там цена
 * ошибки выше всего.
 */

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '../components/Button';
import { colors, fonts, radius, spacing } from '../design/tokens';
import { scale } from '../design/type';

interface Props {
  children: ReactNode;
  /** Что показать вместо экрана падения — например, вернуть на главную. */
  onReset?: () => void;
  label?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // В проде тут Sentry (§3.1). Пока — консоль, чтобы ошибка была видна
    // в терминале Metro, а не терялась молча.
    console.error('[RISE] сбой интерфейса', this.props.label ?? '', error, info.componentStack);
  }

  private reset = (): void => {
    this.setState({ error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.emoji}>🛠️</Text>
          <Text style={styles.title}>Что-то сломалось</Text>
          <Text style={styles.body}>
            Это сбой приложения, а не твоя вина. Испытание засчитано не будет —
            попробуй ещё раз.
          </Text>
          <View style={styles.details}>
            <Text style={styles.detailsText} selectable>
              {error.message}
            </Text>
          </View>
        </ScrollView>
        <Button label="Вернуться на главную" variant="lime" onPress={this.reset} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: 'center' },
  content: { alignItems: 'center', gap: spacing.md, paddingBottom: spacing.lg },
  emoji: { fontSize: 48 },
  title: {
    fontFamily: fonts.extrabold,
    fontSize: scale(24),
    color: colors.ink,
    textAlign: 'center',
  },
  body: {
    fontFamily: fonts.medium,
    fontSize: scale(15),
    lineHeight: scale(15) * 1.5,
    color: colors.inkSoft,
    textAlign: 'center',
  },
  details: {
    backgroundColor: colors.card,
    borderRadius: radius.cardSm,
    padding: spacing.md,
    width: '100%',
  },
  detailsText: {
    fontFamily: fonts.medium,
    fontSize: scale(12),
    color: colors.inkFaint,
  },
});
