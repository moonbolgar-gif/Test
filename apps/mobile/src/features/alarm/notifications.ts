/**
 * Системные уведомления будильника. docs/SPEC.md §4.1 (подход A), §11.
 *
 * ВАЖНО про границы демо. §4.1 описывает цепочку из 20–30 уведомлений с
 * интервалом 30 секунд и `interruptionLevel = .timeSensitive`, имитирующую
 * непрерывный звон. Здесь планируется упрощённая цепочка, и работает она только
 * там, где Expo Go это позволяет.
 *
 * Чего это НЕ заменяет: надёжного срабатывания при закрытом приложении. Это
 * `RiseAlarmModule` из §3.1 и главный риск проекта (§4.1). Пока его нет,
 * гарантии, что пользователь проснётся, у приложения нет.
 */

import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

/** §4.1: серия уведомлений имитирует непрерывный звон. Лимит iOS — 64 штуки. */
const CHAIN_LENGTH = 8;
const CHAIN_INTERVAL_MS = 30_000;

let handlerConfigured = false;

function configureHandler(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function requestNotificationPermission(): Promise<boolean> {
  try {
    configureHandler();
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        // §4.1: time-sensitive пробивает Focus и «Не беспокоить» и не требует
        // отдельного разрешения Apple, в отличие от Critical Alerts.
        allowProvisional: false,
      },
    });
    return asked.granted;
  } catch {
    // В Expo Go на Android модуль уведомлений урезан — молча выключаем ветку.
    return false;
  }
}

/**
 * Планирует серию уведомлений на момент срабатывания.
 * Возвращает идентификаторы, чтобы их можно было отменить (§7.1: при переходе
 * в `in_challenge` остаток серии отменяется).
 */
export async function scheduleAlarmChain(
  fireAt: number,
  label: string,
): Promise<string[]> {
  try {
    configureHandler();
    const ids: string[] = [];

    for (let i = 0; i < CHAIN_LENGTH; i++) {
      const at = fireAt + i * CHAIN_INTERVAL_MS;
      if (at <= Date.now()) continue;

      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: '⏰ Подъём! Открой RISE',
          body: label,
          sound: true,
          interruptionLevel: 'timeSensitive',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(at),
        },
      });
      ids.push(id);
    }
    return ids;
  } catch {
    return [];
  }
}

export async function cancelNotifications(ids: string[]): Promise<void> {
  await Promise.all(
    ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})),
  );
}

export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
  } catch {
    // нечего отменять
  }
}

/** В Expo Go на Android уведомления урезаны — экраны об этом предупреждают. */
export const notificationsSupported = Platform.OS === 'ios';
