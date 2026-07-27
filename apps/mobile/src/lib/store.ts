/**
 * Состояние демо-режима.
 *
 * Заменяет собой Supabase: всё живёт в памяти и сбрасывается при перезапуске.
 * Границы ответственности сохранены — экраны читают состояние и вызывают действия,
 * бизнес-логика живёт здесь (§3.3: никакой бизнес-логики в компонентах).
 *
 * Что в демо отличается от продакшена и должно быть заменено:
 *   - будильник не планируется в системе, срабатывание запускается вручную (§4.1);
 *   - деньги не списываются, только показываются (§8);
 *   - видео не пишется (§4.3);
 *   - данные не переживают перезапуск.
 */

import type { AlarmMode, ChallengeType, Cents, Weekday } from '@rise/shared';
import { create } from 'zustand';

import { mascotStageForStreak } from '../components/animated';
import { clearWindow, startWindow } from './demoServer';

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
}

export interface DemoRun {
  id: string;
  alarmId: string;
  mode: AlarmMode;
  stakeCents: Cents;
  challengeType: ChallengeType;
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

interface State {
  profile: Profile;
  alarms: DemoAlarm[];
  activeRun: DemoRun | null;
  /** Итог последнего срабатывания — читается экранами Win/Fail. */
  lastOutcome: { runId: string; won: boolean; stakeCents: Cents; mode: AlarmMode } | null;
  squadName: string;
  squadStreak: number;
  members: SquadMember[];
  feed: FeedEvent[];
  vouchers: Voucher[];
  toast: string | null;

  createAlarm: (alarm: Omit<DemoAlarm, 'id' | 'isActive'>) => void;
  deleteAlarm: (id: string) => void;
  startRun: (alarmId: string) => void;
  completeRun: () => void;
  failRun: () => void;
  markShared: () => void;
  reactToEvent: (eventId: string) => void;
  nudge: (memberId: string) => void;
  revealVoucher: (id: string) => void;
  showToast: (message: string) => void;
  hideToast: () => void;
}

const uid = (): string => Math.random().toString(36).slice(2, 10);

/** §7.3 — поинты. RISE+ даёт множитель ×1.5 на всё. */
function awardPoints(profile: Profile, base: number): number {
  const multiplier = profile.isPremium ? 1.5 : 1;
  return Math.round(base * multiplier);
}

/** §7.5 — 1 дерево за 10 подъёмов, для RISE+ за 5. */
function treesFor(totalWakes: number, isPremium: boolean): number {
  return Math.floor(totalWakes / (isPremium ? 5 : 10));
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

  createAlarm: (alarm) =>
    set((state) => ({
      alarms: [{ ...alarm, id: uid(), isActive: true }, ...state.alarms],
      toast: '🔒 Будильник поставлен. Спокойной ночи!',
    })),

  deleteAlarm: (id) =>
    set((state) => ({ alarms: state.alarms.filter((a) => a.id !== id) })),

  startRun: (alarmId) => {
    const alarm = get().alarms.find((a) => a.id === alarmId);
    if (!alarm) return;
    const runId = uid();
    // Окно начинает отсчитывать «сервер» (§4.2), а не экран.
    startWindow(runId);
    set({
      activeRun: {
        id: runId,
        alarmId,
        mode: alarm.mode,
        stakeCents: alarm.stakeCents,
        challengeType: alarm.challengeType,
      },
      lastOutcome: null,
    });
  },

  completeRun: () => {
    const { activeRun, profile } = get();
    if (!activeRun) return;
    clearWindow(activeRun.id);

    const totalWakes = profile.totalWakes + 1;
    const streak = profile.streak + 1;
    // §7.3: +10 за подъём вовремя, +20 если стрик кратен 7.
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
      },
      profile: {
        ...profile,
        streak,
        bestStreak: Math.max(profile.bestStreak, streak),
        totalWakes,
        points,
        trees: treesFor(totalWakes, profile.isPremium),
        // §8.1 шаг 3: ставка остаётся у пользователя.
        savedCents: profile.savedCents + activeRun.stakeCents,
        weekDone: [...new Set([...profile.weekDone, todayWeekday()])] as Weekday[],
      },
    });
  },

  failRun: () => {
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
      },
      profile: {
        ...profile,
        // §7.2: стрик обнуляется.
        streak: 0,
        // §7.4: маскот откатывается на стадию назад, а не в самое начало.
        lostCents: profile.lostCents + activeRun.stakeCents,
      },
    });
  },

  markShared: () =>
    set((state) => ({
      // §7.3: +5 за шеринг, не чаще раза в день.
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
}));

function todayWeekday(): Weekday {
  return new Date().getDay() as Weekday;
}

/** §7.4 — стадия маскота по текущему стрику. */
export function useMascotStage(): number {
  const { streak, isPremium } = useStore((s) => s.profile);
  const stage = mascotStageForStreak(streak);
  // §7.4: у бесплатных маскот не эволюционирует выше второй стадии.
  return isPremium ? stage : Math.min(stage, 2);
}
