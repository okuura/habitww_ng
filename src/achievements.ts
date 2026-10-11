import type { Habit, HabitCompletion } from './supabase';
import { computeHabitBadges, rarityOf, RARITY_TIERS, toLocalDateString, type MonthBadge } from './habitStats';

// 統計ページのバッジ図鑑と「もうすぐ取れる」の計算(UI を持たない純粋な関数)。
// どのバッジも過去の記録から判定するので、機能を入れる前の分も遡って取れる

// --- 日付の小道具 -------------------------------------------------------------

export const parse = (ds: string) => new Date(ds + 'T00:00:00');
export const addDays = (ds: string, n: number) => {
  const d = parse(ds);
  d.setDate(d.getDate() + n);
  return toLocalDateString(d);
};
export const daysBetween = (a: string, b: string) => Math.round((parse(b).getTime() - parse(a).getTime()) / 86400000);

/** 並べた日付の n 番目(1 始まり)。届いていなければ undefined */
const nth = (sorted: string[], n: number) => sorted[n - 1];

interface Run { start: string; end: string; len: number }

/** 並べた(重複なしの)日付を、連続した区間に分ける */
function runsOf(sorted: string[]): Run[] {
  const runs: Run[] = [];
  for (const ds of sorted) {
    const last = runs[runs.length - 1];
    if (last && addDays(last.end, 1) === ds) { last.end = ds; last.len++; } else runs.push({ start: ds, end: ds, len: 1 });
  }
  return runs;
}

// --- 計算の材料(1 回だけ作る) --------------------------------------------------

export interface HabitData {
  habit: Habit;
  /** 実施した日(重複なし・昇順) */
  dates: string[];
  set: Set<string>;
  runs: Run[];
  /** ばっちり達成した日(重複なし・昇順) */
  bacchiri: string[];
  /** 今の連続(今日か昨日で終わっている区間) */
  currentStreak: number;
  perfectMonths: MonthBadge[];
  /** 今月がまだ途切れていなければ、メダルまでの残り日数 */
  ongoingDaysLeft: number | null;
  doneToday: boolean;
}

export interface AchievementContext {
  today: Date;
  todayStr: string;
  habits: HabitData[];
  /** 全記録の日付(1 記録 1 件・昇順) */
  allCompletionDates: string[];
  onTimeDates: string[];
  bacchiriDates: string[];
  /** あとから付けた記録を除いた実施時刻(その日のうちに付けた記録だけ) */
  timed: { habitId: string; date: string; hour: number; minute: number }[];
  /** その日にある習慣を全部実施した日(昇順) */
  perfectDays: string[];
  /** 月間パーフェクトの月末日(昇順)と月 */
  perfectMonthEnds: { date: string; month: number }[];
}

export function buildContext(habits: Habit[], completions: HabitCompletion[], now = new Date()): AchievementContext {
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const todayStr = toLocalDateString(today);

  const byHabit = new Map<string, HabitCompletion[]>();
  for (const c of completions) {
    const list = byHabit.get(c.habit_id);
    if (list) list.push(c); else byHabit.set(c.habit_id, [c]);
  }

  const data: HabitData[] = habits.map(habit => {
    const comps = byHabit.get(habit.id) ?? [];
    const set = new Set(comps.map(c => c.completed_date));
    const dates = [...set].sort();
    const badges = computeHabitBadges(habit, set, today);
    return {
      habit, dates, set, runs: runsOf(dates),
      bacchiri: [...new Set(comps.filter(c => c.intensity >= 2).map(c => c.completed_date))].sort(),
      currentStreak: badges.currentStreak,
      perfectMonths: badges.perfectMonths,
      ongoingDaysLeft: badges.ongoingDaysLeft,
      doneToday: set.has(todayStr),
    };
  });

  const own = new Set(habits.map(h => h.id));
  const mine = completions.filter(c => own.has(c.habit_id));

  const timed: AchievementContext['timed'] = [];
  for (const c of mine) {
    const at = new Date(c.created_at);
    if (Number.isNaN(at.getTime()) || toLocalDateString(at) !== c.completed_date) continue;
    timed.push({ habitId: c.habit_id, date: c.completed_date, hour: at.getHours(), minute: at.getMinutes() });
  }
  timed.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));

  // パーフェクトデイ: その日までに作られていた習慣を全部実施した日
  const created = data.map(h => toLocalDateString(new Date(h.habit.created_at)));
  const days = new Set(mine.map(c => c.completed_date));
  const perfectDays = [...days].sort().filter(ds => {
    let existing = 0;
    for (let i = 0; i < data.length; i++) {
      if (created[i] > ds) continue;
      existing++;
      if (!data[i].set.has(ds)) return false;
    }
    return existing > 0;
  });

  const perfectMonthEnds = data
    .flatMap(h => h.perfectMonths)
    .map(m => ({ date: toLocalDateString(new Date(m.year, m.month, 0)), month: m.month }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  const sortedDates = (list: HabitCompletion[]) => list.map(c => c.completed_date).sort();
  return {
    today, todayStr, habits: data,
    allCompletionDates: sortedDates(mine),
    onTimeDates: sortedDates(mine.filter(c => c.on_time)),
    bacchiriDates: sortedDates(mine.filter(c => c.intensity >= 2)),
    timed, perfectDays, perfectMonthEnds,
  };
}

// --- バッジの定義 ---------------------------------------------------------------

export type Tier = 'bronze' | 'silver' | 'gold' | 'platinum';

export const TIER_LABEL: Record<Tier, string> = { bronze: 'ブロンズ', silver: 'シルバー', gold: 'ゴールド', platinum: 'プラチナ' };

export interface AchievementState {
  earned: boolean;
  /** 条件を満たした日(YYYY-MM-DD) */
  earnedDate?: string;
  /** 進み具合(数で数えられるバッジだけ) */
  current?: number;
  target?: number;
  /** どの習慣で一番進んでいるか */
  habit?: Habit;
}

export type AchievementCategory =
  | 'streak' | 'total' | 'rank' | 'month' | 'season' | 'perfectDay' | 'onTime' | 'bacchiri'
  | 'time' | 'comeback' | 'anniversary' | 'collector' | 'secret';

export const CATEGORY_LABEL: Record<AchievementCategory, string> = {
  streak: '連続',
  total: '累計',
  rank: 'カードランク',
  month: '月間パーフェクト',
  season: '四季',
  perfectDay: 'パーフェクトデイ',
  onTime: '疾風迅雷',
  bacchiri: 'ばっちり',
  time: '時間帯',
  comeback: '粘り強さ',
  anniversary: '記念日',
  collector: 'コレクター',
  secret: 'ひみつ',
};

export interface Achievement {
  id: string;
  category: AchievementCategory;
  name: string;
  /** 取り方(未取得のときにも見せる) */
  hint: string;
  /** 取るまで名前も取り方も伏せる */
  hidden?: boolean;
  /** バッジの絵の種類(UI 側で絵に変える) */
  icon: string;
  /** バッジに刻む短い文字(例: 7日) */
  mark?: string;
  /** 難しさ。バッジの金属が変わる(銅→銀→金→プラチナ) */
  tier: Tier;
  evaluate: (ctx: AchievementContext) => AchievementState;
}

/** 数え上げるバッジ: 並べた日付の n 番目に届いた日に取得 */
const counted = (sorted: string[], target: number): AchievementState => {
  const date = nth(sorted, target);
  return { earned: !!date, earnedDate: date, current: Math.min(sorted.length, target), target };
};

/** 一番進んでいる習慣を返す */
const best = (ctx: AchievementContext, score: (h: HabitData) => number) =>
  ctx.habits.reduce<HabitData | undefined>((b, h) => (!b || score(h) > score(b) ? h : b), undefined);

const earliest = (dates: (string | undefined)[]) => dates.filter((d): d is string => !!d).sort()[0];

const streak = (n: number, name: string, tier: Tier): Achievement => ({
  id: `streak-${n}`, category: 'streak', name, tier, icon: 'fire', mark: `${n}日`,
  hint: `どれかの習慣を${n}日連続で実施する`,
  evaluate: ctx => {
    const date = earliest(ctx.habits.flatMap(h => h.runs.filter(r => r.len >= n).map(r => addDays(r.start, n - 1))));
    const top = best(ctx, h => h.currentStreak);
    return { earned: !!date, earnedDate: date, current: Math.min(top?.currentStreak ?? 0, n), target: n, habit: top?.habit };
  },
});

const total = (n: number, name: string, tier: Tier): Achievement => ({
  id: `total-${n}`, category: 'total', name, tier, icon: 'trophy', mark: `${n}`,
  hint: `すべての習慣をあわせて${n}回実施する`,
  evaluate: ctx => counted(ctx.allCompletionDates, n),
});

const rank = (rarity: 'bronze' | 'silver' | 'gold' | 'holo', name: string, tier: Tier): Achievement => {
  const card = RARITY_TIERS.find(t => t.rarity === rarity)!;
  return {
    id: `rank-${rarity}`, category: 'rank', name, tier, icon: `rank-${rarity}`,
    hint: `どれかの習慣を累計${card.min}日実施して、カードを${card.label}にする`,
    evaluate: ctx => {
      const date = earliest(ctx.habits.map(h => nth(h.dates, card.min)));
      const top = best(ctx, h => h.dates.length);
      return { earned: !!date, earnedDate: date, current: Math.min(top?.dates.length ?? 0, card.min), target: card.min, habit: top?.habit };
    },
  };
};

const months = (n: number, name: string, tier: Tier): Achievement => ({
  id: `month-${n}`, category: 'month', name, tier, icon: 'calendar', mark: `${n}`,
  hint: n === 1 ? 'どれかの習慣を、ある月の1日から末日まで毎日実施する' : `月間パーフェクトを${n}回取る(習慣ごとに数える)`,
  evaluate: ctx => counted(ctx.perfectMonthEnds.map(m => m.date), n),
});

const season = (id: string, name: string, icon: string, monthsIn: number[], label: string): Achievement => ({
  id: `season-${id}`, category: 'season', name, icon, tier: 'gold',
  hint: `${label}(${monthsIn.join('・')}月)に月間パーフェクトを取る`,
  evaluate: ctx => {
    const hit = ctx.perfectMonthEnds.find(m => monthsIn.includes(m.month));
    return { earned: !!hit, earnedDate: hit?.date };
  },
});

const perfectDay = (n: number, name: string, tier: Tier): Achievement => ({
  id: `perfect-day-${n}`, category: 'perfectDay', name, tier, icon: 'check', mark: n > 1 ? `${n}` : undefined,
  hint: n === 1 ? 'その日にある習慣を全部実施する' : `その日にある習慣を全部実施した日を${n}日つくる`,
  evaluate: ctx => counted(ctx.perfectDays, n),
});

const onTime = (n: number, name: string, tier: Tier): Achievement => ({
  id: `on-time-${n}`, category: 'onTime', name, tier, icon: 'bolt', mark: `${n}`,
  hint: `実施時間から10分以内の実施(疾風迅雷)を${n}回する`,
  evaluate: ctx => counted(ctx.onTimeDates, n),
});

const bacchiri = (n: number, name: string, tier: Tier): Achievement => ({
  id: `bacchiri-${n}`, category: 'bacchiri', name, tier, icon: 'sparkle', mark: `${n}`,
  hint: `「ばっちり達成」を${n}回する`,
  evaluate: ctx => counted(ctx.bacchiriDates, n),
});

const timeOfDay = (id: string, name: string, icon: string, hint: string, n: number, match: (h: number, m: number) => boolean, tier: Tier, hidden = false): Achievement => ({
  id: `time-${id}`, category: hidden ? 'secret' : 'time', name, icon, hint, hidden, tier, mark: n > 1 ? `${n}` : undefined,
  evaluate: ctx => counted(ctx.timed.filter(t => match(t.hour, t.minute)).map(t => t.date), n),
});

const anniversary = (n: number, name: string, tier: Tier): Achievement => ({
  id: `anniversary-${n}`, category: 'anniversary', name, tier, icon: 'cake', mark: n === 365 ? '1年' : `${n}日`,
  hint: n === 365 ? '習慣を始めてから1年たつ' : `習慣を始めてから${n}日たつ`,
  evaluate: ctx => {
    const oldest = ctx.habits.map(h => toLocalDateString(new Date(h.habit.created_at))).sort()[0];
    if (!oldest) return { earned: false, current: 0, target: n };
    const age = daysBetween(oldest, ctx.todayStr);
    return { earned: age >= n, earnedDate: age >= n ? addDays(oldest, n) : undefined, current: Math.min(age, n), target: n };
  },
});

const collector = (n: number, name: string, tier: Tier): Achievement => ({
  id: `collector-${n}`, category: 'collector', name, tier, icon: 'collection', mark: `${n}`,
  hint: `習慣を${n}つ持つ`,
  evaluate: ctx => counted(ctx.habits.map(h => toLocalDateString(new Date(h.habit.created_at))).sort(), n),
});

const onDate = (id: string, name: string, icon: string, hint: string, mmdd: string): Achievement => ({
  id, category: 'secret', name, icon, hint, hidden: true, tier: 'silver',
  evaluate: ctx => {
    const date = ctx.allCompletionDates.find(d => d.endsWith(mmdd));
    return { earned: !!date, earnedDate: date };
  },
});

export const ACHIEVEMENTS: Achievement[] = [
  streak(3, '三日坊主卒業', 'bronze'),
  streak(7, '一週間', 'bronze'),
  streak(21, '習慣の芽', 'silver'),
  streak(30, 'ひと月皆勤', 'silver'),
  streak(66, '習慣化', 'gold'),
  streak(100, '百日行', 'gold'),
  streak(365, '一年皆勤', 'platinum'),

  total(10, 'はじめの一歩', 'bronze'),
  total(50, '積み上げ', 'bronze'),
  total(100, '百回達成', 'silver'),
  total(250, '継続は力', 'silver'),
  total(500, '五百の足跡', 'gold'),
  total(1000, '千里の道', 'platinum'),

  rank('bronze', 'ブロンズカード', 'bronze'),
  rank('silver', 'シルバーカード', 'silver'),
  rank('gold', 'ゴールドカード', 'gold'),
  rank('holo', 'ホロカード', 'platinum'),

  months(1, '完璧な一か月', 'silver'),
  months(3, '三つのメダル', 'gold'),
  months(12, 'メダル十二枚', 'platinum'),

  season('spring', '春の皆勤', 'spring', [3, 4, 5], '春'),
  season('summer', '夏の皆勤', 'summer', [6, 7, 8], '夏'),
  season('autumn', '秋の皆勤', 'autumn', [9, 10, 11], '秋'),
  season('winter', '冬の皆勤', 'winter', [12, 1, 2], '冬'),

  perfectDay(1, 'パーフェクトデイ', 'bronze'),
  perfectDay(10, '完璧な十日', 'silver'),
  perfectDay(50, '完璧な五十日', 'gold'),

  onTime(10, '疾風', 'bronze'),
  onTime(50, '迅雷', 'silver'),
  onTime(100, '疾風迅雷', 'gold'),

  bacchiri(10, 'ばっちり', 'bronze'),
  bacchiri(50, 'ばっちりの達人', 'silver'),
  {
    id: 'bacchiri-streak-7', category: 'bacchiri', name: 'ばっちり一週間', icon: 'sparkle', mark: '7日', tier: 'gold',
    hint: 'どれかの習慣で「ばっちり達成」を7日続ける',
    evaluate: ctx => bacchiriStreak(ctx, 7),
  },

  timeOfDay('early', '早起き', 'sunrise', '4時〜6時前に10回実施する', 10, h => h >= 4 && h < 6, 'silver'),
  timeOfDay('night', '夜ふかし', 'moon', '23時〜翌3時前に10回実施する', 10, h => h === 23 || h < 3, 'silver'),

  {
    id: 'comeback', category: 'comeback', name: '復活', icon: 'comeback', tier: 'silver',
    hint: '3日以上あいたあとに再開して、そこから7日続ける',
    evaluate: ctx => {
      const dates = ctx.habits.flatMap(h => h.runs
        .filter((r, i) => i > 0 && daysBetween(h.runs[i - 1].end, r.start) >= 4 && r.len >= 7)
        .map(r => addDays(r.start, 6)));
      const date = earliest(dates);
      // 進み具合: 3日以上あいたあとの、今続いている区間
      const resumed = ctx.habits
        .map(h => {
          const i = h.runs.length - 1;
          const r = h.runs[i];
          const live = r && daysBetween(r.end, ctx.todayStr) <= 1;
          return live && i > 0 && daysBetween(h.runs[i - 1].end, r.start) >= 4 ? { h, len: r.len } : null;
        })
        .filter(x => !!x)
        .sort((a, b) => b.len - a.len)[0];
      return { earned: !!date, earnedDate: date, current: Math.min(resumed?.len ?? 0, 7), target: 7, habit: resumed?.h.habit };
    },
  },
  {
    id: 'weekend', category: 'comeback', name: '週末も休まない', icon: 'weekend', mark: '4', tier: 'bronze',
    hint: '土曜と日曜の両方に実施した週末を4回つくる',
    evaluate: ctx => {
      const sundays = new Set<string>();
      for (const h of ctx.habits) {
        for (const ds of h.dates) {
          if (parse(ds).getDay() === 6 && h.set.has(addDays(ds, 1))) sundays.add(addDays(ds, 1));
        }
      }
      return counted([...sundays].sort(), 4);
    },
  },

  anniversary(100, '百日記念', 'silver'),
  anniversary(365, '一周年', 'gold'),

  collector(3, '三つの習慣', 'bronze'),
  collector(5, '五つの習慣', 'silver'),

  timeOfDay('zorome', 'ゾロ目', 'clock', '11:11 か 22:22 ちょうどに実施する', 1, (h, m) => (h === 11 && m === 11) || (h === 22 && m === 22), 'gold', true),
  timeOfDay('midnight', '日付が変わる瞬間', 'clock', '0:00 ちょうどに実施する', 1, (h, m) => h === 0 && m === 0, 'gold', true),
  onDate('new-year', '元日', 'party', '1月1日に実施する', '-01-01'),
  onDate('new-years-eve', '大晦日', 'moon', '12月31日に実施する', '-12-31'),
];

/** ばっちり達成が n 日続いた最初の日と、今続いている日数 */
function bacchiriStreak(ctx: AchievementContext, n: number): AchievementState {
  let date: string | undefined;
  let current = 0;
  let habit: Habit | undefined;
  for (const h of ctx.habits) {
    const runs = runsOf(h.bacchiri);
    const hit = runs.find(r => r.len >= n);
    if (hit) {
      const d = addDays(hit.start, n - 1);
      if (!date || d < date) date = d;
    }
    const last = runs[runs.length - 1];
    if (last && daysBetween(last.end, ctx.todayStr) <= 1 && last.len > current) { current = last.len; habit = h.habit; }
  }
  return { earned: !!date, earnedDate: date, current: Math.min(current, n), target: n, habit };
}

export interface EvaluatedAchievement extends Achievement {
  state: AchievementState;
}

export function evaluateAll(ctx: AchievementContext): EvaluatedAchievement[] {
  return ACHIEVEMENTS.map(a => ({ ...a, state: a.evaluate(ctx) }));
}

// --- もうすぐ取れる -------------------------------------------------------------

export interface NearGoal {
  id: string;
  title: string;
  /** 残りの説明(例: あと2日) */
  remaining: number;
  unit: string;
  progress: number;
  icon: string;
  category: AchievementCategory;
  tier: Tier;
  mark?: string;
  habit?: Habit;
  /** 今日実施すれば届く */
  today: boolean;
}

const RANK_TIER: Record<string, Tier> = { bronze: 'bronze', silver: 'silver', gold: 'gold', holo: 'platinum' };

/** 今日の実施で 1 つ進むバッジ(時間がたつだけで進むものは除く) */
const DAILY: AchievementCategory[] = ['streak', 'total', 'perfectDay', 'comeback', 'rank'];
/** 「あと N日」と数えるバッジ(ほかは「あと N回」) */
const DAY_UNIT: AchievementCategory[] = ['streak', 'perfectDay', 'comeback', 'anniversary'];

export function nearGoals(ctx: AchievementContext, evaluated: EvaluatedAchievement[], limit = 3): NearGoal[] {
  const open = ctx.habits.some(h => !h.doneToday);
  const goals: NearGoal[] = [];

  for (const a of evaluated) {
    const { earned, current, target, habit } = a.state;
    // カードランクと月間パーフェクトは、習慣ごとに下で出す(月の途中から「あと1回」とは言えない)
    // 習慣を増やすだけのバッジは、目標として勧めない
    if (earned || a.hidden || a.category === 'rank' || a.category === 'month' || a.category === 'collector' || current === undefined || !target) continue;
    const left = target - current;
    // あと 3 以内か、8 割まで来ていてあと 10 以内
    if (left <= 0 || (left > 3 && (current / target < 0.8 || left > 10))) continue;
    const helpsToday = left === 1 && open && DAILY.includes(a.category)
      && (!habit || !ctx.habits.find(h => h.habit.id === habit.id)?.doneToday);
    goals.push({
      id: a.id, title: `「${a.name}」バッジ`, remaining: left,
      unit: DAY_UNIT.includes(a.category) ? '日' : '回',
      progress: current / target, icon: a.icon, category: a.category, tier: a.tier, mark: a.mark, habit, today: helpsToday,
    });
  }

  for (const h of ctx.habits) {
    const r = rarityOf(h.dates.length);
    if (r.next && r.daysToNext !== null && r.daysToNext <= 5) {
      goals.push({
        id: `rank-${h.habit.id}`, title: `${r.next.label}カード`, remaining: r.daysToNext, unit: '日',
        progress: r.progress, icon: `rank-${r.next.rarity}`, category: 'rank', tier: RANK_TIER[r.next.rarity],
        habit: h.habit, today: r.daysToNext === 1 && !h.doneToday,
      });
    }
    if (h.ongoingDaysLeft !== null && h.ongoingDaysLeft <= 10) {
      const monthDays = new Date(ctx.today.getFullYear(), ctx.today.getMonth() + 1, 0).getDate();
      goals.push({
        id: `month-${h.habit.id}`, title: `${ctx.today.getMonth() + 1}月のパーフェクト`, remaining: h.ongoingDaysLeft, unit: '日',
        progress: 1 - h.ongoingDaysLeft / monthDays, icon: 'calendar', category: 'month', tier: 'silver', mark: `${ctx.today.getMonth() + 1}月`,
        habit: h.habit, today: h.ongoingDaysLeft === 1 && !h.doneToday,
      });
    }
  }

  return goals
    .sort((a, b) => Number(b.today) - Number(a.today) || a.remaining - b.remaining || b.progress - a.progress)
    .slice(0, limit);
}
