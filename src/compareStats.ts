import type { Habit } from './supabase';
import { addDays, daysBetween, parse, type AchievementContext } from './achievements';
import { clock, habitTimeProfiles } from './timeStats';

// 習慣くらべ(対決表)の数値。UI を持たない純粋な関数

export interface HabitCompare {
  habit: Habit;
  /** 今月の達成率 0..1(数える日がまだ無ければ null) */
  monthRate: number | null;
  /** 直近 28 日の回数 − その前 28 日の回数(作成から 35 日未満なら null) */
  momentum: number | null;
  /** 抜けたあと戻るまでの平均日数(隙間が 2 つ未満なら null) */
  recovery: number | null;
  /** 直近 8 週の週ごとの回数のムラ: 1..3(多いほど安定。作成から 21 日未満なら null) */
  stability: 1 | 2 | 3 | null;
  /** 一番続く曜日・一番抜ける曜日(0=日曜。差が小さい・期間が短いときは null) */
  bestWeekday: number | null;
  worstWeekday: number | null;
  /** 平均の実施時刻 "21:40"(記録 3 回未満は null) */
  meanTime: string | null;
}

/** 王冠を付ける行と、その向き(高いほど良い / 低いほど良い) */
export const CROWN_ROWS: { key: 'monthRate' | 'momentum' | 'recovery' | 'stability'; higherIsBetter: boolean }[] = [
  { key: 'monthRate', higherIsBetter: true },
  { key: 'momentum', higherIsBetter: true },
  { key: 'recovery', higherIsBetter: false },
  { key: 'stability', higherIsBetter: true },
];

const createdOf = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const mondayOf = (ds: string) => addDays(ds, -((parse(ds).getDay() + 6) % 7));

export function compareHabits(ctx: AchievementContext): HabitCompare[] {
  const today = ctx.todayStr;
  const yesterday = addDays(today, -1);
  const monthStart = today.slice(0, 8) + '01';
  const times = new Map(habitTimeProfiles(ctx, null).map(p => [p.habit.id, p]));
  const thisMonday = mondayOf(today);

  return ctx.habits.map(h => {
    const created = createdOf(h.habit.created_at);
    const age = daysBetween(created, today) + 1;

    // 今月(月初か作成日から昨日まで。今日は達成済みなら数える)
    let monthDays = 0;
    let monthDone = 0;
    for (let ds = created > monthStart ? created : monthStart; ds <= yesterday; ds = addDays(ds, 1)) {
      monthDays++;
      if (h.set.has(ds)) monthDone++;
    }
    if (h.set.has(today)) { monthDays++; monthDone++; }

    // 勢い
    const recentFrom = addDays(today, -27);
    const prevFrom = addDays(today, -55);
    const recent = h.dates.filter(d => d >= recentFrom).length;
    const prev = h.dates.filter(d => d >= prevFrom && d < recentFrom).length;
    const momentum = age >= 35 ? recent - prev : null;

    // 復帰の早さ(今続いている隙間は含めない)
    const gaps: number[] = [];
    for (let i = 1; i < h.runs.length; i++) gaps.push(daysBetween(h.runs[i - 1].end, h.runs[i].start) - 1);
    const recovery = gaps.length >= 2 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : null;

    // 安定度(今週を除く直近 8 週。習慣が始まる前の週は数えない)
    let stability: HabitCompare['stability'] = null;
    if (age >= 21) {
      const counts: number[] = [];
      for (let i = 8; i >= 1; i--) {
        const week = addDays(thisMonday, -7 * i);
        if (addDays(week, 6) < created) continue;
        counts.push(h.dates.filter(d => d >= week && d < addDays(week, 7)).length);
      }
      const mean = counts.reduce((a, b) => a + b, 0) / counts.length;
      const sd = Math.sqrt(counts.reduce((a, c) => a + (c - mean) ** 2, 0) / counts.length);
      // 1 回もしていない期間の「ムラがない」は安定とは呼ばない
      if (mean > 0) stability = sd <= 0.7 ? 3 : sd <= 1.5 ? 2 : 1;
    }

    // 得意・苦手な曜日
    let bestWeekday: number | null = null;
    let worstWeekday: number | null = null;
    if (daysBetween(created, yesterday) + 1 >= 14) {
      const chances = Array(7).fill(0) as number[];
      const done = Array(7).fill(0) as number[];
      for (let ds = created; ds <= yesterday; ds = addDays(ds, 1)) {
        const w = parse(ds).getDay();
        chances[w]++;
        if (h.set.has(ds)) done[w]++;
      }
      const rates = chances.map((c, i) => (c > 0 ? done[i] / c : 0));
      const hi = rates.indexOf(Math.max(...rates));
      const lo = rates.indexOf(Math.min(...rates));
      if (rates[hi] - rates[lo] >= 0.1) { bestWeekday = hi; worstWeekday = lo; }
    }

    const profile = times.get(h.habit.id);
    return {
      habit: h.habit,
      monthRate: monthDays > 0 ? monthDone / monthDays : null,
      momentum,
      recovery,
      stability,
      bestWeekday,
      worstWeekday,
      meanTime: profile && profile.count >= 3 && profile.mean !== null ? clock(profile.mean) : null,
    };
  });
}

/** 各行で一番の習慣の id(値のある習慣が 2 つ以上で、1 位が単独のときだけ) */
export function crowns(rows: HabitCompare[]): Partial<Record<(typeof CROWN_ROWS)[number]['key'], string>> {
  const out: Partial<Record<(typeof CROWN_ROWS)[number]['key'], string>> = {};
  for (const { key, higherIsBetter } of CROWN_ROWS) {
    const valued = rows.filter(r => r[key] !== null);
    if (valued.length < 2) continue;
    const sorted = [...valued].sort((a, b) => (higherIsBetter ? b[key]! - a[key]! : a[key]! - b[key]!));
    if (sorted[0][key] !== sorted[1][key]) out[key] = sorted[0].habit.id;
  }
  return out;
}
