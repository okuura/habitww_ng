import type { Habit } from './supabase';
import type { AchievementContext, EvaluatedAchievement } from './achievements';

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

// --- 月のふりかえり -----------------------------------------------------------

export interface MonthlyReview {
  year: number;
  month: number;
  total: number;
  /** 何かしら実施した日数 */
  activeDays: number;
  monthDays: number;
  /** 前の月との差(前の月に記録が無ければ null) */
  diffFromPrev: number | null;
  best: { habit: Habit; count: number; rate: number; longestRun: number } | null;
  /** その月に取ったバッジ */
  badges: EvaluatedAchievement[];
  /** 一番多く実施した曜日(0=日曜) */
  topWeekday: { day: number; count: number } | null;
}

const pad = (n: number) => String(n).padStart(2, '0');

export function monthlyReview(ctx: AchievementContext, evaluated: EvaluatedAchievement[], year: number, month: number): MonthlyReview {
  const prefix = `${year}-${pad(month)}`;
  const prev = new Date(year, month - 2, 1);
  const prevPrefix = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;
  const monthDays = new Date(year, month, 0).getDate();

  const inMonth = ctx.allCompletionDates.filter(d => d.startsWith(prefix));
  const prevCount = ctx.allCompletionDates.filter(d => d.startsWith(prevPrefix)).length;

  const weekdays = Array(7).fill(0);
  for (const d of inMonth) weekdays[new Date(d + 'T00:00:00').getDay()]++;
  const topDay = weekdays.indexOf(Math.max(...weekdays));

  let best: MonthlyReview['best'] = null;
  for (const h of ctx.habits) {
    const dates = h.dates.filter(d => d.startsWith(prefix));
    if (dates.length === 0) continue;
    // 月の途中で作った習慣は作った日から数える
    const created = new Date(h.habit.created_at);
    const from = created.getFullYear() === year && created.getMonth() + 1 === month ? created.getDate() : 1;
    const rate = dates.length / (monthDays - from + 1);
    let longestRun = 0;
    let run = 0;
    for (let i = 0; i < dates.length; i++) {
      run = i > 0 && Number(dates[i].slice(8)) === Number(dates[i - 1].slice(8)) + 1 ? run + 1 : 1;
      longestRun = Math.max(longestRun, run);
    }
    if (!best || dates.length > best.count || (dates.length === best.count && rate > best.rate)) {
      best = { habit: h.habit, count: dates.length, rate: Math.min(1, rate), longestRun };
    }
  }

  return {
    year, month, monthDays,
    total: inMonth.length,
    activeDays: new Set(inMonth).size,
    diffFromPrev: prevCount > 0 ? inMonth.length - prevCount : null,
    best,
    badges: evaluated.filter(a => a.state.earned && a.state.earnedDate?.startsWith(prefix)),
    topWeekday: inMonth.length > 0 ? { day: topDay, count: weekdays[topDay] } : null,
  };
}
