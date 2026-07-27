/**
 * Общий контракт клиент ↔ сервер.
 *
 * Правила из SPEC.md §3.3, которые этот пакет обязан удерживать:
 *  - все деньги в центах (integer), никогда не float;
 *  - все временные метки — UTC ISO-8601 строки; локальная зона живёт в profile.timezone;
 *  - здесь только типы и контракты. Никаких значений долей распределения:
 *    по §8.2 они хранятся на сервере (settings.stake_split) и не хардкодятся в клиенте.
 */

/** ISO-8601 в UTC, например `2026-07-27T04:00:00.000Z`. */
export type UtcTimestamp = string;
/** Календарная дата `YYYY-MM-DD` в часовом поясе пользователя. */
export type LocalDate = string;
/** Время суток `HH:MM` в часовом поясе пользователя. */
export type LocalTime = string;
/** Денежная сумма в центах. Целое число. */
export type Cents = number;

/** §6.8 — типы утреннего испытания. */
export type ChallengeType = 'pattern' | 'math' | 'shake';

/** §6.6 — что поставлено на кон. */
export type AlarmMode = 'free' | 'stake' | 'squad';

/** §7.1 — жизненный цикл срабатывания. */
export type AlarmRunStatus =
  | 'scheduled'
  | 'ringing'
  | 'in_challenge'
  | 'completed'
  | 'failed'
  | 'expired';

/** §8.1 — жизненный цикл денежной ставки. */
export type StakeStatus =
  | 'pending'
  | 'released'
  | 'charged'
  | 'failed'
  | 'disputed'
  | 'refunded';

/** §8.2 — корзины распределения списанной суммы. */
export type LedgerBucket = 'platform' | 'charity' | 'reward_pool' | 'fee';

/** §7.6 — состояние ваучера. Обналичивание отсутствует по §14.2. */
export type VoucherStatus = 'issued' | 'redeemed' | 'exchanged' | 'expired';
export type VoucherSource = 'squad_win' | 'streak_milestone' | 'partner';

/** §6.14 — типы событий в ленте команды. */
export type ActivityEventType =
  | 'woke_up'
  | 'failed'
  | 'streak_milestone'
  | 'joined'
  | 'won_dispute'
  | 'got_voucher'
  | 'shared';

/** §14.3 — статус оспаривания списания. */
export type DisputeStatus = 'open' | 'approved' | 'rejected';

/** §8.4 — состояние подписки RISE+. */
export type SubscriptionStatus = 'trial' | 'active' | 'grace' | 'expired' | 'cancelled';
export type SubscriptionPlatform = 'ios' | 'android';

/** §7.4 — стадии эволюции маскота (1..5). */
export type MascotStage = 1 | 2 | 3 | 4 | 5;

/** 0 = воскресенье … 6 = суббота, как в `alarms.repeat_days`. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export interface Profile {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
  timezone: string;
  locale: string;
  isAdultConfirmed: boolean;
  streak: number;
  bestStreak: number;
  lastCompletedDate: LocalDate | null;
  pointsWeek: number;
  totalWakes: number;
  totalSavedCents: Cents;
  totalLostCents: Cents;
  treesPlanted: number;
  mascotStage: MascotStage;
  isPremium: boolean;
  premiumUntil: UtcTimestamp | null;
  moneyModesEnabled: boolean;
  createdAt: UtcTimestamp;
}

export interface Alarm {
  id: string;
  userId: string;
  timeLocal: LocalTime;
  /** Пустой массив = разовый будильник. */
  repeatDays: Weekday[];
  challengeType: ChallengeType;
  mode: AlarmMode;
  stakeCents: Cents;
  squadId: string | null;
  autoRecord: boolean;
  isActive: boolean;
  /** Вычисляется сервером в UTC. Клиент никогда не пишет это поле. */
  nextFireAt: UtcTimestamp | null;
  createdAt: UtcTimestamp;
}

export interface AlarmRun {
  id: string;
  alarmId: string;
  userId: string;
  scheduledFor: UtcTimestamp;
  ringingAt: UtcTimestamp | null;
  /** §4.2 — ringingAt + 5 минут, считается сервером. */
  windowEndsAt: UtcTimestamp | null;
  completedAt: UtcTimestamp | null;
  status: AlarmRunStatus;
  challengeType: ChallengeType;
  attempts: number;
  mode: AlarmMode;
  stakeCents: Cents;
  shared: boolean;
  createdAt: UtcTimestamp;
}

export interface Squad {
  id: string;
  name: string;
  ownerId: string;
  streak: number;
  inviteCode: string;
  createdAt: UtcTimestamp;
}

export interface ActivityEvent {
  id: string;
  squadId: string;
  actorId: string;
  type: ActivityEventType;
  payload: Record<string, unknown>;
  createdAt: UtcTimestamp;
}

export interface Voucher {
  id: string;
  userId: string;
  brand: string;
  icon: string | null;
  amountCents: Cents;
  /** Раскрывается только после активации (§6.17). */
  code: string | null;
  source: VoucherSource;
  status: VoucherStatus;
  expiresAt: UtcTimestamp | null;
  createdAt: UtcTimestamp;
}

/** §4.2 — окно на прохождение испытания. Отсчёт ведёт сервер. */
export const CHALLENGE_WINDOW_MS = 5 * 60 * 1000;

/** §7.5 — 1 дерево за 10 успешных подъёмов; для RISE+ — за 5. */
export const WAKES_PER_TREE = 10;
export const WAKES_PER_TREE_PREMIUM = 5;

/** §7.3 — множитель поинтов для подписчиков RISE+. */
export const PREMIUM_POINTS_MULTIPLIER = 1.5;
