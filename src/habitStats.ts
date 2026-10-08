import type { Habit, HabitCompletion } from './supabase';

// 習慣ごとのバッジ・統計・レアリティの計算(UI を持たない純粋な関数)。
// 統計画面(Badges)と習慣カードの裏面で共有する

export function toLocalDateString(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export interface MonthBadge {
  year: number;
  month: number; // 1-12
}

export interface HabitBadges {
  habit: Habit;
  perfectMonths: MonthBadge[];
  /** Current month is still unbroken — days left until the badge */
  ongoingDaysLeft: number | null;
  currentStreak: number;
  bestStreak: number;
}

export function computeHabitBadges(habit: Habit, dates: Set<string>, today: Date): HabitBadges {
  const todayStr = toLocalDateString(today);

  const created = new Date(habit.created_at);
  created.setHours(0, 0, 0, 0);

  const perfectMonths: MonthBadge[] = [];
  let ongoingDaysLeft: number | null = null;

  const cursor = new Date(created.getFullYear(), created.getMonth(), 1);
  while (cursor.getFullYear() < today.getFullYear()
    || (cursor.getFullYear() === today.getFullYear() && cursor.getMonth() <= today.getMonth())) {
    const y = cursor.getFullYear();
    const m = cursor.getMonth();
    const monthEnd = new Date(y, m + 1, 0); // last day of month
    const isCurrentMonth = y === today.getFullYear() && m === today.getMonth();

    // Strict rule: every single day of the calendar month must be done.
    // A month the habit was created mid-way can never earn the medal.
    if (created > cursor) {
      cursor.setMonth(cursor.getMonth() + 1);
      continue;
    }

    const judgeStart = cursor;
    const judgeEnd = isCurrentMonth ? today : monthEnd;

    let perfect = judgeStart <= judgeEnd;
    for (const d = new Date(judgeStart); d <= judgeEnd; d.setDate(d.getDate() + 1)) {
      if (!dates.has(toLocalDateString(d))) { perfect = false; break; }
    }
    // Today itself may simply not be done yet — don't break the run for that
    if (isCurrentMonth && !perfect) {
      let perfectUntilYesterday = judgeStart < judgeEnd;
      for (const d = new Date(judgeStart); d < judgeEnd; d.setDate(d.getDate() + 1)) {
        if (!dates.has(toLocalDateString(d))) { perfectUntilYesterday = false; break; }
      }
      perfect = perfectUntilYesterday;
    }

    if (perfect) {
      if (isCurrentMonth) {
        if (judgeEnd < monthEnd || !dates.has(todayStr)) {
          ongoingDaysLeft = Math.max(
            Math.round((monthEnd.getTime() - today.getTime()) / 86400000)
              + (dates.has(todayStr) ? 0 : 1),
            1,
          );
        } else {
          perfectMonths.push({ year: y, month: m + 1 }); // last day done — badge earned
        }
      } else {
        perfectMonths.push({ year: y, month: m + 1 });
      }
    }

    cursor.setMonth(cursor.getMonth() + 1);
  }

  // Streaks: current (ending today or yesterday) and all-time best
  const sortedDates = [...dates].sort();
  let bestStreak = 0;
  let run = 0;
  let prev: string | null = null;
  for (const ds of sortedDates) {
    if (prev !== null) {
      const p = new Date(prev + 'T00:00:00');
      p.setDate(p.getDate() + 1);
      run = toLocalDateString(p) === ds ? run + 1 : 1;
    } else {
      run = 1;
    }
    if (run > bestStreak) bestStreak = run;
    prev = ds;
  }

  let currentStreak = 0;
  const cur = new Date(today);
  if (!dates.has(toLocalDateString(cur))) cur.setDate(cur.getDate() - 1); // today not done yet is OK
  while (dates.has(toLocalDateString(cur))) {
    currentStreak++;
    cur.setDate(cur.getDate() - 1);
  }

  return { habit, perfectMonths, ongoingDaysLeft, currentStreak, bestStreak };
}

// --- レアリティ(累計日数でカードの格が上がる) ----------------------------------

export type Rarity = 'normal' | 'silver' | 'gold' | 'holo';

export const RARITY_TIERS: { rarity: Rarity; min: number; label: string }[] = [
  { rarity: 'normal', min: 0, label: 'ノーマル' },
  { rarity: 'silver', min: 30, label: 'シルバー' },
  { rarity: 'gold', min: 100, label: 'ゴールド' },
  { rarity: 'holo', min: 365, label: 'ホロ' },
];

export interface RarityInfo {
  rarity: Rarity;
  label: string;
  /** 次のレアリティ(最上位なら null) */
  next: { rarity: Rarity; label: string; min: number } | null;
  daysToNext: number | null;
  /** 今のレアリティの中での進み具合 0..1(最上位は 1) */
  progress: number;
}

export function rarityOf(totalDays: number): RarityInfo {
  let i = 0;
  while (i + 1 < RARITY_TIERS.length && totalDays >= RARITY_TIERS[i + 1].min) i++;
  const tier = RARITY_TIERS[i];
  const next = RARITY_TIERS[i + 1] ?? null;
  return {
    rarity: tier.rarity,
    label: tier.label,
    next,
    daysToNext: next ? next.min - totalDays : null,
    progress: next ? (totalDays - tier.min) / (next.min - tier.min) : 1,
  };
}

// --- 習慣ごとの統計(カード裏面) ----------------------------------------------

/** 1 習慣ぶんの累計の節目(全体用の TOTAL_MILESTONES より細かく刻む) */
export const HABIT_MILESTONES = [10, 30, 50, 100, 200, 365, 500, 1000];

export interface HabitStats {
  startDate: Date;
  /** 始めた日を 1 日目として今日まで何日目か */
  daysSinceStart: number;
  totalDays: number;
  /** 今月の達成率 0..1(数える日がまだ無ければ null) */
  monthRate: number | null;
  monthDone: number;
  monthDays: number;
  /** 達成日のうち「ばっちり」の割合 0..1(未達成なら null) */
  bacchiriRate: number | null;
  /** 疾風迅雷(実施時間どおり)の回数 */
  onTimeCount: number;
  currentStreak: number;
  bestStreak: number;
  /** 曜日別の達成回数(0=日曜) */
  weekdayCounts: number[];
}

/** completions はこの習慣のものだけを渡す */
export function habitStats(habit: Habit, completions: HabitCompletion[], today: Date): HabitStats {
  const day = new Date(today);
  day.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateString(day);
  const dates = new Set(completions.map(c => c.completed_date));

  const startDate = new Date(habit.created_at);
  startDate.setHours(0, 0, 0, 0);
  const daysSinceStart = Math.max(1, Math.round((day.getTime() - startDate.getTime()) / 86400000) + 1);

  // 今月: 月初(今月作った習慣は作成日)から昨日まで + 今日は達成済みなら数える(朝に率が下がらないように)
  const monthStart = new Date(day.getFullYear(), day.getMonth(), 1);
  const from = startDate > monthStart ? startDate : monthStart;
  let monthDays = 0;
  let monthDone = 0;
  for (const d = new Date(from); d < day; d.setDate(d.getDate() + 1)) {
    monthDays++;
    if (dates.has(toLocalDateString(d))) monthDone++;
  }
  if (dates.has(todayStr)) { monthDays++; monthDone++; }

  const bacchiri = completions.filter(c => c.intensity >= 2).length;
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  for (const ds of dates) weekdayCounts[new Date(ds + 'T00:00:00').getDay()]++;

  const { currentStreak, bestStreak } = computeHabitBadges(habit, dates, day);

  return {
    startDate,
    daysSinceStart,
    totalDays: dates.size,
    monthRate: monthDays > 0 ? monthDone / monthDays : null,
    monthDone,
    monthDays,
    bacchiriRate: dates.size > 0 ? bacchiri / dates.size : null,
    onTimeCount: completions.filter(c => c.on_time).length,
    currentStreak,
    bestStreak,
    weekdayCounts,
  };
}
