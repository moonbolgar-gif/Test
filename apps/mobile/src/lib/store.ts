/**
 * Состояние демо-режима.
 *
 * Заменяет собой Supabase: всё живёт в памяти и сбрасывается при перезапуске.
 * Границы ответственности сохранены — экраны читают состояние и вызывают действия,
 * бизнес-логика живёт здесь (§3.3: никакой бизнес-логики в компонентах).
 *
 * Что в демо отличается от продакшена и должно быть заменено:
 *   - будильник срабатывает только пока приложение живо; надёжный звонок при
 *     закрытом приложении — это `RiseAlarmModule` из §4.1 (Фаза 0);
 *   - деньги не списываются, только показываются (§8);
 *   - видео пишется по-настоящему, но композитинга шеринг-карточки нет (§4.3);
 *   - данные не переживают перезапуск.
 */

import type { AlarmMode, ChallengeType, Cents, Weekday } from '@rise/shared';
import { create } from 'zustand';

import { mascotStageForStreak } from '../components/animated';
import { nextFireAt } from '../features/alarm/schedule';
import { cancelNotifications, scheduleAlarmChain } from '../features/alarm/notifications';
import { clearWindow, startWindow } from './demoServer';
import { formatMoney } from './format';

export interface DemoAlarm {
  id: string;
  hour: number;
  minute: number;
  repeatDays: Weekday[];
  challengeType: ChallengeType;
  mode: AlarmMode;
  stakeCents: Cents;
  autoRecord: boolean;
  isActive: boolean;
  /** Момент следующего срабатывания. В проде считает сервер (§10). */
  nextFireAt: number;
  /** Идентификаторы запланированной серии уведомлений (§4.1). */
  notificationIds: string[];
}

export interface DemoRun {
  id: string;
  alarmId: string;
  mode: AlarmMode;
  stakeCents: Cents;
  challengeType: ChallengeType;
  autoRecord: boolean;
}

export interface SquadMember {
  id: string;
  name: string;
  streak: number;
  wokeUpAt: string | null;
  nudgedToday: boolean;
}

export interface FeedEvent {
  id: string;
  actorId: string;
  actorName: string;
  text: string;
  ago: string;
  emoji: string;
  reactions: number;
  reactedByMe: boolean;
}

export interface Voucher {
  id: string;
  brand: string;
  icon: string;
  amountCents: Cents;
  code: string;
  revealed: boolean;
}

interface Profile {
  id: string;
  name: string;
  streak: number;
  bestStreak: number;
  totalWakes: number;
  savedCents: Cents;
  lostCents: Cents;
  trees: number;
  points: number;
  isPremium: boolean;
  /** §6.4 — какие дни текущей недели закрыты. Индексы 0=Вс..6=Сб. */
  weekDone: Weekday[];
}

interface Outcome {
  runId: string;
  won: boolean;
  stakeCents: Cents;
  mode: AlarmMode;
  /** Путь к записанному видео, если запись велась (§4.3). */
  videoUri: string | null;
}

interface State {
  profile: Profile;
  alarms: DemoAlarm[];
  activeRun: DemoRun | null;
  lastOutcome: Outcome | null;
  squadName: string;
  squadStreak: number;
  members: SquadMember[];
  feed: FeedEvent[];
  vouchers: Voucher[];
  toast: string | null;

  createAlarm: (alarm: NewAlarm) => void;
  /** §6.2, экран 5 — тестовый будильник через минуту. */
  createTestAlarm: () => void;
  deleteAlarm: (id: string) => void;
  startRun: (alarmId: string) => void;
  completeRun: (videoUri: string | null) => void;
  failRun: (videoUri: string | null) => void;
  markShared: () => void;
  reactToEvent: (eventId: string) => void;
  nudge: (memberId: string) => void;
  revealVoucher: (id: string) => void;
  showToast: (message: string) => void;
  hideToast: () => void;
  togglePremium: () => void;
}

type NewAlarm = Omit<DemoAlarm, 'id' | 'isActive' | 'nextFireAt' | 'notificationIds'>;

const uid = (): string => Math.random().toString(36).slice(2, 10);

/** §7.3 — поинты. RISE+ даёт множитель ×1.5 на всё. */
function awardPoints(profile: Profile, base: number): number {
  return Math.round(base * (profile.isPremium ? 1.5 : 1));
}

/** §7.5 — 1 дерево за 10 подъёмов, для RISE+ за 5. */
function treesFor(totalWakes: number, isPremium: boolean): number {
  return Math.floor(totalWakes / (isPremium ? 5 : 10));
}

/** Подпись для уведомления — по §14.2 без слова «ставка». */
function alarmLabel(alarm: { mode: AlarmMode; stakeCents: Cents }): string {
  if (alarm.mode === 'free') return 'Серия на кону';
  return `${formatMoney(alarm.stakeCents)} на кону`;
}

/**
 * Планирует серию уведомлений и дописывает их идентификаторы в будильник.
 * Намеренно не блокирует создание: если разрешение не выдано, будильник всё
 * равно сработает, пока приложение открыто.
 */
function scheduleFor(alarmId: string, fireAt: number, label: string): void {
  scheduleAlarmChain(fireAt, label)
    .then((ids) => {
      if (ids.length === 0) return;
      useStore.setState((state) => ({
        alarms: state.alarms.map((a) =>
          a.id === alarmId ? { ...a, notificationIds: ids } : a,
        ),
      }));
    })
    .catch(() => {});
}

export const useStore = create<State>((set, get) => ({
  profile: {
    id: 'me',
    name: 'Ты',
    streak: 4,
    bestStreak: 23,
    totalWakes: 142,
    savedCents: 4200,
    lostCents: 1500,
    trees: 14,
    points: 380,
    isPremium: false,
    weekDone: [1, 2, 3, 4],
  },

  alarms: [
    {
      id: 'seed-alarm',
      hour: 7,
      minute: 0,
      repeatDays: [1, 2, 3, 4, 5],
      challengeType: 'pattern',
      mode: 'stake',
      stakeCents: 500,
      autoRecord: true,
      isActive: true,
      nextFireAt: nextFireAt({ hour: 7, minute: 0, repeatDays: [1, 2, 3, 4, 5] }),
      notificationIds: [],
    },
  ],

  activeRun: null,
  lastOutcome: null,

  squadName: 'Ранние птицы',
  squadStreak: 12,
  members: [
    { id: 'u1', name: 'Даша', streak: 18, wokeUpAt: '5:58', nudgedToday: false },
    { id: 'u2', name: 'Дэн', streak: 89, wokeUpAt: '6:12', nudgedToday: false },
    { id: 'u3', name: 'Марк', streak: 3, wokeUpAt: null, nudgedToday: false },
    { id: 'u4', name: 'Лена', streak: 7, wokeUpAt: null, nudgedToday: false },
  ],

  feed: [
    {
      id: 'e1', actorId: 'u2', actorName: 'Дэн',
      text: 'достиг серии 89 дней', ago: '12 мин',
      emoji: '🔥', reactions: 5, reactedByMe: false,
    },
    {
      id: 'e2', actorId: 'u1', actorName: 'Даша',
      text: 'встала в 5:58 — раньше всех', ago: '34 мин',
      emoji: '👏', reactions: 3, reactedByMe: false,
    },
    {
      id: 'e3', actorId: 'u4', actorName: 'Лена',
      text: 'получила награду за серию 7 дней', ago: '2 ч',
      emoji: '🎟️', reactions: 1, reactedByMe: false,
    },
  ],

  vouchers: [
    {
      id: 'v1', brand: 'Кофейня', icon: '☕️',
      amountCents: 200, code: 'RISE-8842', revealed: false,
    },
  ],

  toast: null,

  createAlarm: (alarm) => {
    const id = uid();
    const fireAt = nextFireAt(alarm);
    set((state) => ({
      alarms: [
        { ...alarm, id, isActive: true, nextFireAt: fireAt, notificationIds: [] },
        ...state.alarms,
      ],
      toast: '🔒 Будильник поставлен. Спокойной ночи!',
    }));
    scheduleFor(id, fireAt, alarmLabel(alarm));
  },

  createTestAlarm: () => {
    const id = uid();
    const fireAt = Date.now() + 60_000;
    const at = new Date(fireAt);
    set((state) => ({
      alarms: [
        {
          id,
          hour: at.getHours(),
          minute: at.getMinutes(),
          repeatDays: [],
          challengeType: 'pattern',
          mode: 'free',
          stakeCents: 0,
          autoRecord: true,
          isActive: true,
          nextFireAt: fireAt,
          notificationIds: [],
        },
        ...state.alarms,
      ],
      toast: '⏰ Тестовый будильник через минуту. Заблокируй телефон.',
    }));
    scheduleFor(id, fireAt, 'Проверка будильника');
  },

  deleteAlarm: (id) => {
    const alarm = get().alarms.find((a) => a.id === id);
    if (alarm) cancelNotifications(alarm.notificationIds).catch(() => {});
    set((state) => ({ alarms: state.alarms.filter((a) => a.id !== id) }));
  },

  startRun: (alarmId) => {
    const alarm = get().alarms.find((a) => a.id === alarmId);
    if (!alarm || get().activeRun) return;

    // §7.1: при переходе в испытание остаток серии уведомлений отменяется.
    cancelNotifications(alarm.notificationIds).catch(() => {});

    const runId = uid();
    // Окно начинает отсчитывать «сервер» (§4.2), а не экран.
    startWindow(runId);

    set((state) => ({
      activeRun: {
        id: runId,
        alarmId,
        mode: alarm.mode,
        stakeCents: alarm.stakeCents,
        challengeType: alarm.challengeType,
        autoRecord: alarm.autoRecord,
      },
      lastOutcome: null,
      // Разовый будильник отработал — выключаем; повторяющийся переносим дальше.
      alarms: state.alarms.map((a) => {
        if (a.id !== alarmId) return a;
        if (a.repeatDays.length === 0) {
          return { ...a, isActive: false, notificationIds: [] };
        }
        const fireAt = nextFireAt(a, new Date(Date.now() + 60_000));
        return { ...a, nextFireAt: fireAt, notificationIds: [] };
      }),
    }));
  },

  completeRun: (videoUri) => {
    const { activeRun, profile } = get();
    if (!activeRun) return;
    clearWindow(activeRun.id);

    const totalWakes = profile.totalWakes + 1;
    const streak = profile.streak + 1;
    // §7.3: +10 за подъём вовремя, +20 если серия кратна 7.
    const points = profile.points
      + awardPoints(profile, 10)
      + (streak % 7 === 0 ? awardPoints(profile, 20) : 0);

    set({
      activeRun: null,
      lastOutcome: {
        runId: activeRun.id,
        won: true,
        stakeCents: activeRun.stakeCents,
        mode: activeRun.mode,
        videoUri,
      },
      profile: {
        ...profile,
        streak,
        bestStreak: Math.max(profile.bestStreak, streak),
        totalWakes,
        points,
        trees: treesFor(totalWakes, profile.isPremium),
        // §8.1 шаг 3: сумма остаётся у пользователя.
        savedCents: profile.savedCents + activeRun.stakeCents,
        weekDone: [...new Set([...profile.weekDone, todayWeekday()])] as Weekday[],
      },
    });
  },

  failRun: (videoUri) => {
    const { activeRun, profile } = get();
    if (!activeRun) return;
    clearWindow(activeRun.id);

    set({
      activeRun: null,
      lastOutcome: {
        runId: activeRun.id,
        won: false,
        stakeCents: activeRun.stakeCents,
        mode: activeRun.mode,
        videoUri,
      },
      profile: {
        ...profile,
        streak: 0,                                    // §7.2
        lostCents: profile.lostCents + activeRun.stakeCents,
      },
    });
  },

  markShared: () =>
    set((state) => ({
      // §7.3: +5 за публикацию, не чаще раза в день.
      profile: { ...state.profile, points: state.profile.points + awardPoints(state.profile, 5) },
      toast: '📲 Карточка готова к публикации',
    })),

  reactToEvent: (eventId) =>
    set((state) => ({
      feed: state.feed.map((event) =>
        event.id === eventId && !event.reactedByMe
          ? { ...event, reactions: event.reactions + 1, reactedByMe: true }
          : event,
      ),
    })),

  nudge: (memberId) => {
    const member = get().members.find((m) => m.id === memberId);
    if (!member || member.nudgedToday) return;
    set((state) => ({
      // §15: один нудж на человека в сутки.
      members: state.members.map((m) =>
        m.id === memberId ? { ...m, nudgedToday: true } : m,
      ),
      toast: `📣 ${member.name} получит уведомление`,
    }));
  },

  revealVoucher: (id) =>
    set((state) => ({
      vouchers: state.vouchers.map((v) => (v.id === id ? { ...v, revealed: true } : v)),
    })),

  showToast: (message) => set({ toast: message }),
  hideToast: () => set({ toast: null }),

  // Демо-переключатель: даёт посмотреть, как выглядит приложение с подпиской.
  togglePremium: () =>
    set((state) => ({
      profile: { ...state.profile, isPremium: !state.profile.isPremium },
      toast: state.profile.isPremium ? 'RISE+ выключен' : '⚡️ RISE+ включён',
    })),
}));

function todayWeekday(): Weekday {
  return new Date().getDay() as Weekday;
}

/** §7.4 — стадия маскота по текущей серии. */
export function useMascotStage(): number {
  const { streak, isPremium } = useStore((s) => s.profile);
  const stage = mascotStageForStreak(streak);
  // §7.4: у бесплатных маскот не эволюционирует выше второй стадии.
  return isPremium ? stage : Math.min(stage, 2);
}
