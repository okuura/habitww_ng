import type { Habit } from './supabase';
import type { AchievementContext } from './achievements';

// 統計ページの「自己ベスト」(UI を持たない純粋な関数)

export interface PersonalBests {
  /** 一番長く続いた連続 */
  longestStreak: { days: number; habit: Habit; start: string; end: string } | null;
  /** 一番多く実施した月 */
  bestMonth: { year: number; month: number; count: number } | null;
  /** 一番早い実施時刻(4 時より前は夜ふかしとして数えない) */
  earliest: { hour: number; minute: number; date: string; habit: Habit } | null;
  /** 今一番続いている習慣 */
  liveStreak: { days: number; habit: Habit } | null;
}

export function personalBests(ctx: AchievementContext): PersonalBests {
  let longestStreak: PersonalBests['longestStreak'] = null;
  let liveStreak: PersonalBests['liveStreak'] = null;
  for (const h of ctx.habits) {
    for (const r of h.runs) {
      if (!longestStreak || r.len > longestStreak.days) longestStreak = { days: r.len, habit: h.habit, start: r.start, end: r.end };
    }
    if (h.currentStreak > 0 && (!liveStreak || h.currentStreak > liveStreak.days)) liveStreak = { days: h.currentStreak, habit: h.habit };
  }

  const byMonth = new Map<string, number>();
  for (const ds of ctx.allCompletionDates) byMonth.set(ds.slice(0, 7), (byMonth.get(ds.slice(0, 7)) ?? 0) + 1);
  let bestMonth: PersonalBests['bestMonth'] = null;
  for (const [ym, count] of byMonth) {
    if (!bestMonth || count > bestMonth.count) bestMonth = { year: Number(ym.slice(0, 4)), month: Number(ym.slice(5, 7)), count };
  }

  let earliest: PersonalBests['earliest'] = null;
  const habitOf = new Map(ctx.habits.map(h => [h.habit.id, h.habit]));
  for (const t of ctx.timed) {
    if (t.hour < 4) continue;
    const habit = habitOf.get(t.habitId);
    if (!habit) continue;
    if (!earliest || t.hour * 60 + t.minute < earliest.hour * 60 + earliest.minute) earliest = { hour: t.hour, minute: t.minute, date: t.date, habit };
  }

  return { longestStreak, bestMonth, earliest, liveStreak };
}
