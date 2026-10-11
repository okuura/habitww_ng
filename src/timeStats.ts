import type { Habit } from './supabase';
import { addDays, type AchievementContext } from './achievements';

// 習慣ごとの実施時刻(UI を持たない純粋な関数)。
// 時刻は「その日の 0 時からの分」。0〜3 時台は前の日の夜の続きとして 24 時以降に数える(25:30 など)

export const DAY_START = 4 * 60;
const minutesOf = (t: { hour: number; minute: number }) => (t.hour < 4 ? t.hour + 24 : t.hour) * 60 + t.minute;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** 分を「21:40」に(24 時以降は 0 時台に戻す) */
export const clock = (m: number) => {
  const r = ((Math.round(m) % 1440) + 1440) % 1440;
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
};

/** 月曜はじまりの曜日の並び(0=日曜) */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

export interface WeekdayTime {
  day: number;
  /** 期間内の実施時刻 */
  points: number[];
  /** 2 回以上あれば平均 */
  mean: number | null;
}

export interface WeeklyPoint {
  /** その週の月曜 */
  week: string;
  mean: number | null;
  count: number;
}

export interface HabitTimeProfile {
  habit: Habit;
  /** 期間内の記録数 */
  count: number;
  mean: number | null;
  weekdays: WeekdayTime[];
  /** 一番早い・遅い曜日(差が 15 分以上のときだけ) */
  earliest: { day: number; mean: number } | null;
  latest: { day: number; mean: number } | null;
  /** 直近 days 日と、その前の days 日の平均の差(分。曜日の差をならした値。どちらも 5 回以上のときだけ。すべての期間では出さない) */
  trend: { diff: number; days: number } | null;
  /** 直近 12 週の週ごとの平均(曜日の差をならした値) */
  weekly: WeeklyPoint[];
  /** 予定の時刻 */
  scheduled: number | null;
}

const weekdayOf = (ds: string) => new Date(ds + 'T00:00:00').getDay();

const mondayOf = (ds: string) => {
  const day = new Date(ds + 'T00:00:00').getDay();
  return addDays(ds, -((day + 6) % 7));
};

/** 実施時刻を見せられる習慣(記録が 3 回以上)の id */
export function timedHabitIds(ctx: AchievementContext, min = 3): Set<string> {
  const total = new Map<string, number>();
  for (const t of ctx.timed) total.set(t.habitId, (total.get(t.habitId) ?? 0) + 1);
  return new Set([...total].filter(([, n]) => n >= min).map(([id]) => id));
}

/** days: 曜日ごとの集計に使う日数(null ならすべて) */
export function habitTimeProfiles(ctx: AchievementContext, days: number | null): HabitTimeProfile[] {
  const from = days === null ? '' : addDays(ctx.todayStr, -(days - 1));
  const recentFrom = days === null ? '' : addDays(ctx.todayStr, -(days - 1));
  const prevFrom = days === null ? '' : addDays(ctx.todayStr, -(days * 2 - 1));
  const thisMonday = mondayOf(ctx.todayStr);
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(thisMonday, -7 * (11 - i)));

  return ctx.habits.map(({ habit }) => {
    const all = ctx.timed.filter(t => t.habitId === habit.id).map(t => ({ date: t.date, m: minutesOf(t) }));
    const inRange = all.filter(t => t.date >= from);

    const weekdays: WeekdayTime[] = WEEK_ORDER.map(day => {
      const points = inRange.filter(t => weekdayOf(t.date) === day).map(t => t.m);
      return { day, points, mean: points.length >= 2 ? avg(points) : null };
    });
    const ranked = weekdays.filter((w): w is WeekdayTime & { mean: number } => w.mean !== null).sort((a, b) => a.mean - b.mean);
    const spread = ranked.length >= 2 ? ranked[ranked.length - 1].mean - ranked[0].mean : 0;
    const showEnds = ranked.length >= 2 && spread >= 15;

    // 傾向は曜日の差をならした時刻で比べる(週末だけ遅い習慣で、期間に入る週末の数によって平均が動かないように)。
    // 「その曜日のいつもの時刻からのずれ」を全体の平均に足した値
    const overall = all.length > 0 ? avg(all.map(t => t.m)) : 0;
    const base = new Map<number, number>();
    for (let day = 0; day < 7; day++) {
      const ms = all.filter(t => weekdayOf(t.date) === day).map(t => t.m);
      if (ms.length > 0) base.set(day, avg(ms));
    }
    const adjusted = all.map(t => ({ date: t.date, m: t.m - (base.get(weekdayOf(t.date)) ?? overall) + overall }));

    const recent = adjusted.filter(t => t.date >= recentFrom).map(t => t.m);
    const prev = adjusted.filter(t => t.date >= prevFrom && t.date < recentFrom).map(t => t.m);
    const trend = days !== null && recent.length >= 5 && prev.length >= 5 ? { diff: Math.round(avg(recent) - avg(prev)), days } : null;

    const weekly = weeks.map(week => {
      const end = addDays(week, 7);
      const ms = adjusted.filter(t => t.date >= week && t.date < end).map(t => t.m);
      return { week, mean: ms.length > 0 ? avg(ms) : null, count: ms.length };
    });

    let scheduled: number | null = null;
    if (habit.scheduled_time) {
      const [h, m] = habit.scheduled_time.split(':').map(Number);
      if (!Number.isNaN(h) && !Number.isNaN(m)) scheduled = minutesOf({ hour: h, minute: m });
    }

    return {
      habit,
      count: inRange.length,
      mean: inRange.length > 0 ? avg(inRange.map(t => t.m)) : null,
      weekdays,
      earliest: showEnds ? { day: ranked[0].day, mean: ranked[0].mean } : null,
      latest: showEnds ? { day: ranked[ranked.length - 1].day, mean: ranked[ranked.length - 1].mean } : null,
      trend,
      weekly,
      scheduled,
    };
  });
}

/** 目盛りの範囲(時間ちょうどに丸める)。外れ値に引っぱられないよう 5〜95% の点で決める */
export function timeRange(values: number[]): { from: number; to: number; step: number } {
  if (values.length === 0) return { from: 18 * 60, to: 24 * 60, step: 60 };
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((sorted.length - 1) * p)))];
  let from = Math.floor(q(0.05) / 60) * 60;
  let to = Math.ceil(q(0.95) / 60) * 60;
  if (to - from < 180) {
    const mid = (from + to) / 2;
    from = Math.floor((mid - 90) / 60) * 60;
    to = from + 180;
  }
  from = Math.max(DAY_START, from);
  to = Math.min(DAY_START + 1440, Math.max(to, from + 180));
  const span = (to - from) / 60;
  const step = span <= 6 ? 60 : span <= 12 ? 120 : 240;
  return { from, to, step };
}
